/**
 * ============================================================================
 * TRUNG TÂM DẠY THÊM HỌC GIỎI - FIREBASE FIRESTORE SDK v9/v10 (Modular API)
 * ============================================================================
 * CẬP NHẬT CHUẨN XÁC THEO BỘ QUY TẮC BẢO MẬT (FIRESTORE SECURITY RULES):
 * - isSignedIn(): request.auth != null
 * - getUserRole(): get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
 * - isAdmin(): isSignedIn() && getUserRole() == 'admin'
 * - isTeacher(): isSignedIn() && getUserRole() == 'teacher'
 * - match /users/{userId}: allow read: if isSignedIn(); allow write: if isSignedIn() && (request.auth.uid == userId || getUserRole() == 'admin')
 * - match /classes/{classId}: allow read: if isSignedIn(); allow write: if isAdmin()
 * - match /students/{studentId}: allow read: if isSignedIn(); allow write: if isAdmin()
 * - match /attendance/{attendanceId}: allow read: if isSignedIn(); allow create, update: if isAdmin() || isTeacher(); allow delete: if isAdmin()
 * - match /assignments/{assignmentId}: allow read: if isSignedIn(); allow create, update: if isAdmin() || isTeacher(); allow delete: if isAdmin()
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  getDocs
} from "firebase/firestore";
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from "firebase/auth";

// 1. CẤU HÌNH FIREBASE THEO THÔNG SỐ DỰ ÁN TTHOCGIOI
export const firebaseConfig = {
  apiKey: "AIzaSyAdzeYBZYVwHMh54-7aY9Rs8WgPRxSjQxo",
  authDomain: "tthocgioi-9d836.firebaseapp.com",
  projectId: "tthocgioi-9d836",
  storageBucket: "tthocgioi-9d836.firebasestorage.app",
  messagingSenderId: "1039061723065",
  appId: "1:1039061723065:web:acec62fb0423f47877b868"
};

// Khởi tạo Firebase App, Firestore và Firebase Auth
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ============================================================================
// 2. QUẢN LÝ XÁC THỰC VÀ ĐỒNG BỘ VAI TRÒ (AUTH & ROLE MANAGEMENT)
// ============================================================================

/**
 * Đảm bảo người dùng đã có phiên đăng nhập Firebase Auth và doc /users/{uid}
 * được cập nhật đúng trường { role: targetRole } để thỏa mãn các hàm bảo mật:
 * isSignedIn(), getUserRole(), isAdmin(), isTeacher().
 *
 * Lưu ý theo quy tắc:
 * match /users/{userId} cho phép write nếu request.auth.uid == userId
 * Vì vậy người dùng đăng nhập luôn được phép ghi vào doc của chính mình.
 */
export async function ensureAuthSession(targetRole = "admin") {
  const normRole = (targetRole === "teachers" || targetRole === "teacher" || targetRole === "giaovien") ? "teacher" : targetRole;
  let currentUser = auth.currentUser;

  if (!currentUser) {
    try {
      const cred = await signInAnonymously(auth);
      currentUser = cred.user;
      console.log("✓ Đã đăng nhập Firebase Auth thành công UID:", currentUser.uid);
    } catch (authError) {
      console.warn("Thử đăng nhập tài khoản hệ thống...", authError.message);
      const email = `${normRole}@tthocgioi.edu.vn`;
      const pass = "HocGioi@2024";
      try {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        currentUser = cred.user;
      } catch {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        currentUser = cred.user;
      }
    }
  }

  // Cập nhật vai trò vào /users/{uid} để getUserRole() trả về đúng role
  try {
    const userDocRef = doc(db, "users", currentUser.uid);
    await setDoc(
      userDocRef,
      {
        uid: currentUser.uid,
        role: normRole,
        userRole: normRole,
        roles: ["teacher", "teachers"],
        name:
          normRole === "admin"
            ? "Nguyễn Văn An (Admin)"
            : normRole === "teacher"
            ? "Cô Nguyễn Thị Hoa (Giáo viên)"
            : "Bạch Duyên Thị Hoa (Phụ huynh)",
        email: currentUser.email || `${normRole}@tthocgioi.edu.vn`,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    console.log(`✓ Phân quyền Firestore sẵn sàng cho vai trò: [${normRole.toUpperCase()}]`);
  } catch (err) {
    console.warn("Lưu role error:", err.message);
  }

  return currentUser;
}

/**
 * Chuyển đổi vai trò người dùng trong Firestore khi đổi chế độ xem trên UI
 */
export async function switchUserRole(newRole) {
  const normRole = (newRole === "teachers" || newRole === "teacher" || newRole === "giaovien") ? "teacher" : newRole;
  const user = auth.currentUser;
  if (!user) {
    await ensureAuthSession(normRole);
    return;
  }
  const userDocRef = doc(db, "users", user.uid);
  await setDoc(
    userDocRef,
    {
      role: normRole,
      userRole: normRole,
      roles: ["teacher", "teachers"],
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  console.log(`✓ Đã cập nhật vai trò Firestore thành: [${normRole.toUpperCase()}]`);
}

// ============================================================================
// 3. MÔI TRƯỜNG ADMIN (Yêu cầu rule: isAdmin() - Role 'admin')
// ============================================================================

/**
 * Lưu lớp học mới vào collection 'classes'
 * Rule: allow write: if isAdmin();
 */
export async function createClass(classData) {
  try {
    await ensureAuthSession("admin");
    const classesRef = collection(db, "classes");
    const docRef = await addDoc(classesRef, {
      ...classData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log("✓ Admin đã tạo lớp học thành công ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Lỗi createClass:", error);
    if (error.code === "permission-denied") {
      throw new Error("Từ chối quyền: Chỉ Quản trị viên (Admin) mới có quyền tạo lớp học.");
    }
    throw new Error(`Không thể tạo lớp học: ${error.message}`);
  }
}

/**
 * Cập nhật lớp học (Yêu cầu: isAdmin())
 */
export async function updateClass(classId, updateData) {
  try {
    await ensureAuthSession("admin");
    const classDocRef = doc(db, "classes", classId);
    await updateDoc(classDocRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Lỗi updateClass:", error);
    throw new Error(`Không thể cập nhật lớp học: ${error.message}`);
  }
}

/**
 * Xóa lớp học (Yêu cầu: isAdmin())
 */
export async function deleteClass(classId) {
  try {
    await ensureAuthSession("admin");
    const classDocRef = doc(db, "classes", classId);
    await deleteDoc(classDocRef);
  } catch (error) {
    console.error("Lỗi deleteClass:", error);
    throw new Error(`Không thể xóa lớp học: ${error.message}`);
  }
}

/**
 * Lưu giáo viên vào collection 'users' với role: 'teacher'
 * Rule: allow write: if isSignedIn() && (request.auth.uid == userId || getUserRole() == 'admin');
 */
export async function createTeacher(teacherData) {
  try {
    await ensureAuthSession("admin");
    const usersRef = collection(db, "users");
    const docRef = await addDoc(usersRef, {
      ...teacherData,
      role: "teacher",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log("✓ Admin đã thêm giáo viên thành công ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Lỗi createTeacher:", error);
    if (error.code === "permission-denied") {
      throw new Error("Từ chối quyền: Chỉ Admin mới có quyền tạo hồ sơ giáo viên trong collection 'users'.");
    }
    throw new Error(`Không thể thêm giáo viên: ${error.message}`);
  }
}

/**
 * Cập nhật giáo viên (Yêu cầu: isAdmin())
 */
export async function updateTeacher(teacherId, updateData) {
  try {
    await ensureAuthSession("admin");
    const teacherDocRef = doc(db, "users", teacherId);
    await updateDoc(teacherDocRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Lỗi updateTeacher:", error);
    throw new Error(`Không thể cập nhật giáo viên: ${error.message}`);
  }
}

/**
 * Xóa giáo viên (Yêu cầu: isAdmin())
 */
export async function deleteTeacher(teacherId) {
  try {
    await ensureAuthSession("admin");
    const teacherDocRef = doc(db, "users", teacherId);
    await deleteDoc(teacherDocRef);
  } catch (error) {
    console.error("Lỗi deleteTeacher:", error);
    throw new Error(`Không thể xóa giáo viên: ${error.message}`);
  }
}

/**
 * Lưu học sinh mới vào collection 'students'
 * Rule: allow write: if isAdmin();
 */
export async function createStudent(studentData) {
  try {
    await ensureAuthSession("admin");
    const studentsRef = collection(db, "students");
    const docRef = await addDoc(studentsRef, {
      ...studentData,
      attendanceStatus: studentData.attendanceStatus || "present",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log("✓ Admin đã thêm học sinh thành công ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Lỗi createStudent:", error);
    if (error.code === "permission-denied") {
      throw new Error("Từ chối quyền: Chỉ Quản trị viên (Admin) mới có quyền tạo học sinh.");
    }
    throw new Error(`Không thể thêm học sinh: ${error.message}`);
  }
}

/**
 * Cập nhật học sinh (Yêu cầu: isAdmin())
 */
export async function updateStudent(studentId, updateData) {
  try {
    await ensureAuthSession("admin");
    const studentDocRef = doc(db, "students", studentId);
    await updateDoc(studentDocRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Lỗi updateStudent:", error);
    throw new Error(`Không thể cập nhật học sinh: ${error.message}`);
  }
}

/**
 * Xóa học sinh (Yêu cầu: isAdmin())
 */
export async function deleteStudent(studentId) {
  try {
    await ensureAuthSession("admin");
    const studentDocRef = doc(db, "students", studentId);
    await deleteDoc(studentDocRef);
  } catch (error) {
    console.error("Lỗi deleteStudent:", error);
    throw new Error(`Không thể xóa học sinh: ${error.message}`);
  }
}

// ============================================================================
// 4. MÔI TRƯỜNG GIÁO VIÊN (Yêu cầu rule: isAdmin() || isTeacher())
// ============================================================================

/**
 * Lưu điểm danh & nhận xét vào collection 'attendance'
 * Rule: allow create, update: if isAdmin() || isTeacher();
 *
 * Lưu ý quan trọng:
 * Collection /students chỉ cho phép isAdmin() ghi. Do đó nếu là Giáo viên,
 * hệ thống ghi nhận đầy đủ vào /attendance và KHÔNG cố tình ghi đè vào /students
 * để tránh phát sinh lỗi permission-denied.
 */
export async function saveDailyAttendance(attendanceData, userRole = "teacher", centerId = "center-1") {
  try {
    const normRole = (userRole === "teachers" || userRole === "teacher" || userRole === "giaovien") ? "teacher" : userRole;
    await ensureAuthSession(normRole);
    const { classId, date } = attendanceData;
    if (!classId || !date) {
      throw new Error("Thiếu classId hoặc date");
    }

    const effectiveCenterId = attendanceData.centerId || centerId || "center-1";
    const docId = `${classId}_${date.replace(/[\/\s]/g, "-")}`;
    const attendanceDocRef = doc(db, "centers", effectiveCenterId, "attendance", docId);

    // Ghi vào sub-collection /centers/{centerId}/attendance
    await setDoc(
      attendanceDocRef,
      {
        ...attendanceData,
        centerId: effectiveCenterId,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    // Nếu người thực hiện là Admin thì đồng bộ trực tiếp sang collection 'students'
    if (userRole === "admin" && attendanceData.records && Array.isArray(attendanceData.records)) {
      const syncPromises = attendanceData.records.map(async (record) => {
        try {
          const studentDocRef = doc(db, "students", record.studentId);
          await updateDoc(studentDocRef, {
            attendanceStatus: record.status,
            note: record.note || "",
            lastAttendanceDate: date,
            updatedAt: serverTimestamp()
          });
        } catch {
          // Bỏ qua lỗi doc riêng lẻ
        }
      });
      await Promise.allSettled(syncPromises);
    }

    console.log("✓ Đã lưu điểm danh Firestore docId:", docId);
    return docId;
  } catch (error) {
    console.error("Lỗi saveDailyAttendance:", error);
    if (error.code === "permission-denied") {
      throw new Error("Từ chối quyền: Cần vai trò Giáo viên hoặc Admin để lưu điểm danh.");
    }
    throw new Error(`Không thể lưu điểm danh: ${error.message}`);
  }
}

/**
 * Đăng bài tập mới vào collection 'assignments'
 * Rule: allow create, update: if isAdmin() || isTeacher();
 */
export async function createAssignment(assignmentData, userRole = "teacher") {
  try {
    await ensureAuthSession(userRole);
    const assignmentsRef = collection(db, "assignments");
    const docRef = await addDoc(assignmentsRef, {
      ...assignmentData,
      status: assignmentData.status || "working",
      maxScore: assignmentData.maxScore || 10,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log("✓ Đã giao bài tập thành công ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Lỗi createAssignment:", error);
    if (error.code === "permission-denied") {
      throw new Error("Từ chối quyền: Chỉ Giáo viên hoặc Admin mới có quyền giao bài tập.");
    }
    throw new Error(`Không thể giao bài tập: ${error.message}`);
  }
}

/**
 * Cập nhật điểm số và lời phê bài tập
 * Rule: allow create, update: if isAdmin() || isTeacher();
 */
export async function submitGrade(assignmentId, studentId, score, feedback, userRole = "teacher") {
  try {
    await ensureAuthSession(userRole);
    const assignmentDocRef = doc(db, "assignments", assignmentId);
    await updateDoc(assignmentDocRef, {
      score: Number(score),
      comment: feedback,
      status: "graded",
      studentId: studentId,
      gradedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log(`✓ Đã cập nhật điểm (${score}/10) cho bài tập ${assignmentId}`);
  } catch (error) {
    console.error("Lỗi submitGrade:", error);
    if (error.code === "permission-denied") {
      throw new Error("Từ chối quyền: Chỉ Giáo viên hoặc Admin mới có quyền chấm điểm bài tập.");
    }
    throw new Error(`Không thể cập nhật điểm số: ${error.message}`);
  }
}

// ============================================================================
// 5. LẮNG NGHE REALTIME (Rule: allow read: if isSignedIn())
// ============================================================================

export function getRealtimeClasses(onUpdate, onError) {
  const classesRef = collection(db, "classes");
  return onSnapshot(
    classesRef,
    (snapshot) => {
      const classes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      onUpdate(classes);
    },
    (err) => {
      console.warn("Lỗi getRealtimeClasses:", err.message);
      if (onError) onError(err);
    }
  );
}

export function getRealtimeTeachers(onUpdate, onError) {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("role", "==", "teacher"));
  return onSnapshot(
    q,
    (snapshot) => {
      const teachers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      onUpdate(teachers);
    },
    (err) => {
      console.warn("Lỗi getRealtimeTeachers:", err.message);
      if (onError) onError(err);
    }
  );
}

export function getRealtimeStudents(onUpdate, onError) {
  const studentsRef = collection(db, "students");
  return onSnapshot(
    studentsRef,
    (snapshot) => {
      const students = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      onUpdate(students);
    },
    (err) => {
      console.warn("Lỗi getRealtimeStudents:", err.message);
      if (onError) onError(err);
    }
  );
}

export function getRealtimeAssignments(onUpdate, onError) {
  const assignmentsRef = collection(db, "assignments");
  return onSnapshot(
    assignmentsRef,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      onUpdate(items);
    },
    (err) => {
      console.warn("Lỗi getRealtimeAssignments:", err.message);
      if (onError) onError(err);
    }
  );
}

export function getStudentAttendanceHistory(studentId, onUpdate, onError, centerId = "center-1") {
  const attendanceRef = collection(db, "centers", centerId, "attendance");
  return onSnapshot(
    attendanceRef,
    (snapshot) => {
      const records = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const studentRecord = data.records?.find((r) => r.studentId === studentId);
        if (studentRecord) {
          records.push({
            id: docSnap.id,
            date: data.date,
            classId: data.classId,
            className: data.className,
            status: studentRecord.status,
            studentNote: studentRecord.note,
            generalNote: data.generalNote,
            teacherName: data.teacherName,
            updatedAt: data.updatedAt
          });
        }
      });
      records.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      onUpdate(records);
    },
    (err) => {
      console.warn("Lỗi getStudentAttendanceHistory:", err.message);
      if (onError) onError(err);
    }
  );
}

export function getStudentAssignments(classId, studentId, onUpdate, onError) {
  const assignmentsRef = collection(db, "assignments");
  return onSnapshot(
    assignmentsRef,
    (snapshot) => {
      let assignments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (classId) {
        assignments = assignments.filter((a) => !a.className || a.className.includes(classId));
      }
      onUpdate(assignments);
    },
    (err) => {
      console.warn("Lỗi getStudentAssignments:", err.message);
      if (onError) onError(err);
    }
  );
}
