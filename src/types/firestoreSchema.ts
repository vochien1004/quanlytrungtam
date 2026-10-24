import { Timestamp, FieldValue } from 'firebase/firestore';

/**
 * ============================================================================
 * KIẾN TRÚC CƠ SỞ DỮ LIỆU FIRESTORE MULTI-TENANT (CHUẨN NOSQL SCALABLE)
 * ============================================================================
 *
 * Nguyên tắc thiết kế:
 * 1. Loại bỏ hoàn toàn Anti-pattern "Unbounded Array" (mảng phình to không giới hạn)
 *    ra khỏi Document gốc `/centers/{centerId}` để tránh vượt giới hạn 1MB/document
 *    và giảm băng thông đọc khi tải thông tin trung tâm.
 * 2. Chuyển đổi toàn bộ `classes`, `assignments`, `attendance`, `teachers`, `students`
 *    thành các Subcollections độc lập bên dưới `/centers/{centerId}`.
 * 3. Mỗi Document trong Subcollection đều lưu trữ tường minh `centerId` và `classId`
 *    nhằm hỗ trợ truy vấn có điều kiện (Filtered Queries) lẫn Collection Group Queries.
 */

export type FirestoreTimestamp = Timestamp | FieldValue | string;

export type CenterStatus = 'active' | 'expired' | 'suspended';
export type SubscriptionPackagePlan = 'Basic' | 'Standard' | 'Premium' | 'Enterprise';
export type ClassStatus = 'active' | 'pending' | 'paused';
export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'unexcused';
export type AssignmentStatus = 'working' | 'completed' | 'grading' | 'graded';
export type SubmissionStatus = 'submitted' | 'graded';
export type AttachmentFileType = 'pdf' | 'word' | 'image' | 'other';

export type TeacherStatus = 'active' | 'paused' | 'inactive';
export type StudentStatus = 'active' | 'probation' | 'suspended';

/**
 * 1. COLLECTION GỐC: `/centers/{centerId}`
 * Chỉ lưu trữ thông tin định danh, liên hệ và bản quyền SaaS của Trung tâm (~1KB).
 * TUYỆT ĐỐI KHÔNG chứa các trường mảng `students`, `teachers`, `classes`, `assignments`, `attendance`.
 */
export interface Center {
  id: string;
  centerId: string;
  code: string;
  name: string;
  username?: string;
  realEmail?: string;
  authEmail?: string;
  address?: string;
  phone?: string;
  email?: string;
  status: CenterStatus;
  packagePlan: SubscriptionPackagePlan;
  expiryDate: string; // Định dạng ISO YYYY-MM-DD
  endDate?: string;
  adminUid?: string;
  ownerUid?: string;
  adminUsername?: string;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

export type CenterDocument = Center;

/**
 * 1A. SUBCOLLECTION HỌC SINH: `/centers/{centerId}/students/{studentId}`
 * Lưu trữ từng học sinh thành một Document độc lập bên trong subcollection `students`.
 */
export interface Student {
  id: string;
  centerId: string;       // Tham chiếu về Trung tâm trực thuộc
  studentCode: string;    // Mã định danh học sinh (VD: "HS-01", "HS-102")
  name: string;           // Họ và tên học sinh
  classId: string;        // ID lớp học đang theo học
  className: string;      // Tên lớp học
  avatar: string;
  attendanceStatus: AttendanceStatus;
  note: string;
  parentName: string;     // Họ tên Phụ huynh
  parentPhone: string;    // Số điện thoại Phụ huynh
  parentEmail?: string;
  username?: string;      // Tài khoản sổ liên lạc
  password?: string;
  gender?: 'Nam' | 'Nữ';
  dob?: string;           // Ngày sinh
  gpa: number;            // Điểm trung bình tích lũy
  recentGrade: string;
  status: StudentStatus;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

export type StudentDocument = Student;

/**
 * 1B. SUBCOLLECTION GIÁO VIÊN: `/centers/{centerId}/teachers/{teacherId}`
 * Lưu trữ từng giáo viên thành một Document độc lập bên trong subcollection `teachers`.
 */
export interface Teacher {
  id: string;
  centerId: string;       // Tham chiếu về Trung tâm trực thuộc
  teacherCode: string;    // Mã giáo viên (VD: "GV-01", "GV-TOAN")
  name: string;           // Họ và tên giáo viên
  fullName?: string;
  username?: string;      // Tên đăng nhập hệ thống
  password?: string;
  subject: string;        // Môn giảng dạy chính
  avatar: string;
  phone: string;          // Số điện thoại liên hệ
  email: string;          // Email công việc
  mainClassId: string;    // ID lớp chủ nhiệm / phụ trách chính
  mainClassName: string;  // Tên lớp phụ trách chính
  assignedClassIds?: string[];   // Danh sách ID các lớp đảm nhận
  assignedClassNames?: string[]; // Danh sách tên các lớp đảm nhận
  assignedSubjects?: string[];   // Danh sách môn học phụ trách
  bio: string;            // Tiểu sử / Kinh nghiệm chuyên môn
  status: TeacherStatus;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

export type TeacherDocument = Teacher;

/**
 * 1.3. SUBCOLLECTION NGƯỜI DÙNG (MULTI-TENANT): `/centers/{centerId}/users/{uid}`
 * Lưu trữ thông tin chi tiết (Hồ sơ, chức vụ, trạng thái, username) của người dùng trong từng trung tâm,
 * kết hợp với định danh cốt lõi trên Firebase Authentication thông qua cơ chế Fake Email:
 * `fakeEmail = ${username}@${centerId}.app.com` hoặc `authEmail = ${username}@tenant.system.local`
 */
export type UserProfileRole = 'super_admin' | 'center_admin' | 'teacher' | 'student' | 'parent' | 'staff';
export type UserProfileStatus = 'active' | 'inactive' | 'locked' | 'suspended';

export interface UserProfile {
  uid: string;                  // Khớp 1-1 với Firebase Auth UID
  centerId: string;             // ID Trung tâm trực thuộc (Multi-tenant)
  username: string;             // Tên đăng nhập của người dùng (dùng tạo fakeEmail)
  email: string;                // Email ảo trên Firebase Auth hoặc email liên hệ
  realEmail?: string;           // Email liên hệ thực tế (tùy chọn)
  authEmail?: string;           // Email định danh trên Firebase Auth (${username}@tenant.system.local)
  fullName: string;             // Họ và tên đầy đủ
  displayName?: string;         // Tên hiển thị
  role: UserProfileRole;        // Chức vụ / Vai trò trong trung tâm
  position?: string;            // Chức danh chi tiết (VD: "Giáo viên Toán", "Quản lý học vụ")
  status: UserProfileStatus;    // Trạng thái hoạt động ('active' | 'inactive' | 'locked' | 'suspended')
  phone?: string;               // Số điện thoại liên hệ
  avatar?: string;              // Ảnh đại diện
  address?: string;             // Địa chỉ
  // Mở rộng theo vai trò (Giáo viên / Học sinh / Phụ huynh)
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
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
  lastLoginAt?: FirestoreTimestamp;
}


/**
 * 2. SUBCOLLECTION LỚP HỌC: `/centers/{centerId}/classes/{classId}`
 * Lưu trữ từng lớp học thành một Document độc lập.
 */
export interface ClassDocument {
  id: string;
  centerId: string;       // Tham chiếu về Trung tâm quản lý
  classCode: string;      // Mã lớp (VD: "LOP-6A", "TOAN-9B")
  name: string;           // Tên lớp học
  subject: string;        // Môn học (VD: "Toán", "Tiếng Anh")
  teacherId: string;      // ID Giáo viên phụ trách chính
  teacherName: string;    // Tên Giáo viên (Denormalized để hiển thị nhanh)
  teacherPhone?: string;  // SĐT Giáo viên
  room: string;           // Phòng học
  schedule: string;       // Lịch học (VD: "Thứ 2, 4, 6 (18:00 - 19:30)")
  studentCount: number;   // Sĩ số hiện tại (Counter)
  maxCapacity: number;    // Sĩ số tối đa (VD: 25)
  pricePerSession: number;// Học phí mỗi buổi (VNĐ)
  status: ClassStatus;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

/**
 * Chi tiết trạng thái điểm danh của 1 học sinh trong 1 buổi học.
 * Được nhúng trong `AttendanceDocument.records` (Giới hạn an toàn theo sĩ số lớp ~25-40 HS, < 4KB).
 */
export interface StudentAttendanceEntry {
  studentId: string;
  studentName: string;
  studentCode?: string;
  status: AttendanceStatus;
  note?: string;
}

/**
 * 3. SUBCOLLECTION ĐIỂM DANH: `/centers/{centerId}/attendance/{attendanceId}`
 * Mỗi Document đại diện cho một phiên điểm danh của 1 lớp vào 1 ngày cụ thể.
 * Khóa chính gợi ý (Deterministic ID): `att_${classId}_${YYYYMMDD}`
 */
export interface AttendanceDocument {
  id: string;
  docId?: string;
  centerId: string;       // Tham chiếu về Trung tâm
  classId: string;        // Tham chiếu về Lớp học (Dùng để đánh Index & Query)
  className: string;      // Tên lớp tại thời điểm điểm danh
  teacherId: string;      // ID Giáo viên thực hiện điểm danh
  teacherName?: string;   // Tên Giáo viên
  date: string;           // Ngày điểm danh chuẩn ISO (YYYY-MM-DD) để sort/filter
  sessionDate?: string;   // Ngày hiển thị định dạng VN (DD/MM/YYYY)
  sessionNote?: string;   // Ghi chú chung của buổi học
  records: StudentAttendanceEntry[]; // Danh sách điểm danh học sinh của buổi học đó
  presentCount?: number;
  absentCount?: number;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

/**
 * 4. SUBCOLLECTION BÀI TẬP: `/centers/{centerId}/assignments/{assignmentId}`
 * Lưu thông tin đề bài tập được giao cho lớp học hoặc nhóm học sinh.
 */
export interface AssignmentDocument {
  id: string;
  centerId: string;       // Tham chiếu về Trung tâm
  classId: string;        // Tham chiếu về Lớp học
  className: string;
  teacherId: string;      // Tham chiếu về Giáo viên giao bài
  teacherName: string;
  title: string;
  subject: string;
  content?: string;
  assignedDate: string;   // Ngày giao (YYYY-MM-DD)
  dueDate: string;        // Hạn nộp (YYYY-MM-DD)
  status: AssignmentStatus;
  maxScore: number;
  score?: number;
  comment?: string;
  studentId?: string;
  studentName: string;
  targetStudentIds?: string[];
  assignedStudentIds?: string[];
  targetStudentNames?: string[];
  attachedFile?: string;
  attachedFileUrl?: string | null;
  attachedFileType?: AttachmentFileType;
  attachedFileContentHtml?: string | null;
  storagePath?: string;   // Đường dẫn file trên Firebase Storage
  submissions?: AssignmentSubmissionDocument[];
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

/**
 * 5. SUBCOLLECTION BÀI NỘP: `/centers/{centerId}/assignments/{assignmentId}/submissions/{submissionId}`
 * Lưu bài làm đã nộp và kết quả chấm điểm của từng học sinh.
 */
export interface AssignmentSubmissionDocument {
  id: string;
  assignmentId: string;
  centerId?: string;
  classId?: string;
  studentId: string;
  studentName: string;
  parentName?: string;
  parentPhone?: string;
  submittedAt: string;
  fileUrl: string;
  fileName: string;
  fileType: AttachmentFileType;
  storagePath?: string;
  note?: string;
  status: SubmissionStatus;
  score?: number;
  feedback?: string;
  teacherComment?: string;
  teacherCorrectedFileUrl?: string | null;
  teacherCorrectedFileName?: string | null;
  updatedAt?: FirestoreTimestamp;
}
