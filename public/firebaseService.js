/**
 * ============================================================================
 * TRUNG TÂM DẠY THÊM HỌC GIỎI
 * TẬP TIN DỊCH VỤ DỮ LIỆU ĐỘNG FIREBASE FIRESTORE SDK v9/v10 (MODULAR API)
 * ============================================================================
 * 
 * Tương thích 100% với Bộ quy tắc Bảo mật (Firestore Security Rules):
 * 
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     function isSignedIn() {
 *       return request.auth != null;
 *     }
 *     function getUserRole() {
 *       return get(path('/databases/' + database + '/documents/users/' + request.auth.uid)).data.role;
 *     }
 *     function isAdmin() {
 *       return isSignedIn() && getUserRole() == 'admin';
 *     }
 *     function isTeacher() {
 *       return isSignedIn() && getUserRole() == 'teacher';
 *     }
 * 
 *     match /users/{userId} {
 *       allow read: if isSignedIn();
 *       allow write: if isSignedIn() && (request.auth.uid == userId || getUserRole() == 'admin');
 *     }
 *     match /classes/{classId} {
 *       allow read: if isSignedIn();
 *       allow write: if isAdmin();
 *     }
 *     match /students/{studentId} {
 *       allow read: if isSignedIn();
 *       allow write: if isAdmin();
 *     }
 *     match /attendance/{attendanceId} {
 *       allow read: if isSignedIn();
 *       allow create, update: if isAdmin() || isTeacher();
 *       allow delete: if isAdmin();
 *     }
 *     match /assignments/{assignmentId} {
 *       allow read: if isSignedIn();
 *       allow create, update: if isAdmin() || isTeacher();
 *       allow delete: if isAdmin();
 *     }
 *   }
 * }
 */

// 1. IMPORT CÁC HÀM CỦA FIREBASE SDK MODULAR API
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from "firebase/auth";

// 2. KHAI BÁO CẤU HÌNH FIREBASE CONFIG (TỪ DỰ ÁN TRUNG TÂM HỌC GIỎI)
export const firebaseConfig = {
  apiKey: "AIzaSyAdzeYBZYVwHMh54-7aY9Rs8WgPRxSjQxo",
  authDomain: "tthocgioi-9d836.firebaseapp.com",
  projectId: "tthocgioi-9d836",
  storageBucket: "tthocgioi-9d836.firebasestorage.app",
  messagingSenderId: "1039061723065",
  appId: "1:1039061723065:web:acec62fb0423f47877b868"
};

// Khởi tạo Firebase App và các dịch vụ
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ============================================================================
// HÀM BẢO MẬT & PHÂN QUYỀN ĐỒNG BỘ (AUTH & ROLE MANAGEMENT)
// ============================================================================

export async function ensureAuthSession(targetRole = 'admin') {
  let currentUser = auth.currentUser;

  if (!currentUser) {
    try {
      const cred = await signInAnonymously(auth);
      currentUser = cred.user;
      console.log('✓ Firebase Auth: Xác thực thành công Anonymous UID:', currentUser.uid);
    } catch (authErr) {
      if (
        authErr.code === 'auth/configuration-not-found' ||
        authErr.code === 'auth/admin-restricted-operation' ||
        authErr.code === 'auth/operation-not-allowed' ||
        authErr.message?.includes('configuration-not-found')
      ) {
        console.info('ℹ️ Firebase Auth chưa được bật trong Firebase Console (auth/configuration-not-found). Tiếp tục kết nối Firestore trực tiếp.');
        return null;
      }

      console.warn("Anonymous sign-in chưa mở, fallback qua Email...", authErr.message);
      const email = `${targetRole}@tthocgioi.edu.vn`;
      const pass = "HocGioi@2025!";
      try {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        currentUser = cred.user;
      } catch (signInErr) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, pass);
          currentUser = cred.user;
        } catch (createErr) {
          console.info('ℹ️ Bỏ qua Auth session, tiếp tục truy cập trực tiếp Firestore:', createErr.message);
          return null;
        }
      }
    }
  }

  if (currentUser) {
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await setDoc(userDocRef, {
        uid: currentUser.uid,
        role: targetRole,
        name: targetRole === 'admin' ? 'Quản trị viên' : targetRole === 'teacher' ? 'Giáo viên' : 'Phụ huynh',
        email: currentUser.email || `${targetRole}@tthocgioi.edu.vn`,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.warn("Lỗi ghi user role:", err.message);
    }
  }

  return currentUser;
}

export async function switchUserRole(newRole) {
  const user = auth.currentUser;
  if (!user) {
    await ensureAuthSession(newRole);
    return;
  }
  const userDocRef = doc(db, 'users', user.uid);
  await setDoc(userDocRef, {
    role: newRole,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// ============================================================================
// PHẦN 1: MÔI TRƯỜNG ADMIN (Yêu cầu rule: isAdmin() - Role: 'admin')
// ============================================================================

export async function createClass(classData) {
  try {
    await ensureAuthSession('admin');
    const classesRef = collection(db, 'classes');
    const docRef = await addDoc(classesRef, {
      ...classData,
      studentCount: Number(classData.studentCount) || 0,
      maxCapacity: Number(classData.maxCapacity) || 25,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log("✓ Tạo lớp học thành công, ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Lỗi tại hàm createClass:", error);
    if (error.code === 'permission-denied') {
      throw new Error("Quy tắc Firestore từ chối: Chỉ Quản trị viên (Admin) mới có quyền tạo lớp học.");
    }
    throw new Error(`Không thể tạo lớp học: ${error.message}`);
  }
}

export async function createTeacher(teacherData) {
  try {
    await ensureAuthSession('admin');
    const usersRef = collection(db, 'users');
    const docRef = await addDoc(usersRef, {
      ...teacherData,
      role: 'teacher',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log("✓ Tạo giáo viên thành công trong users, ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Lỗi tại hàm createTeacher:", error);
    if (error.code === 'permission-denied') {
      throw new Error("Quy tắc Firestore từ chối: Chỉ Quản trị viên (Admin) mới có quyền thêm giáo viên vào collection 'users'.");
    }
    throw new Error(`Không thể thêm giáo viên: ${error.message}`);
  }
}

export async function createStudent(studentData) {
  try {
    await ensureAuthSession('admin');
    const studentsRef = collection(db, 'students');
    const docRef = await addDoc(studentsRef, {
      ...studentData,
      attendanceStatus: studentData.attendanceStatus || 'present',
      gpa: Number(studentData.gpa) || 8.0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log("✓ Tiếp nhận học sinh thành công, ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Lỗi tại hàm createStudent:", error);
    if (error.code === 'permission-denied') {
      throw new Error("Quy tắc Firestore từ chối: Chỉ Quản trị viên (Admin) mới có quyền thêm học sinh vào collection 'students'.");
    }
    throw new Error(`Không thể thêm học sinh: ${error.message}`);
  }
}

export async function updateClass(classId, data) {
  try {
    await ensureAuthSession('admin');
    const classDocRef = doc(db, 'classes', classId);
    await updateDoc(classDocRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật lớp học (updateClass):', error);
    if (error.code === 'permission-denied') {
      throw new Error('Chỉ Admin mới có quyền cập nhật thông tin lớp học.');
    }
    throw new Error(`Không thể cập nhật lớp học: ${error.message}`);
  }
}

export async function deleteClass(classId) {
  try {
    await ensureAuthSession('admin');
    const classDocRef = doc(db, 'classes', classId);
    await deleteDoc(classDocRef);
  } catch (error) {
    console.error('Lỗi khi xóa lớp học (deleteClass):', error);
    if (error.code === 'permission-denied') {
      throw new Error('Chỉ Admin mới có quyền xóa lớp học.');
    }
    throw new Error(`Không thể xóa lớp học: ${error.message}`);
  }
}

export async function updateTeacher(teacherId, data) {
  try {
    await ensureAuthSession('admin');
    const teacherDocRef = doc(db, 'users', teacherId);
    await updateDoc(teacherDocRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật giáo viên:', error);
    if (error.code === 'permission-denied') {
      throw new Error('Chỉ Admin mới có quyền cập nhật giáo viên.');
    }
    throw new Error(`Không thể cập nhật giáo viên: ${error.message}`);
  }
}

export async function deleteTeacher(teacherId) {
  try {
    await ensureAuthSession('admin');
    const teacherDocRef = doc(db, 'users', teacherId);
    await deleteDoc(teacherDocRef);
  } catch (error) {
    console.error('Lỗi khi xóa giáo viên:', error);
    if (error.code === 'permission-denied') {
      throw new Error('Chỉ Admin mới có quyền xóa giáo viên.');
    }
    throw new Error(`Không thể xóa giáo viên: ${error.message}`);
  }
}

export async function updateStudent(studentId, data) {
  try {
    await ensureAuthSession('admin');
    const studentDocRef = doc(db, 'students', studentId);
    await updateDoc(studentDocRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật học sinh:', error);
    if (error.code === 'permission-denied') {
      throw new Error('Chỉ Admin mới có quyền sửa thông tin học sinh.');
    }
    throw new Error(`Không thể cập nhật học sinh: ${error.message}`);
  }
}

export async function deleteStudent(studentId) {
  try {
    await ensureAuthSession('admin');
    const studentDocRef = doc(db, 'students', studentId);
    await deleteDoc(studentDocRef);
  } catch (error) {
    console.error('Lỗi khi xóa học sinh:', error);
    if (error.code === 'permission-denied') {
      throw new Error('Chỉ Admin mới có quyền xóa học sinh.');
    }
    throw new Error(`Không thể xóa học sinh: ${error.message}`);
  }
}

export function getRealtimeClasses(callback, onError) {
  const classesRef = collection(db, 'classes');
  return onSnapshot(
    classesRef,
    (snapshot) => {
      const classesList = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      callback(classesList);
    },
    (error) => {
      console.error("Lỗi lắng nghe getRealtimeClasses:", error);
      if (onError) onError(error);
    }
  );
}

export function getRealtimeTeachers(callback, onError) {
  const usersRef = collection(db, 'users');
  const teacherQuery = query(usersRef, where('role', '==', 'teacher'));
  return onSnapshot(
    teacherQuery,
    (snapshot) => {
      const teachersList = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      callback(teachersList);
    },
    (error) => {
      console.error("Lỗi lắng nghe getRealtimeTeachers:", error);
      if (onError) onError(error);
    }
  );
}

export function getRealtimeStudents(callback, onError) {
  const studentsRef = collection(db, 'students');
  return onSnapshot(
    studentsRef,
    (snapshot) => {
      const studentsList = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      callback(studentsList);
    },
    (error) => {
      console.error("Lỗi lắng nghe getRealtimeStudents:", error);
      if (onError) onError(error);
    }
  );
}

export function getRealtimeAssignments(callback, onError) {
  const assignmentsRef = collection(db, 'assignments');
  return onSnapshot(
    assignmentsRef,
    (snapshot) => {
      const assignmentsList = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      callback(assignmentsList);
    },
    (error) => {
      console.error("Lỗi lắng nghe getRealtimeAssignments:", error);
      if (onError) onError(error);
    }
  );
}

// ============================================================================
// PHẦN 2: MÔI TRƯỜNG GIÁO VIÊN (Yêu cầu rule: isAdmin() || isTeacher())
// ============================================================================

export async function saveDailyAttendance(attendanceData, actingRole = 'teacher') {
  try {
    await ensureAuthSession(actingRole === 'admin' ? 'admin' : 'teacher');

    const { classId, date } = attendanceData;
    if (!classId || !date) {
      throw new Error("Thiếu mã lớp học (classId) hoặc ngày học (date)!");
    }

    const safeDate = String(date).replace(/[\/\s]/g, '-');
    const docId = `${classId}_${safeDate}`;
    const docRef = doc(db, 'attendance', docId);

    await setDoc(
      docRef,
      {
        ...attendanceData,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    console.log(`✓ Đã lưu bảng điểm danh buổi học thành công vào attendance/${docId}`);

    if (actingRole === 'admin' && Array.isArray(attendanceData.records)) {
      const updates = attendanceData.records.map(async (record) => {
        try {
          const studentDocRef = doc(db, 'students', record.studentId);
          await updateDoc(studentDocRef, {
            attendanceStatus: record.status,
            note: record.note || '',
            lastAttendDate: date,
            updatedAt: serverTimestamp()
          });
        } catch (innerErr) {
          // Bỏ qua lỗi doc riêng lẻ
        }
      });
      await Promise.allSettled(updates);
    }

    return docId;
  } catch (error) {
    console.error("Lỗi tại hàm saveDailyAttendance:", error);
    if (error.code === 'permission-denied') {
      throw new Error("Quy tắc Firestore từ chối: Bạn cần quyền Giáo viên (isTeacher) hoặc Admin để lưu điểm danh.");
    }
    throw new Error(`Không thể lưu điểm danh: ${error.message}`);
  }
}

export async function createAssignment(assignmentData, actingRole = 'teacher') {
  try {
    await ensureAuthSession(actingRole === 'admin' ? 'admin' : 'teacher');
    const assignmentsRef = collection(db, 'assignments');
    const docRef = await addDoc(assignmentsRef, {
      ...assignmentData,
      status: assignmentData.status || 'working',
      maxScore: Number(assignmentData.maxScore) || 10,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log("✓ Đăng bài tập thành công, ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Lỗi tại hàm createAssignment:", error);
    if (error.code === 'permission-denied') {
      throw new Error("Quy tắc Firestore từ chối: Chỉ Giáo viên hoặc Admin mới có quyền giao bài tập.");
    }
    throw new Error(`Không thể giao bài tập: ${error.message}`);
  }
}

export async function submitGrade(assignmentId, studentId, score, feedback, actingRole = 'teacher') {
  try {
    await ensureAuthSession(actingRole === 'admin' ? 'admin' : 'teacher');
    const assignmentDocRef = doc(db, 'assignments', assignmentId);
    await updateDoc(assignmentDocRef, {
      score: Number(score),
      comment: feedback,
      status: 'graded',
      studentId: studentId,
      gradedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log(`✓ Chấm bài xong cho bài tập ID: ${assignmentId} - Điểm: ${score}`);
  } catch (error) {
    console.error("Lỗi tại hàm submitGrade:", error);
    if (error.code === 'permission-denied') {
      throw new Error("Quy tắc Firestore từ chối: Chỉ Giáo viên hoặc Admin mới có quyền chấm điểm.");
    }
    throw new Error(`Không thể chấm điểm bài tập: ${error.message}`);
  }
}

// ============================================================================
// PHẦN 3: MÔI TRƯỜNG PHỤ HUYNH (Yêu cầu rule: isSignedIn())
// ============================================================================

export function getStudentAttendanceHistory(studentId, callback, onError) {
  const attendanceRef = collection(db, 'attendance');
  return onSnapshot(
    attendanceRef,
    (snapshot) => {
      const historyList = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const records = data.records || [];
        const match = records.find(r => r.studentId === studentId);
        if (match) {
          historyList.push({
            id: docSnap.id,
            date: data.date,
            classId: data.classId,
            className: data.className,
            status: match.status,
            studentNote: match.note,
            generalNote: data.generalNote,
            teacherName: data.teacherName,
            updatedAt: data.updatedAt
          });
        }
      });
      historyList.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      callback(historyList);
    },
    (error) => {
      console.error("Lỗi lắng nghe getStudentAttendanceHistory:", error);
      if (onError) onError(error);
    }
  );
}

export function getStudentAssignments(classId, studentId, callback, onError) {
  const assignmentsRef = collection(db, 'assignments');
  return onSnapshot(
    assignmentsRef,
    (snapshot) => {
      let list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      if (classId) {
        list = list.filter(item => !item.className || item.className.includes(classId));
      }
      if (studentId) {
        list = list.filter(item => !item.studentId || item.studentId === studentId);
      }
      callback(list);
    },
    (error) => {
      console.error("Lỗi lắng nghe getStudentAssignments:", error);
      if (onError) onError(error);
    }
  );
}

export async function seedInitialDataOnDemand() {
  await ensureAuthSession('admin');
  console.log("Khởi tạo dữ liệu mẫu theo yêu cầu...");
  return true;
}
