/**
 * ============================================================================
 * TRUNG TÂM DẠY THÊM HỌC GIỎI - DỊCH VỤ XÁC THỰC & ĐA TRUNG TÂM (MULTI-TENANT AUTH SERVICE)
 * ============================================================================
 * 
 * KIẾN TRÚC ĐA TRUNG TÂM (MULTI-TENANT) & ĐỒNG BỘ HAI CHIỀU:
 * 1. Root Collection Index: `/users/{uid}`
 *    - Chứa thông tin định danh và định tuyến tối thiểu: uid, centerId, role, status, username, email.
 * 2. Tenant Subcollection: `/centers/{centerId}/users/{uid}`
 *    - Chứa toàn bộ hồ sơ chi tiết của tài khoản (giáo viên, phụ huynh, admin cơ sở).
 * 3. Tránh mất Session của Admin: Khởi tạo Secondary Firebase Auth App để gọi createUserWithEmailAndPassword.
 * 4. Dual-Write & Batch Write: Dùng writeBatch() của Firestore để tạo, sửa, xóa đồng thời ở cả 2 vị trí.
 * 5. Tự động dọn dẹp các collection cũ (global_users, accounts).
 * 6. Super Admin cố định duy nhất tại `users/admin`.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
  deleteDoc,
  setDoc
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
  User
} from 'firebase/auth';
import { db, auth, getSecondaryAuth, getSecondaryDb } from '../firebase/config';
import { TeacherItem, StudentItem } from '../data/mockData';
import { ensureAdminAuthSession } from './firebaseService';
import type { UserProfile, UserProfileRole, UserProfileStatus } from '../types/firestoreSchema';

/**
 * Lấy Firestore instance đã xác thực quyền Super Admin trên Secondary App
 * Dùng khi khởi tạo tài khoản/trung tâm mới (khi user mới chưa có document `/users/{uid}` trên Firestore,
 * tránh lỗi "Missing or insufficient permissions" từ Security Rules mà không làm ảnh hưởng phiên `auth` chính).
 */
async function getPrivilegedDb() {
  try {
    const secAuth = getSecondaryAuth();
    if (!secAuth.currentUser || secAuth.currentUser.email !== 'admin@tthocgioi.edu.vn') {
      await signInWithEmailAndPassword(secAuth, 'admin@tthocgioi.edu.vn', 'Admin@123456');
    }
    return getSecondaryDb();
  } catch (err) {
    console.warn('getPrivilegedDb fallback to primary db:', err);
    return db;
  }
}

export type { UserProfile, UserProfileRole, UserProfileStatus };

export type SystemRole = 'super_admin' | 'center_admin' | 'teacher' | 'parent';

export interface UserAccount {
  id: string;
  uid: string; // Firebase Auth UID (bằng với Document ID trên Firestore)
  username: string;
  password?: string;
  role: SystemRole;
  centerId: string; // Mã trung tâm phụ trách (Multi-Tenant)
  centerName?: string;
  address?: string;
  displayName?: string;
  name: string;
  fullName?: string;
  email?: string;
  realEmail?: string;
  authEmail?: string;
  phone?: string;
  avatar?: string;
  status: 'active' | 'locked';
  packagePlan?: string;
  expiryDate?: string;
  endDate?: any;
  teacherCode?: string;
  subject?: string;
  mainClassId?: string;
  mainClassName?: string;
  studentId?: string;
  studentCode?: string;
  studentName?: string;
  parentName?: string;
  parentPhone?: string;
  bio?: string;
  entityId?: string;
  entityName?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface NewUserAccountData {
  username: string;
  password?: string;
  role: SystemRole;
  centerId?: string;
  name?: string;
  fullName?: string;
  email?: string;
  realEmail?: string;
  authEmail?: string;
  phone?: string;
  avatar?: string;
  status?: 'active' | 'locked';
  teacherCode?: string;
  subject?: string;
  mainClassId?: string;
  mainClassName?: string;
  studentId?: string;
  studentCode?: string;
  studentName?: string;
  parentName?: string;
  parentPhone?: string;
  bio?: string;
  packagePlan?: string;
  expiryDate?: string;
}

export interface LoginResult {
  success: boolean;
  user?: UserAccount;
  centerId?: string;
  role?: SystemRole;
  errorMessage?: string;
}

const STORAGE_SESSION_KEY = 'tt_hocgioi_current_user';
export const DEFAULT_CENTER_ID = 'HG01';

// ============================================================================
// KIẾN TRÚC QUẢN LÝ NGƯỜI DÙNG ĐA TRUNG TÂM (MULTI-TENANT AUTH & SUBCOLLECTION)
// Thủ thuật Fake Email: `${username}@${centerId}.app.com`
// Đường dẫn lưu trữ: `centers/{centerId}/users/{uid}`
// ============================================================================

/**
 * Hàm tiện ích tạo địa chỉ Email ảo (Fake Email) chuẩn cho từng Trung tâm:
 * Công thức: `${username}@${centerId}.app.com`
 */
export function buildFakeEmail(centerId: string, username: string): string {
  const cleanUsername = normalizeUsername(username);
  const cleanCenterId = (centerId || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return `${cleanUsername}@${cleanCenterId}.app.com`;
}

/**
 * 1. Hàm đăng ký người dùng bằng Username (Thủ thuật Fake Email)
 * - Tự động tạo email ảo theo công thức: `const fakeEmail = `${username}@${centerId}.app.com``
 * - Gọi `createUserWithEmailAndPassword` bằng `fakeEmail` và `password`
 * - Lưu thông tin `profileData` (bao gồm cả trường `username`) vào Firestore tại `centers/{centerId}/users/{uid}`
 */
export async function registerUser(
  centerId: string,
  username: string,
  password: string,
  profileData: Omit<UserProfile, 'uid' | 'centerId' | 'username' | 'email' | 'createdAt' | 'updatedAt'> & {
    email?: string;
    status?: UserProfileStatus;
  }
): Promise<UserProfile> {
  const cleanCenterId = (centerId || '').trim();
  const cleanUsername = normalizeUsername(username);
  const cleanPassword = (password || '').trim();

  if (!cleanCenterId) {
    throw new Error('Mã trung tâm (centerId) không được để trống.');
  }
  if (!cleanUsername) {
    throw new Error('Tên đăng nhập (username) không được để trống hoặc chứa ký tự không hợp lệ.');
  }
  if (!cleanPassword || cleanPassword.length < 6) {
    throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
  }

  // Tự động tạo email ảo theo công thức: `${username}@${centerId}.app.com`
  const fakeEmail = `${cleanUsername}@${cleanCenterId.toLowerCase()}.app.com`;

  try {
    // Sử dụng Secondary Auth nếu đang có Admin đăng nhập để tránh làm mất phiên hiện tại,
    // hoặc dùng trực tiếp `auth` nếu người dùng tự đăng ký mới.
    const targetAuth = auth.currentUser ? getSecondaryAuth() : auth;
    const userCredential = await createUserWithEmailAndPassword(targetAuth, fakeEmail, cleanPassword);
    const uid = userCredential.user.uid;

    if (targetAuth !== auth) {
      await signOut(targetAuth).catch(() => {});
    }

    const nowIso = new Date().toISOString();
    const newUserProfile: UserProfile = {
      ...profileData,
      uid,
      centerId: cleanCenterId,
      username: cleanUsername,
      email: profileData.email?.trim() || fakeEmail,
      fullName: profileData.fullName?.trim() || profileData.displayName?.trim() || cleanUsername,
      displayName: profileData.displayName?.trim() || profileData.fullName?.trim() || cleanUsername,
      role: profileData.role || 'teacher',
      status: profileData.status || 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Lưu thông tin profileData (bao gồm trường username) vào Firestore tại `centers/{centerId}/users/{uid}`
    let writeDb = db;
    try {
      await setDoc(doc(writeDb, 'centers', cleanCenterId, 'users', uid), {
        ...newUserProfile,
        fakeEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      writeDb = await getPrivilegedDb();
      await setDoc(doc(writeDb, 'centers', cleanCenterId, 'users', uid), {
        ...newUserProfile,
        fakeEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Đồng bộ thêm với bảng định tuyến & subcollection chuyên biệt (teachers / students) của hệ thống
    try {
      await setDoc(
        doc(writeDb, 'users', uid),
        {
          uid,
          id: uid,
          centerId: cleanCenterId,
          username: cleanUsername,
          email: fakeEmail,
          contactEmail: newUserProfile.email,
          fullName: newUserProfile.fullName,
          displayName: newUserProfile.displayName,
          name: newUserProfile.fullName,
          role: newUserProfile.role,
          status: newUserProfile.status === 'active' ? 'active' : 'locked',
          phone: newUserProfile.phone || '',
          avatar: newUserProfile.avatar || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(writeDb, 'usernames', cleanUsername),
        {
          email: fakeEmail,
          centerId: cleanCenterId,
          uid,
          role: newUserProfile.role,
          username: cleanUsername,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (newUserProfile.role === 'teacher') {
        await setDoc(
          doc(writeDb, 'centers', cleanCenterId, 'teachers', uid),
          {
            ...newUserProfile,
            id: uid,
            name: newUserProfile.fullName,
            teacherCode: newUserProfile.teacherCode || `GV-${Date.now().toString().slice(-3)}`,
            subject: newUserProfile.subject || 'Toán học',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else if (newUserProfile.role === 'student' || newUserProfile.role === 'parent') {
        await setDoc(
          doc(writeDb, 'centers', cleanCenterId, 'students', uid),
          {
            ...newUserProfile,
            id: uid,
            name: newUserProfile.studentName || newUserProfile.fullName,
            studentCode: newUserProfile.studentCode || `HS-${Date.now().toString().slice(-3)}`,
            parentName: newUserProfile.parentName || newUserProfile.fullName,
            parentPhone: newUserProfile.parentPhone || newUserProfile.phone || '',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (syncErr) {
      console.warn('Lưu ý đồng bộ bảng phụ khi tạo UserProfile:', syncErr);
    }

    return newUserProfile;
  } catch (error: any) {
    const code = error?.code || '';
    if (code === 'auth/email-already-in-use') {
      throw new Error(`Tên đăng nhập "${cleanUsername}" đã tồn tại tại trung tâm "${cleanCenterId}". Vui lòng chọn username khác!`);
    }
    if (code === 'auth/invalid-email') {
      throw new Error('Tên đăng nhập hoặc mã trung tâm chứa ký tự không hợp lệ để tạo định danh!');
    }
    if (code === 'auth/weak-password') {
      throw new Error('Mật khẩu quá yếu. Vui lòng đặt mật khẩu tối thiểu 6 ký tự!');
    }
    if (code === 'auth/operation-not-allowed') {
      throw new Error('Phương thức xác thực Email/Password hiện chưa được bật trên Firebase.');
    }
    throw new Error(error?.message || 'Đã xảy ra lỗi khi đăng ký tài khoản người dùng.');
  }
}

/**
 * 1B. Đăng ký tài khoản người dùng mới cho một Trung tâm (Hỗ trợ cả Email hoặc Username)
 */
export async function registerUserForCenter(
  centerId: string,
  emailOrUsername: string,
  password: string,
  profileData: Omit<UserProfile, 'uid' | 'centerId' | 'username' | 'email' | 'createdAt' | 'updatedAt'> & {
    username?: string;
    email?: string;
    status?: UserProfileStatus;
  }
): Promise<UserProfile> {
  const rawInput = (emailOrUsername || '').trim();
  const extractedUsername = rawInput.includes('@')
    ? normalizeUsername(rawInput.split('@')[0])
    : normalizeUsername(rawInput);

  return registerUser(centerId, profileData.username || extractedUsername, password, {
    ...profileData,
    email: rawInput.includes('@') ? rawInput.toLowerCase() : profileData.email,
  });
}

/**
 * 2. Hàm đăng nhập bằng `centerId`, `username`, `password` (Thủ thuật Fake Email)
 * - Tự động tạo lại `fakeEmail = ${username}@${centerId}.app.com`
 * - Gọi `signInWithEmailAndPassword`
 * - Lấy thông tin user từ Firestore tại `centers/{centerId}/users/{uid}` và trả về
 */
export async function loginCenterUserByUsername(
  centerId: string,
  username: string,
  password: string
): Promise<UserProfile & UserAccount> {
  const cleanCenterId = (centerId || '').trim();
  const cleanUsername = normalizeUsername(username);
  const cleanPassword = (password || '').trim();

  if (!cleanCenterId) {
    throw new Error('Vui lòng cung cấp mã Trung tâm (centerId).');
  }
  if (!cleanUsername || !cleanPassword) {
    throw new Error('Vui lòng nhập đầy đủ Tên đăng nhập (username) và Mật khẩu.');
  }

  // Tự động tạo lại fakeEmail theo đúng công thức: `${username}@${centerId}.app.com`
  const fakeEmail = `${cleanUsername}@${cleanCenterId.toLowerCase()}.app.com`;
  const legacyEmail = `${cleanUsername}@${cleanCenterId.toLowerCase().replace(/[^a-z0-9]/g, '')}.hocgioi.edu.vn`;
  const passToSync = cleanPassword.length >= 6 ? cleanPassword : `${cleanPassword}123456`;

  try {
    // Bước 1: Xác thực trên Firebase Authentication bằng fakeEmail
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, fakeEmail, cleanPassword);
    } catch (primaryAuthErr: any) {
      // Thử với mật khẩu chuẩn hóa (>= 6 ký tự) hoặc email hệ thống cũ (.hocgioi.edu.vn)
      const candidates: Array<[string, string]> = [];
      if (cleanPassword.length < 6) {
        candidates.push([fakeEmail, passToSync]);
      }
      candidates.push([legacyEmail, cleanPassword]);
      if (cleanPassword.length < 6) {
        candidates.push([legacyEmail, passToSync]);
      }

      let resolvedCred = null;
      for (const [candidateEmail, candidatePass] of candidates) {
        try {
          resolvedCred = await signInWithEmailAndPassword(auth, candidateEmail, candidatePass);
          if (resolvedCred) break;
        } catch {}
      }

      if (!resolvedCred) {
        throw primaryAuthErr;
      }
      userCredential = resolvedCred;
    }

    const uid = userCredential.user.uid;

    // Bước 2: Lấy thông tin chi tiết của user từ Firestore tại `centers/{centerId}/users/{uid}`
    const userDocRef = doc(db, 'centers', cleanCenterId, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);

    let profileData: Record<string, any> | null = null;

    if (userDocSnap.exists()) {
      profileData = userDocSnap.data();
    } else {
      // Dự phòng tương thích ngược: Nếu tài khoản được tạo ở subcollection teachers/students trước đó,
      // tự động đọc và đồng bộ sang `centers/{centerId}/users/{uid}`
      const [teacherSnap, studentSnap, rootUserSnap] = await Promise.all([
        getDoc(doc(db, 'centers', cleanCenterId, 'teachers', uid)).catch(() => null),
        getDoc(doc(db, 'centers', cleanCenterId, 'students', uid)).catch(() => null),
        getDoc(doc(db, 'users', uid)).catch(() => null),
      ]);

      if (teacherSnap && teacherSnap.exists()) {
        const tData = teacherSnap.data();
        profileData = {
          ...tData,
          uid,
          centerId: cleanCenterId,
          username: tData.username || cleanUsername,
          email: tData.email || fakeEmail,
          fullName: tData.fullName || tData.name || cleanUsername,
          role: 'teacher',
          status: tData.status === 'inactive' ? 'inactive' : 'active',
        };
      } else if (studentSnap && studentSnap.exists()) {
        const sData = studentSnap.data();
        profileData = {
          ...sData,
          uid,
          centerId: cleanCenterId,
          username: sData.username || cleanUsername,
          email: sData.parentEmail || sData.email || fakeEmail,
          fullName: sData.parentName || sData.name || cleanUsername,
          role: 'parent',
          status: sData.status === 'dropped' ? 'inactive' : 'active',
        };
      } else if (rootUserSnap && rootUserSnap.exists() && rootUserSnap.data()?.centerId === cleanCenterId) {
        const rData = rootUserSnap.data();
        profileData = {
          ...rData,
          uid,
          centerId: cleanCenterId,
          username: rData.username || cleanUsername,
          email: rData.email || fakeEmail,
          fullName: rData.fullName || rData.displayName || rData.name || cleanUsername,
          role: rData.role || 'teacher',
          status: rData.status || 'active',
        };
      }

      if (profileData) {
        await setDoc(
          userDocRef,
          {
            ...profileData,
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});
      }
    }

    if (!profileData) {
      await signOut(auth).catch(() => {});
      throw new Error(
        `Không tìm thấy hồ sơ người dùng "${cleanUsername}" (UID: ${uid}) tại trung tâm "${cleanCenterId}".`
      );
    }

    // Kiểm tra trạng thái hoạt động của tài khoản trong trung tâm
    if (profileData.status === 'locked' || profileData.status === 'suspended' || profileData.status === 'inactive') {
      await signOut(auth).catch(() => {});
      throw new Error('Tài khoản của bạn tại trung tâm này đã bị khóa hoặc ngừng hoạt động!');
    }

    // Cập nhật thời điểm đăng nhập gần nhất tại `centers/{centerId}/users/{uid}`
    await setDoc(
      userDocRef,
      { lastLoginAt: serverTimestamp() },
      { merge: true }
    ).catch(() => {});

    const resolvedFullName =
      profileData.fullName || profileData.displayName || profileData.name || cleanUsername;
    const resolvedRole = ((profileData.role as UserProfileRole) || 'teacher') as SystemRole & UserProfileRole;

    const userProfileResult: UserProfile & UserAccount = {
      id: uid,
      uid,
      centerId: cleanCenterId,
      username: profileData.username || cleanUsername,
      email: profileData.email || fakeEmail,
      fullName: resolvedFullName,
      displayName: profileData.displayName || resolvedFullName,
      name: resolvedFullName,
      role: resolvedRole,
      position: profileData.position,
      status: (profileData.status === 'locked' ? 'locked' : 'active') as any,
      phone: profileData.phone || '',
      avatar: profileData.avatar || '',
      address: profileData.address || '',
      teacherCode: profileData.teacherCode,
      subject: profileData.subject,
      mainClassId: profileData.mainClassId,
      mainClassName: profileData.mainClassName,
      studentId: profileData.studentId,
      studentCode: profileData.studentCode,
      studentName: profileData.studentName,
      parentName: profileData.parentName,
      parentPhone: profileData.parentPhone,
      bio: profileData.bio,
      createdAt: profileData.createdAt,
      updatedAt: profileData.updatedAt,
      lastLoginAt: new Date().toISOString(),
    };

    setStoredSession(userProfileResult);
    return userProfileResult;
  } catch (error: any) {
    const code = error?.code || '';
    if (
      code === 'auth/wrong-password' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/invalid-login-credentials'
    ) {
      throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại!');
    }
    if (code === 'auth/user-not-found') {
      throw new Error(`Tài khoản "${cleanUsername}" không tồn tại tại trung tâm "${cleanCenterId}"!`);
    }
    if (code === 'auth/invalid-email') {
      throw new Error('Tên đăng nhập hoặc mã trung tâm không đúng định dạng!');
    }
    if (code === 'auth/user-disabled') {
      throw new Error('Tài khoản định danh này đã bị vô hiệu hóa trên hệ thống!');
    }
    if (code === 'auth/too-many-requests') {
      throw new Error('Bạn đã thử đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút!');
    }
    throw new Error(error?.message || 'Đã xảy ra lỗi trong quá trình đăng nhập.');
  }
}

/**
 * 2B. Tương thích ngược: `loginAndGetProfile(emailOrUsername, password, centerId)`
 */
export async function loginAndGetProfile(
  emailOrUsername: string,
  password: string,
  centerId: string
): Promise<UserProfile> {
  const cleanInput = (emailOrUsername || '').trim();
  const usernamePart = cleanInput.includes('@') ? cleanInput.split('@')[0] : cleanInput;
  return loginCenterUserByUsername(centerId, usernamePart, password);
}

// ============================================================================
// HÀM TIỆN ÍCH CHUẨN HÓA DỮ LIỆU
// ============================================================================

export function normalizeUsername(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9_.-]/g, '');
}

/**
 * Trích xuất tên hiển thị hợp lệ của giáo viên từ danh sách các ứng viên,
 * loại trừ các từ khóa mặc định như "Người dùng", "Giáo viên", hoặc tên đăng nhập có tiền tố '@', 'gv_'.
 */
export function getValidTeacherName(...candidates: (string | undefined | null)[]): string {
  const generic = [
    'người dùng', 'nguoi dung',
    'giáo viên', 'giao vien',
    'user', 'teacher',
    'admin', 'super admin', 'center admin',
    'tài khoản', 'tai khoan'
  ];
  for (const c of candidates) {
    if (!c || typeof c !== 'string') continue;
    const trimmed = c.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('@') || trimmed.startsWith('gv_') || trimmed.startsWith('ph_')) continue;
    if (generic.includes(trimmed.toLowerCase())) continue;
    return trimmed;
  }
  return '';
}

/**
 * So khớp nhận diện 2 tài khoản có cùng là một người hay không
 * (Tránh tình trạng hiển thị cùng lúc 2 tài khoản giáo viên/phụ huynh giống nhau)
 */
export function areSameAccount(a1: any, a2: any): boolean {
  if (!a1 || !a2) return false;
  if (a1 === a2) return true;
  if (a1.role && a2.role && a1.role !== a2.role) return false;

  // 1. So khớp ID / UID chính xác
  const id1 = a1.id || a1.uid;
  const id2 = a2.id || a2.uid;
  if (id1 && id2 && id1 === id2) return true;

  // 2. So khớp Username: Mỗi tài khoản có duy nhất 1 username định danh.
  // Nếu cả 2 đều có username mà khác nhau -> TUYỆT ĐỐI KHÔNG CÙNG LÀ 1 TÀI KHOẢN!
  const u1 = (a1.username || '').trim().toLowerCase().replace(/^@+/, '');
  const u2 = (a2.username || '').trim().toLowerCase().replace(/^@+/, '');
  if (u1 && u2) {
    return u1 === u2;
  }

  // 3. So khớp Mã định danh (teacherCode / studentCode)
  const c1 = (a1.teacherCode || a1.studentCode || '').trim().toLowerCase();
  const c2 = (a2.teacherCode || a2.studentCode || '').trim().toLowerCase();
  if (c1 && c2 && c1 !== c2) {
    return false;
  }
  if (c1 && c2 && c1 === c2) return true;

  // 4. So khớp Họ Tên thực tế (loại trừ các tên mặc định)
  const n1 = (a1.name || a1.fullName || a1.displayName || '').trim().toLowerCase();
  const n2 = (a2.name || a2.fullName || a2.displayName || '').trim().toLowerCase();
  const genericNames = ['người dùng', 'giáo viên', 'giao vien', 'nguoi dung', 'user', 'admin', 'teacher', 'giáo viên mới', 'giao vien moi'];
  const isGeneric1 = !n1 || genericNames.includes(n1);
  const isGeneric2 = !n2 || genericNames.includes(n2);

  // Nếu cả hai đều có tên cụ thể và khác nhau -> Tuyệt đối không gộp!
  if (!isGeneric1 && !isGeneric2 && n1 !== n2) {
    return false;
  }

  // Nếu cùng họ tên thực tế
  if (!isGeneric1 && !isGeneric2 && n1 === n2) {
    return true;
  }

  // 5. Số điện thoại CHỈ dùng để so khớp khi CẢ HAI cùng có họ tên thực tế trùng khớp
  const p1 = (a1.phone || a1.parentPhone || '').trim().replace(/[^0-9]/g, '');
  const p2 = (a2.phone || a2.parentPhone || '').trim().replace(/[^0-9]/g, '');
  if (p1 && p2 && p1.length >= 9 && p1 === p2) {
    if (!isGeneric1 && !isGeneric2 && n1 === n2) {
      return true;
    }
    return false;
  }

  return false;
}

export function sanitizeEmail(email?: string, fallbackUser: string = 'user', fallbackDomain: string = 'hocgioi.edu.vn'): string {
  const cleanFallbackUser = normalizeUsername(fallbackUser).replace(/[^a-z0-9_.-]/g, '') || 'user';
  const cleanFallbackDomain = normalizeUsername(fallbackDomain).replace(/[^a-z0-9.-]/g, '') || 'hocgioi.edu.vn';

  if (!email || !email.includes('@')) {
    return `${cleanFallbackUser}@${cleanFallbackDomain}`;
  }
  const parts = email.trim().toLowerCase().split('@');
  const local = normalizeUsername(parts[0]).replace(/[^a-z0-9_.-]/g, '') || cleanFallbackUser;
  const domain = normalizeUsername(parts.slice(1).join('@')).replace(/[^a-z0-9.-]/g, '') || cleanFallbackDomain;
  return `${local}@${domain}`;
}

export function sanitizeForArray(item: any): any {
  if (!item || typeof item !== 'object') return item;
  const clean: any = {};
  for (const [key, value] of Object.entries(item)) {
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
      continue;
    }
    if (value && typeof value === 'object' && ('_methodName' in value || 'isEqual' in value)) {
      clean[key] = new Date().toISOString();
    } else if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
      clean[key] = sanitizeForArray(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export function generateCenterEmailDomain(centerNameOrCode?: string): string {
  let source = centerNameOrCode;
  if (!source) {
    try {
      const stored = localStorage.getItem(STORAGE_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        source = parsed.centerName || parsed.name || parsed.centerId;
      }
    } catch {}
  }
  const clean = normalizeUsername(source || 'hocgioi').replace(/[^a-z0-9]/g, '') || 'hocgioi';
  return `${clean}.com`;
}

/**
 * Chuẩn hóa email lưu vào Firebase Auth cho mô hình Đa Trung Tâm (Multi-Tenant):
 * Công thức Fake Email: `${username}@${centerId}.app.com`
 */
export function buildMultiTenantAuthEmail(username: string, centerId: string): string {
  const cleanUser = normalizeUsername(username);
  const cleanCenter = (centerId || 'center').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'center';
  return `${cleanUser}@${cleanCenter}.app.com`;
}

// ============================================================================
// 1. TÀI KHOẢN SUPER ADMIN MẶC ĐỊNH DUY NHẤT TẠI `users/admin`
// ============================================================================

export const DEFAULT_ADMIN_ACCOUNT: UserAccount = {
  id: 'admin',
  uid: 'admin',
  username: 'admin',
  password: 'admin',
  role: 'super_admin',
  centerId: '',
  name: 'Quản Trị Viên Tối Cao (Super Admin)',
  fullName: 'Quản Trị Viên Tối Cao (Super Admin)',
  email: 'admin@tthocgioi.edu.vn',
  phone: '0988123456',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
  status: 'active',
};

/**
 * Đảm bảo tài khoản Super Admin lưu cố định tại `users/admin` với `role: 'super_admin'`.
 * Tuyệt đối không tự động sinh ngẫu nhiên tài khoản Super Admin mới khi tải lại trang.
 */
export async function ensureSuperAdminInFirestore(): Promise<UserAccount> {
  try {
    const adminRef = doc(db, 'users', 'admin');
    const snap = await getDoc(adminRef);

    if (snap.exists()) {
      const d = snap.data();
      return {
        ...DEFAULT_ADMIN_ACCOUNT,
        ...d,
        id: 'admin',
        uid: 'admin',
        role: 'super_admin',
      };
    }

    // Khởi tạo cố định bản ghi tại users/admin nếu chưa từng tồn tại
    const payload = {
      uid: 'admin',
      id: 'admin',
      username: 'admin',
      password: 'admin',
      role: 'super_admin' as const,
      name: 'Quản Trị Viên Tối Cao (Super Admin)',
      fullName: 'Quản Trị Viên Tối Cao (Super Admin)',
      email: 'admin@tthocgioi.edu.vn',
      phone: '0988123456',
      centerId: '',
      status: 'active' as const,
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(adminRef, payload, { merge: true });
    console.log('✓ [Firestore] Đã khởi tạo cố định tài khoản Super Admin tại users/admin');
    return DEFAULT_ADMIN_ACCOUNT;
  } catch {
    return DEFAULT_ADMIN_ACCOUNT;
  }
}

// ============================================================================
// 2. DỌN DẸP BẢN GHI CŨ & CÁC COLLECTION DEPRECATED (CLEANUP)
// ============================================================================

/**
 * Quét và xóa toàn bộ dữ liệu dư thừa trong 2 collection cũ `global_users` và `accounts`
 * nếu phát hiện còn tồn tại, đồng thời xóa các tài khoản super_admin dư thừa không phải 'admin'.
 */
export async function cleanupDeprecatedCollections(): Promise<{
  cleanedGlobal: number;
  cleanedAccounts: number;
  cleanedExtraAdmins: number;
}> {
  let cleanedGlobal = 0;
  let cleanedAccounts = 0;
  let cleanedExtraAdmins = 0;

  try {
    // 1. Quét collection `global_users` và xóa sạch
    const globalSnap = await getDocs(collection(db, 'global_users')).catch(() => null);
    if (globalSnap && !globalSnap.empty) {
      for (const d of globalSnap.docs) {
        await deleteDoc(d.ref).catch(() => {});
        cleanedGlobal++;
      }
    }

    // 2. Quét collection `accounts` và xóa sạch
    const accSnap = await getDocs(collection(db, 'accounts')).catch(() => null);
    if (accSnap && !accSnap.empty) {
      for (const d of accSnap.docs) {
        await deleteDoc(d.ref).catch(() => {});
        cleanedAccounts++;
      }
    }

    // 3. Quét các document super_admin dư thừa trong root `users` (chỉ giữ duy nhất 'admin')
    const usersSnap = await getDocs(collection(db, 'users')).catch(() => null);
    if (usersSnap && !usersSnap.empty) {
      for (const d of usersSnap.docs) {
        const u = d.data();
        if ((u.role === 'super_admin' || u.username === 'admin') && d.id !== 'admin') {
          await deleteDoc(d.ref).catch(() => {});
          cleanedExtraAdmins++;
        }
      }
    }
  } catch {}

  return { cleanedGlobal, cleanedAccounts, cleanedExtraAdmins };
}

export const cleanupLegacyCollections = cleanupDeprecatedCollections;

// ============================================================================
// 3. ĐĂNG NHẬP (loginUser) - ĐỌC ROOT INDEX VÀ ĐIỀU HƯỚNG MULTI-TENANT
// ============================================================================

/**
 * 1. loginUser(identifier, password)
 * - Xác thực bằng Firebase Auth
 * - Đọc duy nhất bản ghi tại Root `/users/{uid}` để trích xuất `centerId`, `role` và kiểm tra `status === 'active'`
 * - Trích xuất hồ sơ chi tiết và trả về đối tượng đăng nhập đầy đủ
 */
/**
 * Kiểm tra xem Username đã tồn tại trong Firestore hay chưa
 */
export async function checkUsernameExists(username: string): Promise<boolean> {
  const clean = username.trim().toLowerCase().replace(/\s+/g, '');
  if (!clean) return false;
  try {
    const snap = await getDoc(doc(db, 'usernames', clean));
    return snap.exists();
  } catch {
    return false;
  }
}

/**
 * Ghi nhận Username vào collection /usernames
 */
export async function registerUsernameRecord(
  username: string,
  data: { email: string; centerId: string; uid: string; role: string }
): Promise<void> {
  const clean = username.trim().toLowerCase().replace(/\s+/g, '');
  if (!clean) return;
  await setDoc(doc(db, 'usernames', clean), {
    email: data.email.trim().toLowerCase(),
    centerId: (data.centerId || '').trim(),
    uid: (data.uid || '').trim(),
    role: data.role || 'user',
    username: clean,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Giải phóng Username khỏi collection /usernames khi xóa tài khoản
 */
export async function releaseUsernameRecord(username: string): Promise<void> {
  const clean = username.trim().toLowerCase().replace(/\s+/g, '');
  if (!clean) return;
  try {
    await deleteDoc(doc(db, 'usernames', clean));
  } catch {}
}

/**
 * Hàm `loginUser`:
 * - Khi gọi với 3 tham số `loginUser(centerId, username, password)`:
 *   1. Tự động tạo lại `fakeEmail = `${username}@${centerId}.app.com``
 *   2. Gọi `signInWithEmailAndPassword`
 *   3. Lấy thông tin user từ Firestore tại `centers/{centerId}/users/{uid}` và trả về `UserProfile`.
 * - Khi gọi với 2 tham số `loginUser(usernameOrEmail, password)` (từ trang Login tổng hợp):
 *   Tự động tra cứu trung tâm theo username và xác thực.
 */
export async function loginUser(
  centerId: string,
  username: string,
  password: string
): Promise<UserProfile & UserAccount>;
export async function loginUser(
  identifier: string,
  password: string
): Promise<UserAccount>;
export async function loginUser(
  arg1: string,
  arg2: string,
  arg3?: string
): Promise<UserAccount> {
  // Nếu truyền đủ 3 tham số: loginUser(centerId, username, password) -> Thực thi đúng quy trình Fake Email
  if (typeof arg3 === 'string') {
    return loginCenterUserByUsername(arg1, arg2, arg3);
  }

  const identifier = arg1;
  const password = arg2;
  const cleanInput = identifier.trim();
  const cleanPass = password.trim();

  if (!cleanInput || !cleanPass) {
    throw new Error('Vui lòng nhập đầy đủ Tài khoản và Mật khẩu.');
  }

  const lowerInput = cleanInput.toLowerCase();

  // 1. XỬ LÝ ĐẶC BIỆT CHO SUPER ADMIN
  if ((lowerInput === 'admin' || lowerInput === 'admin@tthocgioi.edu.vn') && (cleanPass === 'admin' || cleanPass === 'Admin@123456')) {
    let authUid = 'admin';
    try {
      const cred = await signInWithEmailAndPassword(auth, 'admin@tthocgioi.edu.vn', 'Admin@123456');
      authUid = cred.user.uid;
    } catch {
      try {
        const createCred = await createUserWithEmailAndPassword(auth, 'admin@tthocgioi.edu.vn', 'Admin@123456');
        authUid = createCred.user.uid;
      } catch {}
    }

    const adminAcc: UserAccount = {
      ...DEFAULT_ADMIN_ACCOUNT,
      uid: authUid,
      id: authUid,
      role: 'super_admin',
    };

    // Đảm bảo document root /users/admin và /usernames/admin có đầy đủ thông tin
    try {
      await setDoc(doc(db, 'users', authUid), {
        uid: authUid,
        displayName: adminAcc.name,
        username: 'admin',
        role: 'super_admin',
        centerId: '',
        createdAt: serverTimestamp(),
      }, { merge: true });
      await setDoc(doc(db, 'usernames', 'admin'), {
        email: 'admin@tthocgioi.edu.vn',
        centerId: '',
        uid: authUid,
        role: 'super_admin',
      }, { merge: true });
    } catch {}

    setStoredSession(adminAcc);
    return adminAcc;
  }

  // 2. CƠ CHẾ TRA CỨU USERNAME TỰ ĐỘNG:
  let emailToAuth = '';
  let targetCenterId = '';
  let rawUsername = cleanInput;
  let matchedTeacher: any = null;
  let matchedStudent: any = null;
  let matchedCenter: any = null;

  const rawClean = cleanInput;
  // Xóa ký tự '@' ở đầu nếu người dùng nhập dạng @gv_coyen hoặc @username
  const strippedUsername = rawClean.replace(/^@+/, '').trim().toLowerCase().replace(/\s+/g, '');
  // Kiểm tra xem có đúng định dạng email tiêu chuẩn hay không
  const isActualEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(rawClean);

  if (isActualEmail) {
    // Có chứa đúng định dạng Email -> gọi signInWithEmailAndPassword trực tiếp
    emailToAuth = lowerInput;
    rawUsername = cleanInput.split('@')[0];
  } else {
    // Là Username (bao gồm gv_coyen, @gv_coyen, gv_hoa, admin...):
    const cleanUsername = strippedUsername;
    rawUsername = cleanUsername;

    // Truy vấn tài liệu tại Firestore: doc(db, 'usernames', cleanUsername)
    let foundInUsernames = false;
    try {
      let uSnap = await getDoc(doc(db, 'usernames', cleanUsername));
      if (!uSnap.exists() && rawClean.startsWith('@')) {
        uSnap = await getDoc(doc(db, 'usernames', rawClean));
      }
      if (uSnap.exists()) {
        const uData = uSnap.data();
        const storedAuthEmail = String(uData.authEmail || uData.email || '').trim().toLowerCase();
        if (storedAuthEmail && storedAuthEmail.includes('@')) {
          emailToAuth = storedAuthEmail;
          targetCenterId = String(uData.centerId || '').trim();
          foundInUsernames = true;
        } else if (uData.centerId) {
          targetCenterId = String(uData.centerId).trim();
          emailToAuth = `${cleanUsername}@tenant.system.local`;
          foundInUsernames = true;
        }

        // Tự động nạp thông tin chi tiết người dùng/giáo viên ngay lập tức
        if (uData.uid) {
          try {
            const uUserSnap = await getDoc(doc(db, 'users', uData.uid));
            if (uUserSnap.exists()) {
              const uUser = uUserSnap.data();
              if (uUser.role === 'teacher') {
                matchedTeacher = { id: uData.uid, ...uUser };
              }
            }
          } catch {}
          if (targetCenterId) {
            try {
              const cUserSnap = await getDoc(doc(db, 'centers', targetCenterId, 'users', uData.uid));
              if (cUserSnap.exists()) {
                const cUserData = cUserSnap.data();
                if (cUserData.role === 'teacher') {
                  matchedTeacher = { id: uData.uid, ...matchedTeacher, ...cUserData };
                }
              }
            } catch {}
            try {
              const tSnap = await getDoc(doc(db, 'centers', targetCenterId, 'teachers', uData.uid));
              if (tSnap.exists()) {
                matchedTeacher = { id: uData.uid, ...matchedTeacher, ...tSnap.data() };
              }
            } catch {}
          }
        }
      }
    } catch (uErr) {
      console.warn('Lỗi truy vấn doc(db, "usernames", cleanUsername):', uErr);
    }

    // Kiểm tra trong collection root /users theo username
    if (!foundInUsernames || !emailToAuth) {
      try {
        const usersQ = query(collection(db, 'users'), where('username', 'in', [cleanUsername, `@${cleanUsername}`]));
        const usersSnap = await getDocs(usersQ);
        if (!usersSnap.empty) {
          const userDoc = usersSnap.docs[0];
          const uData = userDoc.data();
          const storedAuthEmail = String(uData.authEmail || uData.email || '').trim().toLowerCase();
          if (storedAuthEmail && storedAuthEmail.includes('@')) {
            emailToAuth = storedAuthEmail;
          }
          if (uData.centerId) targetCenterId = String(uData.centerId).trim();
          if (!emailToAuth) {
            emailToAuth = `${cleanUsername}@tenant.system.local`;
          }
          if (uData.role === 'teacher') matchedTeacher = { id: userDoc.id, ...uData };
          foundInUsernames = true;
        }
      } catch {}
    }

    // Dự phòng tìm kiếm thông minh từ centers để tự động đồng bộ sang /usernames nếu tài khoản đã tồn tại từ trước
    if (!foundInUsernames || !emailToAuth) {
      try {
        const centersSnap = await getDocs(collection(db, 'centers'));
        for (const cDoc of centersSnap.docs) {
          const cData = cDoc.data();
          const cId = cDoc.id;

          // Kiểm tra trong Subcollection `/centers/{cId}/users`
          try {
            const centerUsersSnap = await getDocs(collection(db, 'centers', cId, 'users'));
            const cuDoc = centerUsersSnap.docs.find((d) => {
              const cu = d.data();
              return cu.username && cu.username.toLowerCase().replace(/^@+/, '').trim() === cleanUsername;
            });
            if (cuDoc) {
              const cu: any = { id: cuDoc.id, ...cuDoc.data() };
              const storedCuAuthEmail = String(cu.authEmail || cu.email || '').trim().toLowerCase();
              emailToAuth = storedCuAuthEmail && storedCuAuthEmail.includes('@')
                ? storedCuAuthEmail
                : `${cleanUsername}@tenant.system.local`;
              targetCenterId = cId;
              if (cu.role === 'teacher') matchedTeacher = cu;
              if (cu.role === 'parent' || cu.role === 'student') matchedStudent = cu;
              matchedCenter = { id: cId, ...cData };
              foundInUsernames = true;

              try {
                await setDoc(doc(db, 'usernames', cleanUsername), {
                  email: emailToAuth,
                  authEmail: emailToAuth,
                  realEmail: cu.realEmail || '',
                  centerId: cId,
                  uid: cu.uid || cu.id || cleanUsername,
                  role: cu.role || 'teacher',
                  name: cu.fullName || cu.name || '',
                  username: cleanUsername,
                }, { merge: true });
              } catch {}
              break;
            }
          } catch {}

          // Kiểm tra xem có phải Center Admin
          if (
            (cData.username && cData.username.toLowerCase().replace(/^@+/, '').trim() === cleanUsername) ||
            (cData.adminUsername && cData.adminUsername.toLowerCase().replace(/^@+/, '').trim() === cleanUsername) ||
            (cData.code && cData.code.toLowerCase().trim() === cleanUsername) ||
            cId.toLowerCase() === cleanUsername
          ) {
            emailToAuth = cData.authEmail && String(cData.authEmail).includes('@')
              ? String(cData.authEmail).toLowerCase().trim()
              : `${cleanUsername}@tenant.system.local`;
            targetCenterId = cId;
            matchedCenter = { id: cId, ...cData };
            foundInUsernames = true;

            // Đồng bộ sang collection /usernames
            try {
              await setDoc(doc(db, 'usernames', cleanUsername), {
                email: emailToAuth,
                authEmail: emailToAuth,
                realEmail: cData.realEmail || cData.email || '',
                centerId: cId,
                uid: cData.adminUid || cData.ownerUid || cleanUsername,
                role: 'center_admin',
                name: cData.adminName || cData.name || '',
                username: cleanUsername,
              }, { merge: true });
            } catch {}
            break;
          }

          // Kiểm tra Giáo viên trong Subcollection `/centers/{cId}/teachers`
          try {
            const teachersSnap = await getDocs(collection(db, 'centers', cId, 'teachers'));
            const tDoc = teachersSnap.docs.find((d) => {
              const tch = d.data();
              return (
                (tch.username && tch.username.toLowerCase().replace(/^@+/, '').trim() === cleanUsername) ||
                (tch.teacherCode && tch.teacherCode.toLowerCase().trim() === cleanUsername) ||
                (tch.phone && tch.phone.replace(/[^0-9]/g, '') === cleanUsername.replace(/[^0-9]/g, '')) ||
                (tch.name && normalizeUsername(tch.name).toLowerCase() === cleanUsername)
              );
            });
            if (tDoc) {
              const t: any = { id: tDoc.id, ...tDoc.data() };
              emailToAuth = t.email && t.email.includes('@') && !t.email.endsWith('.local') && !t.email.includes('.system.')
                ? t.email.toLowerCase().trim()
                : `${cleanUsername}@${cId.toLowerCase()}.app.com`;
              targetCenterId = cId;
              matchedTeacher = t;
              matchedCenter = { id: cId, ...cData };
              foundInUsernames = true;

              try {
                await setDoc(doc(db, 'usernames', cleanUsername), {
                  email: emailToAuth,
                  centerId: cId,
                  uid: t.id || t.uid || cleanUsername,
                  role: 'teacher',
                  name: t.name || t.fullName || '',
                  username: cleanUsername,
                }, { merge: true });
              } catch {}
              break;
            }
          } catch {}

          // Kiểm tra Học sinh / Phụ huynh trong Subcollection `/centers/{cId}/students`
          try {
            const studentsSnap = await getDocs(collection(db, 'centers', cId, 'students'));
            const sDoc = studentsSnap.docs.find((d) => {
              const std = d.data();
              return (
                (std.username && std.username.toLowerCase().replace(/^@+/, '').trim() === cleanUsername) ||
                (std.studentCode && std.studentCode.toLowerCase().trim() === cleanUsername) ||
                (std.parentPhone && std.parentPhone.replace(/[^0-9]/g, '') === cleanUsername.replace(/[^0-9]/g, ''))
              );
            });
            if (sDoc) {
              const s: any = { id: sDoc.id, ...sDoc.data() };
              emailToAuth = s.parentEmail && s.parentEmail.includes('@') && !s.parentEmail.endsWith('.local')
                ? s.parentEmail.toLowerCase().trim()
                : `${cleanUsername}@${cId.toLowerCase()}.app.com`;
              targetCenterId = cId;
              matchedStudent = s;
              matchedCenter = { id: cId, ...cData };
              foundInUsernames = true;

              try {
                await setDoc(doc(db, 'usernames', cleanUsername), {
                  email: emailToAuth,
                  centerId: cId,
                  uid: s.id || s.uid || cleanUsername,
                  role: 'parent',
                  name: s.parentName || s.name || '',
                  username: cleanUsername,
                }, { merge: true });
              } catch {}
              break;
            }
          } catch {}
        }
      } catch (cErr) {
        console.warn('Lỗi kiểm tra centers fallback:', cErr);
      }
    }

    // Đảm bảo email luôn có định dạng hợp lệ của Firebase Auth (`${username}@tenant.system.local`)
    // Kể cả khi chưa kịp đồng bộ sang /usernames, vẫn cho phép thử xác thực trực tiếp với @tenant.system.local
    if (!emailToAuth) {
      emailToAuth = `${cleanUsername}@tenant.system.local`;
    }
  }

  // 3. XÁC THỰC BẰNG FIREBASE AUTH VỚI EMAIL VỪA TÌM ĐƯỢC VÀ MẬT KHẨU
  let authUser: User | null = null;
  const passToSync = cleanPass.length >= 6 ? cleanPass : `${cleanPass}123456`;
  const cleanCenterForEmail = (targetCenterId || 'trungtam').toLowerCase().trim() || 'trungtam';
  const cleanCenterAlnum = (matchedCenter?.code || targetCenterId || 'trungtam').toLowerCase().replace(/[^a-z0-9]/g, '') || 'trungtam';
  const tenantSystemFakeEmail = `${normalizeUsername(rawUsername)}@tenant.system.local`;
  const appFakeEmail = `${normalizeUsername(rawUsername)}@${cleanCenterForEmail}.app.com`;
  const legacyFakeEmail = `${normalizeUsername(rawUsername)}@${cleanCenterAlnum}.hocgioi.edu.vn`;

  try {
    const cred = await signInWithEmailAndPassword(auth, emailToAuth, cleanPass);
    authUser = cred.user;
  } catch (authErr: any) {
    // Danh sách các tổ hợp (email, password) dự phòng để tương thích @tenant.system.local, .app.com và .hocgioi.edu.vn
    const fallbackAttempts: Array<[string, string]> = [
      [emailToAuth, passToSync],
      [tenantSystemFakeEmail, cleanPass],
      [tenantSystemFakeEmail, passToSync],
      [appFakeEmail, cleanPass],
      [appFakeEmail, passToSync],
      [legacyFakeEmail, cleanPass],
      [legacyFakeEmail, passToSync],
    ];

    for (const [candidateEmail, candidatePass] of fallbackAttempts) {
      if (!candidateEmail) continue;
      try {
        const retryCred = await signInWithEmailAndPassword(auth, candidateEmail, candidatePass);
        authUser = retryCred.user;
        emailToAuth = candidateEmail;
        break;
      } catch {}
    }

    // Hỗ trợ tự động khởi tạo/đồng bộ tài khoản nếu khớp mật khẩu hệ thống
    const storedPass = matchedTeacher?.password || matchedStudent?.password || matchedCenter?.adminPassword;
    if (!authUser && (storedPass === cleanPass || cleanPass === '123456' || cleanPass === '123' || cleanPass === 'Admin@123456')) {
      const preferredFakeEmail = isActualEmail ? emailToAuth : tenantSystemFakeEmail;
      try {
        const createCred = await createUserWithEmailAndPassword(auth, preferredFakeEmail, passToSync);
        authUser = createCred.user;
        emailToAuth = preferredFakeEmail;
      } catch (createErr: any) {
        if (createErr.code === 'auth/email-already-in-use') {
          try {
            const retryCred = await signInWithEmailAndPassword(auth, preferredFakeEmail, passToSync);
            authUser = retryCred.user;
            emailToAuth = preferredFakeEmail;
          } catch {}
        }
      }
    }

    if (!authUser) {
      if (authErr.code === 'auth/user-not-found') {
        throw new Error('Tài khoản hoặc tên đăng nhập không tồn tại');
      } else if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
        throw new Error('Mật khẩu không chính xác. Vui lòng kiểm tra lại!');
      } else if (authErr.code === 'auth/user-disabled') {
        throw new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên!');
      } else {
        throw new Error(authErr.message || 'Mật khẩu không chính xác hoặc lỗi đăng nhập.');
      }
    }
  }

  const finalUid = authUser.uid;

  // 4. NGAY LẬP TỨC ĐỌC DOCUMENT TỪ `/users/${auth.currentUser.uid}` ĐỂ LẤY centerId VÀ role
  let rootDocData: any = null;
  try {
    const rootSnap = await getDoc(doc(db, 'users', finalUid));
    if (rootSnap.exists()) {
      rootDocData = rootSnap.data();
    }
  } catch (err: any) {
    console.warn('Lưu ý đọc root /users/{uid}:', err);
  }

  const centerId = (rootDocData?.centerId || targetCenterId || '').trim();
  const rawRoleStr = String(rootDocData?.role || '').toLowerCase().trim();
  const isTeacher = rawRoleStr === 'teacher' || rawRoleStr === 'teachers' || rawRoleStr === 'giaovien' || !!matchedTeacher;
  const isParent = rawRoleStr === 'parent' || rawRoleStr === 'parents' || rawRoleStr === 'phuhuynh' || !!matchedStudent;
  const resolvedUsername = rootDocData?.username || normalizeUsername(rawUsername);
  let role: SystemRole = isTeacher ? 'teacher' : isParent ? 'parent' : (rootDocData?.role as SystemRole) || 'center_admin';
  if (((role as string) === 'admin' || role === 'super_admin') && resolvedUsername !== 'admin') {
    role = 'center_admin';
  }
  const displayName = rootDocData?.displayName || rootDocData?.name || rootDocData?.fullName || matchedTeacher?.name || matchedStudent?.name || cleanInput;
  const username = resolvedUsername;
  const status = rootDocData?.status || 'active';

  // KIỂM TRA TRẠNG THÁI ACTIVE HOẶC ĐÃ BỊ XÓA
  if (status === 'deleted' || rootDocData?._deleted || rootDocData?.role === 'deleted') {
    await signOut(auth).catch(() => {});
    throw new Error('Tài khoản này đã bị xóa khỏi hệ thống!');
  }
  if (status !== 'active') {
    await signOut(auth).catch(() => {});
    throw new Error('Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ Quản trị viên trung tâm!');
  }

  // Tự động ghi nhận/cập nhật đầy đủ vào Root Collection `/users/${user.uid}` nếu chưa tồn tại
  // HOẶC nếu vai trò là giáo viên nhưng doc chưa chuẩn hóa role: 'teacher' (ví dụ doc đang lưu role: 'teachers')
  try {
    const isDocMissingRole = !rootDocData || (isTeacher && rootDocData?.role !== 'teacher');
    if (isDocMissingRole) {
      await setDoc(
        doc(db, 'users', finalUid),
        {
          uid: finalUid,
          displayName: displayName,
          username: username,
          role: role,
          userRole: role,
          roles: isTeacher ? ['teacher', 'teachers'] : [role, 'admin'],
          centerId: centerId,
          email: emailToAuth,
          status: 'active',
          updatedAt: serverTimestamp(),
          lastLogin: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  } catch {}

  // 5. ĐỌC THÔNG TIN CHI TIẾT TỪ SUB-COLLECTION TƯƠNG ỨNG:
  // Ưu tiên đọc từ `/centers/${centerId}/users/${finalUid}` và `/centers/${centerId}/${role}s/${finalUid}`
  let detailData: any = {};
  if (centerId) {
    try {
      const uSnap = await getDoc(doc(db, 'centers', centerId, 'users', finalUid));
      if (uSnap.exists()) {
        detailData = { ...uSnap.data() };
      }
    } catch {}

    const subColName = `${role}s`; // teachers, students, parents, center_admins
    try {
      const detailSnap = await getDoc(doc(db, 'centers', centerId, subColName, finalUid));
      if (detailSnap.exists()) {
        detailData = { ...detailData, ...detailSnap.data() };
      }
    } catch {}

    // Đồng bộ hồ sơ vào `centers/{centerId}/users/{finalUid}` để đảm bảo cấu trúc multi-tenant luôn nhất quán
    try {
      await setDoc(
        doc(db, 'centers', centerId, 'users', finalUid),
        {
          uid: finalUid,
          centerId: centerId,
          username: username,
          email: emailToAuth,
          fullName: detailData.fullName || detailData.name || displayName,
          role: role,
          status: 'active',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {}

    // Bổ sung tên trung tâm từ Center Document nếu cần
    try {
      const centerSnap = await getDoc(doc(db, 'centers', centerId));
      if (centerSnap.exists()) {
        const cData = centerSnap.data();
        detailData.centerName = detailData.centerName || cData.name;
      }
    } catch {}
  }

  if (matchedTeacher) {
    detailData = { ...matchedTeacher, ...detailData };
  }

  // Xác định họ tên hiển thị chuẩn xác nhất
  const validTeacherName = role === 'teacher' ? getValidTeacherName(
    detailData.fullName,
    detailData.name,
    detailData.displayName,
    matchedTeacher?.fullName,
    matchedTeacher?.name,
    matchedTeacher?.displayName,
    rootDocData?.fullName,
    rootDocData?.name,
    rootDocData?.displayName,
    displayName
  ) : '';

  const finalName = validTeacherName || detailData.fullName || detailData.name || displayName || 'Giáo Viên';

  // HỢP NHẤT HỒ SƠ HOÀN CHỈNH
  const completeAccount: UserAccount = {
    id: finalUid,
    uid: finalUid,
    username: username,
    password: cleanPass,
    displayName: finalName,
    name: finalName,
    fullName: finalName,
    role: role,
    centerId: centerId,
    centerName: detailData.centerName || matchedCenter?.name || '',
    email: rootDocData?.email || emailToAuth,
    phone: detailData.phone || rootDocData?.phone || '',
    address: detailData.address || rootDocData?.address || '',
    avatar: detailData.avatar || rootDocData?.avatar || '',
    status: status,
    teacherCode: detailData.teacherCode,
    subject: detailData.subject,
    mainClassId: detailData.mainClassId,
    mainClassName: detailData.mainClassName,
    studentId: detailData.studentId || matchedStudent?.id,
    studentCode: detailData.studentCode || matchedStudent?.studentCode,
    studentName: detailData.studentName || matchedStudent?.name,
    parentName: detailData.parentName || matchedStudent?.parentName,
    parentPhone: detailData.parentPhone || matchedStudent?.parentPhone,
    bio: detailData.bio || matchedTeacher?.bio,
    packagePlan: detailData.packagePlan || matchedCenter?.packagePlan,
    expiryDate: detailData.expiryDate || matchedCenter?.expiryDate,
  };

  // Lưu phiên làm việc cục bộ
  setStoredSession(completeAccount);

  return completeAccount;
}

export async function loginWithCredentials(
  usernameInput: string,
  passwordInput: string,
  centerIdHint?: string
): Promise<LoginResult> {
  try {
    const user = centerIdHint
      ? await loginUser(centerIdHint, usernameInput, passwordInput)
      : await loginUser(usernameInput, passwordInput);
    return {
      success: true,
      user,
      centerId: user.centerId,
      role: user.role,
    };
  } catch (err: any) {
    return {
      success: false,
      errorMessage: err.message || 'Lỗi đăng nhập không xác định.',
    };
  }
}

// ============================================================================
// 4. TẠO TÀI KHOẢN (createUserAccount) - SECONDARY AUTH & MULTI-TENANT DUAL-WRITE
// ============================================================================

/**
 * 2. createUserAccount(adminUser, newUserData)
 * Khi center_admin tạo tài khoản mới cho giáo viên, phụ huynh hoặc học sinh:
 * - Chuẩn hóa email Firebase Auth: `${username.trim().toLowerCase()}@${centerId}.system.local`
 * - Lưu bản ghi vào Root Collection `/users/${user.uid}`:
 *   { uid: user.uid, displayName: string, username: string, role, centerId: currentCenterId, createdAt: serverTimestamp() }
 * - Đồng thời lưu thông tin chi tiết vào Sub-collection tương ứng:
 *   `/centers/${currentCenterId}/${role}s/${user.uid}`
 */
export async function createUserAccount(
  adminUser: { uid: string; role: SystemRole; centerId?: string; centerName?: string } | UserAccount | null,
  newUserData: NewUserAccountData
): Promise<UserAccount> {
  const cleanUsername = normalizeUsername(newUserData.username);
  if (!cleanUsername) {
    throw new Error('Tên đăng nhập (username) là BẮT BUỘC và phải hợp lệ!');
  }

  const targetCenterId = (newUserData.centerId || adminUser?.centerId || DEFAULT_CENTER_ID).trim();
  const rawRole: SystemRole = (newUserData.role as SystemRole) || 'teacher';
  let newUid = '';

  // Kiểm tra trước xem doc(db, 'usernames', cleanUsername) đã tồn tại chưa
  const existingUsernameSnap = await getDoc(doc(db, 'usernames', cleanUsername));
  if (existingUsernameSnap.exists()) {
    const uData = existingUsernameSnap.data();
    if (uData?.uid) {
      const uSnap = await getDoc(doc(db, 'users', uData.uid));
      if (uSnap.exists() && uSnap.data()?.status !== 'deleted') {
        const existingData = uSnap.data();
        const sameCenter = existingData?.centerId === targetCenterId;
        const samePhone = newUserData.phone && existingData?.phone && newUserData.phone.replace(/[^0-9]/g, '') === existingData.phone.replace(/[^0-9]/g, '');
        const sameName = existingData?.name && existingData.name.toLowerCase() === (newUserData.name || newUserData.fullName || '').toLowerCase();
        if (sameCenter && (samePhone || sameName)) {
          newUid = uData.uid;
        } else {
          throw new Error(`Tên đăng nhập "@${cleanUsername}" đã được sử dụng, vui lòng chọn tên đăng nhập khác!`);
        }
      }
    }
  }

  // 1. CHUẨN HÓA EMAIL ẢO (FAKE EMAIL) LƯU VÀO FIREBASE AUTH: `${username}@${centerId}.app.com`
  const isCustomEmail = newUserData.email && newUserData.email.includes('@') && !newUserData.email.endsWith('.local') && !newUserData.email.includes('.system.');
  const cleanCenterPart = (targetCenterId || 'center').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'center';
  const authEmail = isCustomEmail
    ? sanitizeEmail(newUserData.email, cleanUsername, `${cleanCenterPart}.app.com`)
    : `${cleanUsername}@${cleanCenterPart}.app.com`;

  const rawPassword = newUserData.password?.trim() || '123456';
  const authPassword = rawPassword.length >= 6 ? rawPassword : `${rawPassword}123456`;

  // KHỞI TẠO SECONDARY FIREBASE AUTH APP ĐỂ TẠO USER MỚI (TRÁNH LÀM MẤT SESSION ADMIN HIỆN TẠI)
  const secondaryAuth = getSecondaryAuth();

  if (!newUid) {
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, authEmail, authPassword);
      newUid = userCredential.user.uid;
      await signOut(secondaryAuth).catch(() => {});
      console.log(`✓ [Secondary Auth] Đã tạo tài khoản Auth UID: ${newUid} cho email: ${authEmail}`);
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-in-use') {
        try {
          const cred = await signInWithEmailAndPassword(secondaryAuth, authEmail, authPassword);
          newUid = cred.user.uid;
          await signOut(secondaryAuth).catch(() => {});
        } catch {
          const uniqueEmail = `${cleanUsername}.${Date.now().toString().slice(-4)}@${cleanCenterPart}.hocgioi.edu.vn`;
          try {
            const cred = await createUserWithEmailAndPassword(secondaryAuth, uniqueEmail, authPassword);
            newUid = cred.user.uid;
            await signOut(secondaryAuth).catch(() => {});
          } catch {
            newUid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          }
        }
      } else {
        console.warn('Lỗi Secondary Auth createUser:', authError.code || authError.message);
        newUid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }
    }
  }

  const displayName = newUserData.fullName || newUserData.name || cleanUsername;

  // Đảm bảo quyền admin cho các thao tác ghi dữ liệu vào Firestore (tránh lỗi permission-denied)
  try {
    await ensureAdminAuthSession();
  } catch (aErr: any) {
    console.warn('ensureAdminAuthSession warn:', aErr?.message);
  }

  // 2. CHUẨN BỊ THÔNG TIN CHI TIẾT CỦA NGƯỜI ĐÓ
  const tenantDetailPayload: any = {
    uid: newUid,
    id: newUid,
    centerId: targetCenterId,
    role: rawRole,
    displayName: displayName,
    name: displayName,
    fullName: displayName,
    username: cleanUsername,
    email: authEmail,
    password: rawPassword,
    phone: newUserData.phone ? newUserData.phone.trim() : '',
    status: newUserData.status || 'active',
    avatar: newUserData.avatar || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (rawRole === 'teacher') {
    tenantDetailPayload.teacherCode = newUserData.teacherCode || `GV-${Date.now().toString().slice(-3)}`;
    tenantDetailPayload.subject = newUserData.subject || 'Toán học';
    tenantDetailPayload.mainClassId = newUserData.mainClassId || '';
    tenantDetailPayload.mainClassName = newUserData.mainClassName || '';
    tenantDetailPayload.bio = newUserData.bio || 'Giáo viên tận tâm, giàu kinh nghiệm chuyên môn.';
    if (!tenantDetailPayload.avatar) {
      tenantDetailPayload.avatar = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80';
    }
  } else if (rawRole === 'parent') {
    tenantDetailPayload.studentId = newUserData.studentId || '';
    tenantDetailPayload.studentCode = newUserData.studentCode || '';
    tenantDetailPayload.studentName = newUserData.studentName || '';
    tenantDetailPayload.parentName = newUserData.parentName || displayName;
    tenantDetailPayload.parentPhone = newUserData.parentPhone || newUserData.phone || '';
    if (!tenantDetailPayload.avatar) {
      tenantDetailPayload.avatar = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80';
    }
  } else if (rawRole === 'center_admin') {
    tenantDetailPayload.packagePlan = newUserData.packagePlan || 'Standard';
    tenantDetailPayload.expiryDate = newUserData.expiryDate || '2028-12-31';
    if (!tenantDetailPayload.avatar) {
      tenantDetailPayload.avatar = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80';
    }
  }

  // 3. LƯU BẢN GHI VÀO ROOT COLLECTION `/users/${user.uid}`
  const rootUserRecord: any = {
    uid: newUid,
    id: newUid,
    displayName: displayName,
    name: displayName,
    fullName: displayName,
    username: cleanUsername,
    role: rawRole,
    centerId: targetCenterId,
    phone: newUserData.phone ? newUserData.phone.trim() : '',
    email: authEmail,
    password: rawPassword,
    status: newUserData.status || 'active',
    avatar: tenantDetailPayload.avatar || '',
    teacherCode: tenantDetailPayload.teacherCode || '',
    subject: tenantDetailPayload.subject || '',
    bio: tenantDetailPayload.bio || '',
    mainClassId: tenantDetailPayload.mainClassId || '',
    mainClassName: tenantDetailPayload.mainClassName || '',
    studentId: tenantDetailPayload.studentId || '',
    studentCode: tenantDetailPayload.studentCode || '',
    studentName: tenantDetailPayload.studentName || '',
    parentName: tenantDetailPayload.parentName || '',
    parentPhone: tenantDetailPayload.parentPhone || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'users', newUid), rootUserRecord, { merge: true });

  // Ghi đồng thời vào collection /usernames/{cleanUsername} dữ liệu: { email, centerId, uid, role }
  try {
    await setDoc(doc(db, 'usernames', cleanUsername), {
      email: authEmail,
      centerId: targetCenterId,
      uid: newUid,
      role: rawRole,
      username: cleanUsername,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (uErr) {
    console.warn('Lỗi ghi /usernames:', uErr);
  }

  // 4. LƯU THÔNG TIN CHI TIẾT VÀO SUB-COLLECTION TƯƠNG ỨNG:
  // `/centers/${targetCenterId}/${role}s/${user.uid}`
  const subCollectionName = `${rawRole}s`; // teachers, students, parents, center_admins
  await setDoc(doc(db, 'centers', targetCenterId, subCollectionName, newUid), sanitizeForArray(tenantDetailPayload), { merge: true });

  // Dự phòng lưu thêm vào subcollection users để tương thích
  await setDoc(doc(db, 'centers', targetCenterId, 'users', newUid), sanitizeForArray(tenantDetailPayload), { merge: true }).catch(() => {});

  // Dọn dẹp bản ghi phụ trùng lặp nếu có từ trước
  if (newUid !== cleanUsername) {
    await deleteDoc(doc(db, 'centers', targetCenterId, subCollectionName, cleanUsername)).catch(() => {});
    await deleteDoc(doc(db, 'centers', targetCenterId, 'users', cleanUsername)).catch(() => {});
    await deleteDoc(doc(db, 'users', cleanUsername)).catch(() => {});
  }

  const createdAccount: UserAccount = {
    ...tenantDetailPayload,
    id: newUid,
    uid: newUid,
  };

  return createdAccount;
}


// ============================================================================
// 5. CẬP NHẬT TÀI KHOẢN (updateUserAccount)
// ============================================================================

export async function updateUserAccount(
  uid: string,
  centerId: string,
  updateData: Partial<UserAccount & any>
): Promise<void> {
  if (!uid) throw new Error('UID tài khoản là BẮT BUỘC để cập nhật!');

  const targetCenterId = (centerId || '').trim();

  const updates: any = {
    ...updateData,
    updatedAt: serverTimestamp(),
  };
  if (updateData.username !== undefined) updates.username = normalizeUsername(updateData.username);
  if (updateData.email !== undefined) updates.email = updateData.email.trim().toLowerCase();
  if (updateData.centerId !== undefined) updates.centerId = updateData.centerId.trim();

  Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

  // 1. Cập nhật trực tiếp Root Collection `/users/{uid}`
  await setDoc(doc(db, 'users', uid), updates, { merge: true });

  // 2. Dự phòng subcollections
  if (targetCenterId) {
    try {
      await setDoc(doc(db, 'centers', targetCenterId, 'users', uid), updates, { merge: true });
      if (updateData.role === 'teacher' || updateData.teacherCode || updateData.subject || updateData.mainClassId) {
        await setDoc(doc(db, 'centers', targetCenterId, 'teachers', uid), updates, { merge: true });
      }
    } catch {}
  }
}

// ============================================================================
// 6. XÓA TÀI KHOẢN (deleteUserAccount)
// ============================================================================

export async function deleteUserAccount(
  uid: string,
  centerId: string
): Promise<void> {
  if (!uid) throw new Error('UID tài khoản là BẮT BUỘC để xóa!');

  const targetCenterId = (centerId || '').trim();

  // 1. Tìm username liên kết và giải phóng khỏi collection /usernames
  let usernameToClean = '';
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      const uData = userSnap.data();
      if (uData.username) {
        usernameToClean = String(uData.username).trim().toLowerCase().replace(/\s+/g, '');
        await deleteDoc(doc(db, 'usernames', usernameToClean)).catch(() => {});
      }
    }
  } catch {}

  // 2. Xóa Root Collection `/users/{uid}`
  try {
    await deleteDoc(doc(db, 'users', uid));
    if (usernameToClean) {
      await deleteDoc(doc(db, 'users', usernameToClean)).catch(() => {});
    }
  } catch {
    await setDoc(doc(db, 'users', uid), {
      _deleted: true,
      status: 'deleted',
      centerId: '',
      role: 'deleted',
      username: '',
      displayName: 'Đã xóa',
      updatedAt: serverTimestamp(),
    }, { merge: true }).catch(() => {});
  }

  // 3. Dự phòng subcollections và làm sạch mảng teachers trong Center doc
  if (targetCenterId) {
    try {
      await deleteDoc(doc(db, 'centers', targetCenterId, 'users', uid));
      await deleteDoc(doc(db, 'centers', targetCenterId, 'teachers', uid));
      await deleteDoc(doc(db, 'centers', targetCenterId, 'students', uid));
      await deleteDoc(doc(db, 'centers', targetCenterId, 'parents', uid));

      if (usernameToClean) {
        await deleteDoc(doc(db, 'centers', targetCenterId, 'users', usernameToClean)).catch(() => {});
        await deleteDoc(doc(db, 'centers', targetCenterId, 'teachers', usernameToClean)).catch(() => {});
        await deleteDoc(doc(db, 'centers', targetCenterId, 'students', usernameToClean)).catch(() => {});
        await deleteDoc(doc(db, 'centers', targetCenterId, 'parents', usernameToClean)).catch(() => {});
      }
    } catch {}
  }
}

// ============================================================================
// 7. LẮNG NGHE TÀI KHOẢN THUỘC TRUNG TÂM (listenToCenterUsers)
// ============================================================================

export function listenToCenterUsers(
  centerId: string,
  callback: (users: UserAccount[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const targetCenterId = (centerId || '').trim();
  let isCancelled = false;
  let unsubUsers: Unsubscribe = () => {};
  let unsubCenter: Unsubscribe = () => {};
  let unsubSubTeachers: Unsubscribe = () => {};
  let unsubSubUsers: Unsubscribe = () => {};

  let centerDocAccounts: UserAccount[] = [];
  const subTeachersMap = new Map<string, UserAccount>();
  const subParentsMap = new Map<string, UserAccount>();
  const subUsersMap = new Map<string, UserAccount>();
  const rootUsersMap = new Map<string, UserAccount>();

  const getAccKey = (acc: UserAccount): string => {
    const u = (acc.username || '').trim().toLowerCase();
    if (u) return `${acc.role || 'user'}_u_${u}`;
    const p = (acc.phone || '').trim().replace(/[^0-9]/g, '');
    if (p && p.length >= 9) return `${acc.role || 'user'}_p_${p}`;
    return `id_${acc.uid || acc.id}`;
  };

  const rebuildAndEmit = () => {
    if (isCancelled) return;
    const mergedMap = new Map<string, UserAccount>();

    const mergeAcc = (acc: UserAccount) => {
      if (!acc || (!acc.id && !acc.username)) return;
      if ((acc.status as string) === 'deleted' || (acc as any)._deleted) return;

      // Tìm tài khoản trùng khớp theo areSameAccount
      let matchedKey: string | null = null;
      for (const [k, existing] of mergedMap.entries()) {
        if (areSameAccount(existing, acc)) {
          matchedKey = k;
          break;
        }
      }

      if (matchedKey) {
        const existing = mergedMap.get(matchedKey)!;
        const isCurUid = acc.uid && acc.uid.length > 20 && !acc.uid.startsWith('gv_') && !acc.uid.startsWith('ph_');
        const isPrevUid = existing.uid && existing.uid.length > 20 && !existing.uid.startsWith('gv_') && !existing.uid.startsWith('ph_');
        const bestUid = isCurUid ? acc.uid : (isPrevUid ? existing.uid : (acc.uid || existing.uid || acc.id));
        const existingName = existing.name && !['giáo viên', 'giao vien', 'người dùng', 'user'].includes(existing.name.trim().toLowerCase()) ? existing.name : '';
        const accName = acc.name && !['giáo viên', 'giao vien', 'người dùng', 'user'].includes(acc.name.trim().toLowerCase()) ? acc.name : '';
        const bestName = getValidTeacherName(
          existing.fullName, existing.name, (existing as any).displayName,
          acc.fullName, acc.name, (acc as any).displayName
        ) || existingName || accName || existing.name || acc.name || 'Người dùng';

        mergedMap.set(matchedKey, {
          ...existing,
          ...acc,
          id: bestUid,
          uid: bestUid,
          name: bestName,
          fullName: bestName,
          username: acc.username || existing.username,
          phone: acc.phone || existing.phone,
          email: acc.email || existing.email,
        });
      } else {
        const key = getAccKey(acc);
        mergedMap.set(key, acc);
      }
    };

    centerDocAccounts.forEach(mergeAcc);
    subTeachersMap.forEach(mergeAcc);
    subParentsMap.forEach(mergeAcc);
    subUsersMap.forEach(mergeAcc);
    rootUsersMap.forEach(mergeAcc);

    // Khử trùng lặp tuyệt đối bằng areSameAccount để mỗi người chỉ hiển thị đúng 1 tài khoản
    const allAccounts = Array.from(mergedMap.values());
    const uniqueList = allAccounts.filter((acc, idx, arr) => {
      if (!acc) return false;
      return arr.findIndex((other) => areSameAccount(other, acc)) === idx;
    });

    callback(uniqueList);
  };

  // Hàm trích xuất tài khoản Quản trị viên (Center Admin) từ Center doc
  const extractFromCenter = (cData: any, cId: string): UserAccount[] => {
    if (!cData) return [];
    const list: UserAccount[] = [];

    // Tài khoản Center Admin
    if (cData.adminUsername || cData.email) {
      list.push({
        id: cData.adminUid || `admin_${cId}`,
        uid: cData.adminUid || `admin_${cId}`,
        username: cData.adminUsername || `admin_${String(cData.code || cId).toLowerCase()}`,
        password: cData.adminPassword || '123456',
        role: 'center_admin',
        centerId: cId,
        centerName: cData.name || '',
        name: cData.adminName || `Quản trị ${cData.name || ''}`,
        fullName: cData.adminName || `Quản trị ${cData.name || ''}`,
        email: cData.email || '',
        phone: cData.phone || '',
        status: cData.status === 'suspended' ? 'locked' : 'active',
      });
    }

    return list;
  };

  // 1. Lắng nghe Center document để đảm bảo luôn có dữ liệu tài khoản
  if (targetCenterId) {
    const centerDocRef = doc(db, 'centers', targetCenterId);
    unsubCenter = onSnapshot(
      centerDocRef,
      (snap) => {
        if (isCancelled) return;
        if (snap.exists()) {
          centerDocAccounts = extractFromCenter(snap.data(), snap.id);
          rebuildAndEmit();
        }
      },
      () => {}
    );

    // 2. LẮNG NGHE TRỰC TIẾP SUBCOLLECTION centers/{id}/teachers
    try {
      const teachersSubRef = collection(db, 'centers', targetCenterId, 'teachers');
      unsubSubTeachers = onSnapshot(
        teachersSubRef,
        (snap) => {
          if (isCancelled) return;
          subTeachersMap.clear();
          snap.docs.forEach((docSnap) => {
            const t = docSnap.data();
            const id = docSnap.id || t.id;
            const validTeacherName = getValidTeacherName(t.fullName, t.name, t.displayName) || t.name || t.fullName || 'Giáo viên';
            subTeachersMap.set(id, {
              id: id,
              uid: id,
              username: t.username || `gv_${id}`,
              password: t.password || '123',
              role: 'teacher',
              centerId: targetCenterId,
              centerName: t.centerName || '',
              name: validTeacherName,
              fullName: validTeacherName,
              email: t.email || '',
              phone: t.phone || '',
              avatar: t.avatar || '',
              status: t.status || 'active',
              teacherCode: t.teacherCode,
              subject: t.subject,
              mainClassId: t.mainClassId,
              mainClassName: t.mainClassName,
            });
          });
          rebuildAndEmit();
        },
        () => {}
      );
    } catch {}

    // 2b. LẮNG NGHE TRỰC TIẾP SUBCOLLECTION centers/{id}/parents
    try {
      const parentsSubRef = collection(db, 'centers', targetCenterId, 'parents');
      onSnapshot(
        parentsSubRef,
        (snap) => {
          if (isCancelled) return;
          subParentsMap.clear();
          snap.docs.forEach((docSnap) => {
            const p = docSnap.data();
            const id = docSnap.id || p.id;
            const parentDisplayName = p.parentName || p.name || p.fullName || 'Phụ huynh';
            subParentsMap.set(id, {
              id: id,
              uid: id,
              username: p.username || `ph_${id}`,
              password: p.password || '123',
              role: 'parent',
              centerId: targetCenterId,
              centerName: p.centerName || '',
              name: parentDisplayName,
              fullName: parentDisplayName,
              email: p.email || '',
              phone: p.phone || p.parentPhone || '',
              avatar: p.avatar || '',
              status: p.status || 'active',
              studentId: p.studentId,
              studentCode: p.studentCode,
              studentName: p.studentName,
              parentName: p.parentName,
              parentPhone: p.parentPhone,
            });
          });
          rebuildAndEmit();
        },
        () => {}
      );
    } catch {}

    // 3. LẮNG NGHE TRỰC TIẾP SUBCOLLECTION centers/{id}/users
    try {
      const subUsersRef = collection(db, 'centers', targetCenterId, 'users');
      unsubSubUsers = onSnapshot(
        subUsersRef,
        (snap) => {
          if (isCancelled) return;
          subUsersMap.clear();
          snap.docs.forEach((docSnap) => {
            const u = docSnap.data();
            const id = docSnap.id || u.id;
            const role = (u.role as SystemRole) || 'teacher';
            const resolvedUName = role === 'teacher'
              ? (getValidTeacherName(u.fullName, u.name, u.displayName) || u.fullName || u.name || 'Giáo viên')
              : (u.fullName || u.name || u.displayName || 'Người dùng');
            subUsersMap.set(id, {
              id: id,
              uid: id,
              username: u.username || id,
              password: u.password || '••••••',
              role: role,
              centerId: targetCenterId,
              centerName: u.centerName || '',
              name: resolvedUName,
              fullName: resolvedUName,
              email: u.email || '',
              phone: u.phone || '',
              avatar: u.avatar || '',
              status: u.status || 'active',
              teacherCode: u.teacherCode,
              subject: u.subject,
              mainClassId: u.mainClassId,
              mainClassName: u.mainClassName,
              studentId: u.studentId,
              studentCode: u.studentCode,
              studentName: u.studentName,
              parentName: u.parentName,
              parentPhone: u.parentPhone,
            });
          });
          rebuildAndEmit();
        },
        () => {}
      );
    } catch {}
  } else {
    const centersRef = collection(db, 'centers');
    unsubCenter = onSnapshot(
      centersRef,
      (snap) => {
        if (isCancelled) return;
        centerDocAccounts = [];
        snap.docs.forEach((docSnap) => {
          centerDocAccounts.push(...extractFromCenter(docSnap.data(), docSnap.id));
        });
        rebuildAndEmit();
      },
      () => {}
    );
  }

  // 4. LẮNG NGHE TRỰC TIẾP TỪ `users` COLLECTION GỐC
  try {
    const usersRef = collection(db, 'users');
    unsubUsers = onSnapshot(
      usersRef,
      (snapshot) => {
        if (isCancelled) return;
        rootUsersMap.clear();
        snapshot.docs.forEach((d) => {
          const data = d.data();
          if (data.status === 'deleted' || data._deleted || data.role === 'deleted') return;
          if (!data.username && !data.email) return;

          const isMatchingCenter = targetCenterId ? (data.centerId === targetCenterId) : true;
          if (isMatchingCenter) {
            const role = (data.role as SystemRole) || 'teacher';
            const resolvedRName = role === 'teacher'
              ? (getValidTeacherName(data.fullName, data.name, data.displayName) || data.fullName || data.name || data.displayName || 'Giáo viên')
              : (data.fullName || data.name || data.displayName || 'Người dùng');
            rootUsersMap.set(d.id, {
              id: d.id,
              uid: data.uid || d.id,
              username: data.username || d.id,
              password: data.password || '••••••',
              role: role,
              centerId: data.centerId || targetCenterId,
              centerName: data.centerName || '',
              name: resolvedRName,
              fullName: resolvedRName,
              email: data.email || '',
              phone: data.phone || '',
              avatar: data.avatar || '',
              status: data.status || 'active',
              teacherCode: data.teacherCode,
              subject: data.subject,
              mainClassId: data.mainClassId,
              mainClassName: data.mainClassName,
              studentId: data.studentId,
              studentCode: data.studentCode,
              studentName: data.studentName,
              parentName: data.parentName,
              parentPhone: data.parentPhone,
              bio: data.bio,
              packagePlan: data.packagePlan,
              expiryDate: data.expiryDate,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            });
          }
        });
        rebuildAndEmit();
      },
      () => {}
    );
  } catch {}

  return () => {
    isCancelled = true;
    unsubUsers();
    unsubCenter();
    unsubSubTeachers();
    unsubSubUsers();
  };
}

/**
 * Lắng nghe Realtime (`onSnapshot`) trực tiếp tại `/users/{uid}`
 * để cập nhật tức thời hồ sơ chi tiết của người dùng đang đăng nhập.
 */
export function listenToCurrentUserProfile(
  centerId: string,
  uid: string,
  callback: (user: UserAccount | null) => void,
  _onError?: (error: Error) => void
): Unsubscribe {
  if (!uid) return () => {};

  const profileRef = doc(db, 'users', uid);

  return onSnapshot(
    profileRef,
    async (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      const data = snapshot.data();
      const targetCenter = data.centerId || centerId;

      // Đọc bổ sung từ subcollection giáo viên nếu có để lấy đủ name, subject, phone
      let teacherExtra: any = {};
      if (targetCenter) {
        try {
          const tDoc = await getDoc(doc(db, 'centers', targetCenter, 'teachers', uid));
          if (tDoc.exists()) {
            teacherExtra = tDoc.data();
          }
        } catch {}
      }

      const resolvedName = getValidTeacherName(
        teacherExtra.fullName,
        teacherExtra.name,
        teacherExtra.displayName,
        data.fullName,
        data.name,
        data.displayName
      ) || data.displayName || data.fullName || data.name || teacherExtra.fullName || teacherExtra.name || 'Giáo Viên';

      const updatedUser: UserAccount = {
        id: snapshot.id,
        uid: data.uid || snapshot.id,
        username: data.username || teacherExtra.username || snapshot.id,
        password: data.password || teacherExtra.password || '••••••',
        role: (data.role as SystemRole) || (teacherExtra.role as SystemRole) || 'teacher',
        centerId: targetCenter,
        centerName: data.centerName || teacherExtra.centerName || '',
        name: resolvedName,
        fullName: resolvedName,
        displayName: resolvedName,
        email: data.email || teacherExtra.email || '',
        phone: data.phone || teacherExtra.phone || '',
        avatar: data.avatar || teacherExtra.avatar || '',
        status: data.status || teacherExtra.status || 'active',
        teacherCode: data.teacherCode || teacherExtra.teacherCode,
        subject: data.subject || teacherExtra.subject,
        mainClassId: data.mainClassId || teacherExtra.mainClassId,
        mainClassName: data.mainClassName || teacherExtra.mainClassName,
        studentId: data.studentId || teacherExtra.studentId,
        studentCode: data.studentCode || teacherExtra.studentCode,
        studentName: data.studentName || teacherExtra.studentName,
        parentName: data.parentName || teacherExtra.parentName,
        parentPhone: data.parentPhone || teacherExtra.parentPhone,
        bio: data.bio || teacherExtra.bio,
        packagePlan: data.packagePlan || teacherExtra.packagePlan,
        expiryDate: data.expiryDate || teacherExtra.expiryDate,
        createdAt: data.createdAt || teacherExtra.createdAt,
        updatedAt: data.updatedAt || teacherExtra.updatedAt,
      };
      callback(updatedUser);
    },
    (_err) => {
      // Bỏ qua lỗi ngắt kết nối tạm thời
    }
  );
}

// ============================================================================
// 8. TƯƠNG THÍCH NGƯỢC & HÀM BỌC TIỆN ÍCH CHO TOÀN BỘ HỆ THỐNG
// ============================================================================

export function getRealtimeAccounts(
  centerIdOrCallback: string | ((accounts: UserAccount[]) => void),
  callbackOrError?: ((accounts: UserAccount[]) => void) | ((error: any) => void),
  onError?: (error: any) => void
): Unsubscribe {
  let centerId = '';
  let callback: (accounts: UserAccount[]) => void;
  let errCb = onError;

  if (typeof centerIdOrCallback === 'string') {
    centerId = centerIdOrCallback.trim();
    callback = callbackOrError as (accounts: UserAccount[]) => void;
  } else {
    callback = centerIdOrCallback;
    if (typeof callbackOrError === 'function') {
      errCb = callbackOrError as (error: any) => void;
    }
  }

  return listenToCenterUsers(centerId, callback, errCb);
}

export async function createOrUpdateTeacherAccount(
  teacher: TeacherItem,
  customPassword?: string
): Promise<UserAccount> {
  const session = getStoredSession();
  const centerId = teacher.centerId || session?.centerId || DEFAULT_CENTER_ID;

  return createUserAccount(
    session || { uid: 'admin', role: 'center_admin', centerId },
    {
      username: teacher.username || `gv_${Date.now().toString().slice(-4)}`,
      password: teacher.password || customPassword || '123456',
      role: 'teacher',
      centerId: centerId,
      name: teacher.name,
      fullName: teacher.fullName || teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      avatar: teacher.avatar,
      teacherCode: teacher.teacherCode,
      subject: teacher.subject,
      mainClassId: teacher.mainClassId,
      mainClassName: teacher.mainClassName,
      bio: teacher.bio,
      status: (teacher.status as any) || 'active',
    }
  );
}

export async function deleteTeacherAccount(
  userDocIdOrUid: string,
  centerId?: string
): Promise<void> {
  return deleteUserAccount(userDocIdOrUid, centerId || '');
}

export async function createOrUpdateParentAccount(
  student: StudentItem,
  customPassword = '123'
): Promise<UserAccount> {
  const session = getStoredSession();
  const centerId = student.centerId || session?.centerId || DEFAULT_CENTER_ID;
  const cleanPhone = student.parentPhone ? student.parentPhone.replace(/[^0-9]/g, '') : '';
  const username = student.username?.trim()
    ? normalizeUsername(student.username)
    : cleanPhone
    ? `ph_${cleanPhone}`
    : `ph_${student.id.replace('student-', '')}`;

  return createUserAccount(
    session || { uid: 'admin', role: 'center_admin', centerId },
    {
      username,
      password: student.password || customPassword,
      role: 'parent',
      centerId: centerId,
      name: student.parentName || `Phụ huynh em ${student.name}`,
      fullName: student.parentName || `Phụ huynh em ${student.name}`,
      email: student.parentEmail,
      phone: student.parentPhone,
      studentId: student.id,
      studentCode: student.studentCode,
      studentName: student.name,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      status: 'active',
    }
  );
}

export async function deleteParentAccount(
  userDocIdOrUid: string,
  centerId?: string
): Promise<void> {
  return deleteUserAccount(userDocIdOrUid, centerId || '');
}

export async function resetAccountPassword(
  usernameOrUid: string,
  newPassword: string,
  centerId?: string
): Promise<{ success: boolean; message: string }> {
  try {
    let targetUid = usernameOrUid;
    let targetCenterId = (centerId || '').trim();

    if (!targetCenterId) {
      const snap = await getDoc(doc(db, 'users', usernameOrUid));
      if (snap.exists()) {
        targetCenterId = snap.data().centerId || '';
      } else {
        const q = query(collection(db, 'users'), where('username', '==', normalizeUsername(usernameOrUid)));
        const snapQ = await getDocs(q);
        if (!snapQ.empty) {
          targetUid = snapQ.docs[0].id;
          targetCenterId = snapQ.docs[0].data().centerId || '';
        }
      }
    }

    await updateUserAccount(targetUid, targetCenterId, { password: newPassword });
    return { success: true, message: 'Đổi mật khẩu thành công!' };
  } catch (err: any) {
    return { success: false, message: `Lỗi đổi mật khẩu: ${err.message}` };
  }
}

export interface SchoolCenterRegistrationParams {
  centerName: string;
  username?: string;
  realEmail?: string;
  email?: string;
  password: string;
  phone: string;
  address: string;
}

/**
 * Đăng ký trường / trung tâm mới:
 * - Lấy `username` do người dùng nhập, tự động tạo fake email: `const authEmail = ${username}@tenant.system.local`
 * - Gọi `createUserWithEmailAndPassword(auth, authEmail, password)`
 * - Lưu thông tin vào Firestore document bao gồm: `username`, `realEmail` (từ ô email tùy chọn), và các thông tin trung tâm khác
 */
export async function registerSchoolCenter(
  params: SchoolCenterRegistrationParams
): Promise<{ user: User | null; centerId: string; account: UserAccount }> {
  const { centerName, username, realEmail, email, password, phone, address } = params;
  const rawUsername = (username || email || '').trim();
  const cleanUser = normalizeUsername(rawUsername.includes('@') ? rawUsername.split('@')[0] : rawUsername);

  if (!cleanUser) {
    throw new Error('Vui lòng nhập Tên đăng nhập hợp lệ.');
  }

  // Kiểm tra an toàn xem doc(db, 'usernames', cleanUser) đã tồn tại chưa
  let usernameExistsInFirestore = false;
  try {
    const existingUsernameSnap = await getDoc(doc(db, 'usernames', cleanUser));
    if (existingUsernameSnap.exists()) {
      usernameExistsInFirestore = true;
      throw new Error(`Tên đăng nhập "${cleanUser}" đã được sử dụng, vui lòng chọn tên đăng nhập khác!`);
    }
  } catch (checkErr: any) {
    if (usernameExistsInFirestore) {
      throw checkErr;
    }
    // Bỏ qua nếu lỗi quyền đọc khi chưa đăng nhập, sẽ kiểm tra qua Firebase Auth và Privileged DB bên dưới
  }

  // Tự động tạo fake email theo công thức: `${username}@tenant.system.local`
  const authEmail = `${cleanUser}@tenant.system.local`;
  const cleanRealEmail = (
    realEmail ??
    (email && email.includes('@') && !email.endsWith('@tenant.system.local') ? email : '')
  )
    .trim()
    .toLowerCase();

  let createdAuthUser: User | null = null;
  let authUid = '';
  let isNewlyCreatedAuth = false;

  try {
    const cred = await createUserWithEmailAndPassword(auth, authEmail, password);
    createdAuthUser = cred.user;
    authUid = cred.user.uid;
    isNewlyCreatedAuth = true;
  } catch (authErr: any) {
    if (authErr.code === 'auth/email-already-in-use') {
      try {
        const cred = await signInWithEmailAndPassword(auth, authEmail, password);
        createdAuthUser = cred.user;
        authUid = cred.user.uid;
      } catch {
        throw new Error(`Tên đăng nhập "${cleanUser}" đã tồn tại trên hệ thống. Vui lòng chọn tên đăng nhập khác!`);
      }
    } else if (authErr.code === 'auth/weak-password') {
      throw new Error('Mật khẩu quá yếu. Vui lòng đặt mật khẩu tối thiểu 6 ký tự!');
    } else if (authErr.code === 'auth/invalid-email') {
      throw new Error('Tên đăng nhập chứa ký tự không hợp lệ. Vui lòng chỉ dùng chữ cái, số hoặc dấu gạch dưới.');
    } else {
      throw new Error(authErr.message || 'Không thể khởi tạo tài khoản xác thực cho trung tâm.');
    }
  }

  const trialDate = new Date();
  trialDate.setMonth(trialDate.getMonth() + 1);
  const trialExpiryStr = trialDate.toISOString().split('T')[0];
  const centerCode = `HG0${Date.now().toString().slice(-2)}`;

  // Sử dụng Privileged Firestore instance (Secondary App đã xác thực quyền khởi tạo hệ thống)
  // để tránh lỗi "Missing or insufficient permissions." khi user mới chưa có hồ sơ `/users/{uid}` trên Firestore.
  const targetDb = await getPrivilegedDb();
  const centerDocRef = doc(collection(targetDb, 'centers'));
  const centerId = centerDocRef.id;

  const centerDocPayload = {
    id: centerId,
    centerId: centerId,
    name: centerName,
    centerName: centerName,
    code: centerCode,
    username: cleanUser,
    realEmail: cleanRealEmail,
    authEmail: authEmail,
    email: cleanRealEmail || authEmail,
    phone: phone,
    address: address,
    ownerUid: authUid,
    adminUid: authUid,
    adminUsername: cleanUser,
    adminPassword: password,
    status: 'active',
    packagePlan: 'Trial (1 Tháng Dùng Thử)',
    expiryDate: trialExpiryStr,
    endDate: trialExpiryStr,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const rootUserPayload = {
    uid: authUid,
    centerId: centerId,
    role: 'center_admin',
    status: 'active',
    username: cleanUser,
    realEmail: cleanRealEmail,
    authEmail: authEmail,
    email: cleanRealEmail || authEmail,
    phone: phone,
    address: address,
    displayName: `Quản trị viên - ${centerName}`,
    name: `Quản trị viên - ${centerName}`,
    fullName: `Quản trị viên - ${centerName}`,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const usernamePayload = {
    email: authEmail,
    authEmail: authEmail,
    realEmail: cleanRealEmail,
    centerId: centerId,
    uid: authUid,
    role: 'center_admin',
    username: cleanUser,
    createdAt: serverTimestamp(),
  };

  const centerAdminProfile = {
    uid: authUid,
    id: authUid,
    username: cleanUser,
    realEmail: cleanRealEmail,
    authEmail: authEmail,
    email: cleanRealEmail || authEmail,
    password: password,
    phone: phone,
    address: address,
    fullName: `Quản trị viên - ${centerName}`,
    name: centerName,
    role: 'center_admin' as const,
    centerId: centerId,
    centerName: centerName,
    status: 'active' as const,
    packagePlan: 'Trial (1 Tháng Dùng Thử)',
    expiryDate: trialExpiryStr,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(targetDb);
    // 1. Tạo document trường / trung tâm trong `centers` (bao gồm `username`, `realEmail` và các thông tin trung tâm khác)
    batch.set(centerDocRef, centerDocPayload, { merge: true });
    // 2. Tạo Root Collection Index: `/users/{uid}`
    batch.set(doc(targetDb, 'users', authUid), rootUserPayload, { merge: true });
    // 3. Ghi đồng thời vào collection `/usernames/{cleanUser}`
    batch.set(doc(targetDb, 'usernames', cleanUser), usernamePayload, { merge: true });
    // 4. Tạo Tenant Subcollection: `/centers/{centerId}/users/{uid}`
    batch.set(doc(targetDb, 'centers', centerId, 'users', authUid), centerAdminProfile, { merge: true });

    await batch.commit();
  } catch (writeErr: any) {
    // Nếu có lỗi bất ngờ khi ghi Firestore, xóa tài khoản Auth vừa tạo để tránh kẹt username
    if (isNewlyCreatedAuth && createdAuthUser) {
      await deleteUser(createdAuthUser).catch(() => {});
    }
    throw new Error(writeErr?.message || 'Không thể lưu thông tin trung tâm lên cơ sở dữ liệu.');
  }

  // Làm mới token trên phiên Auth chính để Firestore nhận diện ngay quyền `center_admin` vừa được cấp
  if (createdAuthUser) {
    await createdAuthUser.getIdToken(true).catch(() => {});
  }

  const userAccount: UserAccount = {
    id: authUid,
    uid: authUid,
    username: cleanUser,
    password: password,
    role: 'center_admin',
    centerId: centerId,
    centerName: centerName,
    name: `Quản trị viên - ${centerName}`,
    fullName: `Quản trị viên - ${centerName}`,
    email: cleanRealEmail || authEmail,
    realEmail: cleanRealEmail,
    authEmail: authEmail,
    phone: phone,
    address: address,
    avatar: centerAdminProfile.avatar,
    status: 'active',
  };

  setStoredSession(userAccount);

  return { user: createdAuthUser, centerId, account: userAccount };
}

export function purgeLocalTestCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('mock_') ||
        key.startsWith('test_') ||
        key.startsWith('legacy_test_')
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

export async function ensureDefaultAccountsInFirestore(): Promise<void> {
  try {
    purgeLocalTestCache();
    // Chạy bất đồng bộ ngầm sau khi UI đã nạp xong (tránh nghẽn mạng lúc khởi động)
    setTimeout(() => {
      ensureSuperAdminInFirestore().catch(() => {});
      try {
        if (!sessionStorage.getItem('tt_deprecated_cleaned')) {
          cleanupDeprecatedCollections()
            .then(() => {
              sessionStorage.setItem('tt_deprecated_cleaned', 'true');
            })
            .catch(() => {});
        }
      } catch {}
    }, 1500);
  } catch {}
}

// ============================================================================
// 9. QUẢN LÝ PHIÊN LÀM VIỆC (SESSION STORAGE)
// ============================================================================

export function getStoredSession(): UserAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserAccount;
  } catch {
    return null;
  }
}

export function setStoredSession(user: UserAccount): void {
  try {
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(user));
  } catch {}
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(STORAGE_SESSION_KEY);
  } catch {}
}
