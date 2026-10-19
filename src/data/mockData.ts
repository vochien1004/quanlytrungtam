export interface ClassItem {
  id: string;
  centerId?: string;
  code?: string; // Mã lớp học
  classCode?: string; // Mã lớp học (VD: LOP-6A, LOP-7B)
  name: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  teacherPhone?: string;
  room: string;
  schedule: string;
  studentCount: number;
  maxCapacity: number;
  pricePerSession?: number; // Đơn giá / buổi học (VNĐ)
  status?: 'active' | 'pending' | 'paused';
  createdAt?: any;
  updatedAt?: any;
}

export interface TeacherItem {
  id: string;
  centerId?: string; // Mã Trung Tâm trực thuộc
  teacherCode?: string; // Mã giáo viên (VD: GV-01, GV-TOAN)
  name: string;
  fullName?: string;
  username?: string; // Tên đăng nhập
  password?: string; // Mật khẩu
  subject: string;
  avatar: string;
  phone: string;
  email: string;
  mainClassId: string;
  mainClassName: string;
  assignedClassIds?: string[]; // Danh sách ID các lớp giáo viên đảm nhận cùng lúc
  assignedClassNames?: string[]; // Danh sách tên các lớp đảm nhận
  assignedSubjects?: string[]; // Danh sách môn học phụ trách
  bio: string;
  status?: 'active' | 'paused' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'unexcused';

export interface StudentItem {
  id: string;
  centerId?: string; // Mã Trung Tâm trực thuộc
  studentCode?: string; // Mã học sinh (VD: HS-01, HS-02)
  name: string;
  classId: string;
  className: string;
  avatar: string;
  attendanceStatus: AttendanceStatus;
  note: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  username?: string; // Tên đăng nhập sổ liên lạc
  password?: string; // Mật khẩu PH
  gender?: 'Nam' | 'Nữ';
  dob?: string;
  gpa: number;
  recentGrade: string;
  status?: 'active' | 'probation' | 'suspended';
  createdAt?: any;
  updatedAt?: any;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  assignmentTitle?: string;
  studentId: string;
  studentName: string;
  parentName?: string;
  parentPhone?: string;
  submittedAt: string;
  fileUrl: string;
  fileName: string;
  fileType: 'image' | 'pdf' | 'word' | 'other';
  storagePath?: string;
  note?: string;
  status: 'submitted' | 'graded';
  score?: number;
  teacherComment?: string;
  feedback?: string;
  teacherCorrectedFileUrl?: string | null;
  teacherCorrectedFileName?: string | null;
}

export interface AssignmentItem {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  assignedDate?: string;
  status: 'completed' | 'grading' | 'working' | 'graded';
  score?: number;
  maxScore: number;
  comment?: string;
  studentName: string;
  className: string;
  classId?: string;
  studentId?: string;
  targetStudentIds?: string[];
  assignedStudentIds?: string[];
  targetStudentNames?: string[];
  teacherId?: string;
  teacherName?: string;
  content?: string;
  attachedFile?: string;
  attachedFileUrl?: string | null;
  attachedFileType?: 'pdf' | 'word' | 'image' | 'other';
  attachedFileContentHtml?: string | null;
  storagePath?: string;
  submissions?: AssignmentSubmission[];
}

export interface WeeklyAttendanceRow {
  weekLabel: string;
  mon: 'present' | 'excused' | 'unexcused' | 'none';
  tue: 'present' | 'excused' | 'unexcused' | 'none';
  wed: 'present' | 'excused' | 'unexcused' | 'none';
  thu: 'present' | 'excused' | 'unexcused' | 'none';
  fri: 'present' | 'excused' | 'unexcused' | 'none';
  sat: 'present' | 'excused' | 'unexcused' | 'none';
}

export const INITIAL_CLASSES: ClassItem[] = [];

export const INITIAL_TEACHERS: TeacherItem[] = [];

export const INITIAL_STUDENTS: StudentItem[] = [];

export const INITIAL_ASSIGNMENTS: AssignmentItem[] = [];

export const INITIAL_WEEKLY_ATTENDANCE: WeeklyAttendanceRow[] = [];
