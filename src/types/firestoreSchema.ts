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

/**
 * 1. COLLECTION GỐC: `/centers/{centerId}`
 * Chỉ lưu trữ thông tin định danh, liên hệ và bản quyền SaaS của Trung tâm (~1KB).
 * TUYỆT ĐỐI KHÔNG chứa các mảng `classes`, `assignments`, `attendance`.
 */
export interface CenterDocument {
  id: string;
  centerId: string;
  code: string;
  name: string;
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
