import React, { useState, useRef, useMemo } from 'react';
import { 
  HeartHandshake, 
  Calendar, 
  Award, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  CreditCard,
  MessageSquare,
  Sparkles,
  PhoneCall,
  User,
  GraduationCap,
  Send,
  X,
  FileCheck,
  ChevronRight,
  Filter,
  Check,
  AlertTriangle,
  Info,
  CalendarCheck,
  Download,
  BookOpen,
  ArrowRight,
  TrendingUp,
  School,
  FileEdit,
  Eye,
  Camera,
  Upload,
  Image as ImageIcon,
  RotateCw,
  Paperclip,
  FileCheck2,
  Loader2
} from 'lucide-react';
import { StudentItem, AssignmentItem, TeacherItem, ClassItem, INITIAL_WEEKLY_ATTENDANCE, AssignmentSubmission } from '../../data/mockData';
import { AccountAvatar } from '../common/AccountAvatar';
import { DocumentPreviewModal, DocumentPreviewData } from '../common/DocumentPreviewModal';
import { submitStudentHomework } from '../../services/firebaseService';

interface ParentPortalViewProps {
  student: StudentItem;
  assignments: AssignmentItem[];
  allStudents?: StudentItem[];
  classes?: ClassItem[];
  teachers?: TeacherItem[];
  activeCenterId?: string;
  onSelectStudent?: (student: StudentItem) => void;
  onRequestLeaveSuccess?: (studentName: string, date: string, reason: string) => void;
}

export const ParentPortalView: React.FC<ParentPortalViewProps> = ({
  student,
  assignments,
  allStudents = [],
  classes = [],
  teachers = [],
  activeCenterId,
  onSelectStudent,
  onRequestLeaveSuccess,
}) => {
  // Current active student if selectable
  const fallbackStudentItem: StudentItem = {
    id: 'student-default',
    name: 'Học sinh',
    classId: '',
    className: 'Chưa xếp lớp',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    attendanceStatus: 'present',
    note: 'Chưa có nhận xét.',
    parentName: 'Phụ huynh học sinh',
    parentPhone: '0900.000.000',
    gpa: 8.0,
    recentGrade: '8.0 / 10',
  };

  const [activeStudentId, setActiveStudentId] = useState<string>(student?.id || '');
  const currentStudent = allStudents.find((s) => s.id === activeStudentId) || student || fallbackStudentItem;

  // View mode for attendance: 'week' or 'month'
  const [attendanceViewMode, setAttendanceViewMode] = useState<'week' | 'month'>('week');

  // Filter for homework: 'all' | 'submitted' | 'unsubmitted' | 'graded'
  const [homeworkFilter, setHomeworkFilter] = useState<'all' | 'submitted' | 'unsubmitted' | 'graded'>('all');

  // Selected Assignment for Detail Modal
  const [viewingAssignment, setViewingAssignment] = useState<AssignmentItem | null>(null);

  // Document Preview Modal State for Parent (Xem phóng to ảnh bài tập hoặc PDF đề bài & bài nộp)
  const [previewDoc, setPreviewDoc] = useState<DocumentPreviewData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Homework Submission Modal State
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedHwToSubmit, setSelectedHwToSubmit] = useState<AssignmentItem | null>(null);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submissionPreviewUrl, setSubmissionPreviewUrl] = useState<string | null>(null);
  const [submissionFileType, setSubmissionFileType] = useState<'image' | 'pdf' | 'word' | 'other'>('image');
  const [submissionNote, setSubmissionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitToast, setSubmitToast] = useState<{ show: boolean; msg: string; type: 'success' | 'error' }>({ show: false, msg: '', type: 'success' });

  // Camera capture modal state for Parent
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
  };

  const startCameraStream = async (facing: 'environment' | 'user' = cameraFacingMode) => {
    setCameraError(null);
    stopCameraStream();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Trình duyệt không hỗ trợ truy cập Camera trực tiếp. Vui lòng chọn tải ảnh từ máy.');
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1600 }, height: { ideal: 1200 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      setCameraError('Không thể mở Camera (chưa cấp quyền hoặc thiết bị không có Camera). Bạn có thể chọn ảnh chụp từ thư viện máy.');
    }
  };

  const handleOpenCameraModal = () => {
    setIsCameraOpen(true);
    setTimeout(() => {
      startCameraStream(cameraFacingMode);
    }, 100);
  };

  const handleCloseCameraModal = () => {
    stopCameraStream();
    setIsCameraOpen(false);
    setCameraError(null);
  };

  const handleCapturePhotoFromCamera = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = window.document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const fileName = `Bai_lam_${currentStudent.name.replace(/\s+/g, '_')}_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.jpg`;
        const capturedFile = new File([blob], fileName, { type: 'image/jpeg' });
        handleSelectSubmissionFile(capturedFile);
        handleCloseCameraModal();
      },
      'image/jpeg',
      0.9
    );
  };

  const handleSelectSubmissionFile = (file: File) => {
    setSubmissionFile(file);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isImg = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic'].includes(ext) || file.type.startsWith('image/');
    const isPdf = ext === 'pdf' || file.type === 'application/pdf';
    setSubmissionFileType(isImg ? 'image' : isPdf ? 'pdf' : 'word');
    const objUrl = URL.createObjectURL(file);
    setSubmissionPreviewUrl(objUrl);
  };

  const handleOpenSubmitModal = (hw: AssignmentItem) => {
    setSelectedHwToSubmit(hw);
    setSubmissionFile(null);
    setSubmissionPreviewUrl(null);
    setSubmissionNote('');
    setIsSubmitModalOpen(true);
  };

  const handleSubmitHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHwToSubmit || !submissionFile) {
      alert('Vui lòng chọn ảnh chụp bài làm hoặc file tài liệu trước khi gửi bài!');
      return;
    }
    setIsSubmitting(true);
    try {
      await submitStudentHomework(activeCenterId || 'center-1', {
        assignmentId: selectedHwToSubmit.id,
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        parentName: currentStudent.parentName || 'Phụ huynh',
        parentPhone: currentStudent.parentPhone || '',
        teacherId: selectedHwToSubmit.teacherId || currentTeacher?.id || 'teacher',
        classId: selectedHwToSubmit.classId || currentClass?.id || currentStudent.classId || 'class',
        file: submissionFile,
        fileName: submissionFile.name,
        note: submissionNote,
      });

      setSubmitToast({
        show: true,
        msg: `✓ Đã nộp bài làm môn ${selectedHwToSubmit.subject} cho cô giáo thành công!`,
        type: 'success',
      });
      setTimeout(() => setSubmitToast({ show: false, msg: '', type: 'success' }), 4000);
      setIsSubmitModalOpen(false);
      setSubmissionFile(null);
      setSubmissionPreviewUrl(null);
    } catch (err: any) {
      console.error('Lỗi khi nộp bài:', err);
      setSubmitToast({
        show: true,
        msg: `Lỗi khi nộp bài: ${err.message || 'Vui lòng thử lại sau.'}`,
        type: 'error',
      });
      setTimeout(() => setSubmitToast({ show: false, msg: '', type: 'error' }), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Leave Request Modal State
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveDate, setLeaveDate] = useState('2024-03-25');
  const [leaveSession, setLeaveSession] = useState('Ca tối (18:00 - 20:00)');
  const [leaveReason, setLeaveReason] = useState('Cháu bị cảm sốt nhẹ, gia đình xin phép cho cháu nghỉ 1 buổi và xin nhận bài tập bù về nhà.');
  const [leaveSentToast, setLeaveSentToast] = useState<{ show: boolean; msg: string }>({ show: false, msg: '' });

  // Parent feedback message state for timeline remarks
  const [parentReplyInput, setParentReplyInput] = useState<Record<string, string>>({});
  const [parentReplies, setParentReplies] = useState<Record<string, string>>({
    'log-1': 'Dạ cảm ơn cô Hoa nhiều! Tối nay về gia đình đã khen ngợi và động viên cháu tiếp tục cố gắng.',
    'log-2': 'Gia đình đã nhắc cháu rèn lại chữ viết và căn chỉnh lề theo góp ý của thầy Đức ạ.',
  });

  // Tìm giáo viên phụ trách thực tế từ danh sách lớp học hoặc giáo viên
  const currentClass = classes.find(
    (c) =>
      (currentStudent?.classId && (c.id === currentStudent.classId || c.code === currentStudent.classId)) ||
      (currentStudent?.className && (c.name === currentStudent.className || c.code === currentStudent.className))
  );
  const currentTeacher = teachers.find(
    (t) =>
      t.id === currentClass?.teacherId ||
      t.mainClassId === currentStudent?.classId ||
      t.mainClassId === currentClass?.id ||
      t.name === currentClass?.teacherName
  );
  const teacherDisplayName = currentTeacher?.name || currentClass?.teacherName || 'Giáo viên phụ trách';
  const teacherPhoneDisplay = currentTeacher?.phone || currentClass?.teacherPhone || '0988.123.456';

  // Timeline comments from teachers - Khởi tạo từ dữ liệu thực tế
  const [timelineRemarks, setTimelineRemarks] = useState<any[]>([]);

  // Monthly Attendance Data (March 2024 - 31 days)
  const MARCH_CALENDAR_DAYS = [
    { day: 1, weekday: 'T6', status: 'present', shift: '18:00 - 20:00', note: 'Có mặt đúng giờ' },
    { day: 2, weekday: 'T7', status: 'present', shift: '17:30 - 19:30', note: 'Có mặt đúng giờ' },
    { day: 3, weekday: 'CN', status: 'off', shift: 'Nghỉ', note: 'Chủ nhật nghỉ' },
    { day: 4, weekday: 'T2', status: 'present', shift: '18:00 - 20:00', note: 'Có mặt đúng giờ' },
    { day: 5, weekday: 'T3', status: 'present', shift: '17:30 - 19:30', note: 'Có mặt đúng giờ' },
    { day: 6, weekday: 'T4', status: 'present', shift: '18:00 - 20:00', note: 'Có mặt đúng giờ' },
    { day: 7, weekday: 'T5', status: 'excused', shift: '17:30 - 19:30', note: 'Vắng có phép (Khám mắt định kỳ)' },
    { day: 8, weekday: 'T6', status: 'present', shift: '18:00 - 20:00', note: 'Có mặt đúng giờ' },
    { day: 9, weekday: 'T7', status: 'present', shift: '17:30 - 19:30', note: 'Có mặt đúng giờ' },
    { day: 10, weekday: 'CN', status: 'off', shift: 'Nghỉ', note: 'Chủ nhật nghỉ' },
    { day: 11, weekday: 'T2', status: 'present', shift: '18:00 - 20:00', note: 'Có mặt đúng giờ' },
    { day: 12, weekday: 'T3', status: 'present', shift: '17:30 - 19:30', note: 'Có mặt đúng giờ' },
    { day: 13, weekday: 'T4', status: 'present', shift: '18:00 - 20:00', note: 'Có mặt đúng giờ' },
    { day: 14, weekday: 'T5', status: 'excused', shift: '17:30 - 19:30', note: 'Vắng có phép (Khám răng)' },
    { day: 15, weekday: 'T6', status: 'present', shift: '18:00 - 20:00', note: 'Có mặt đúng giờ' },
    { day: 16, weekday: 'T7', status: 'present', shift: '17:30 - 19:30', note: 'Có mặt đúng giờ' },
    { day: 17, weekday: 'CN', status: 'off', shift: 'Nghỉ', note: 'Chủ nhật nghỉ' },
    { day: 18, weekday: 'T2', status: 'present', shift: '18:00 - 20:00', note: 'Có mặt đúng giờ' },
    { day: 19, weekday: 'T3', status: 'present', shift: '17:30 - 19:30', note: 'Có mặt đúng giờ' },
    { day: 20, weekday: 'T4', status: 'present', shift: '18:00 - 20:00', note: 'Có mặt đúng giờ' },
    { day: 21, weekday: 'T5', status: 'present', shift: '17:30 - 19:30', note: 'Có mặt đúng giờ' },
    { day: 22, weekday: 'T6', status: 'present', shift: '18:00 - 20:00', note: 'Có mặt đúng giờ' },
    { day: 23, weekday: 'T7', status: 'present', shift: '17:30 - 19:30', note: 'Có mặt đúng giờ' },
    { day: 24, weekday: 'CN', status: 'off', shift: 'Nghỉ', note: 'Chủ nhật nghỉ' },
    { day: 25, weekday: 'T2', status: 'present', shift: '18:00 - 20:00', note: 'Hôm nay - Có mặt' },
    { day: 26, weekday: 'T3', status: 'present', shift: '17:30 - 19:30', note: 'Dự kiến có mặt' },
    { day: 27, weekday: 'T4', status: 'present', shift: '18:00 - 20:00', note: 'Dự kiến có mặt' },
    { day: 28, weekday: 'T5', status: 'present', shift: '17:30 - 19:30', note: 'Dự kiến có mặt' },
    { day: 29, weekday: 'T6', status: 'present', shift: '18:00 - 20:00', note: 'Dự kiến có mặt' },
    { day: 30, weekday: 'T7', status: 'present', shift: '17:30 - 19:30', note: 'Dự kiến có mặt' },
    { day: 31, weekday: 'CN', status: 'off', shift: 'Nghỉ', note: 'Chủ nhật nghỉ' },
  ];

  // 1. Chỉ lấy những bài tập được giao cho học sinh này hoặc lớp của học sinh này (không hiển thị bài tập lớp khác)
  const studentAssignments = useMemo(() => {
    if (!currentStudent || !currentStudent.id) return [];

    const stId = String(currentStudent.id || '');
    const stClassId = String(currentStudent.classId || currentClass?.id || '').trim().toLowerCase();
    const stClassCode = String(currentClass?.code || '').trim().toLowerCase();
    const stClassName = String(currentStudent.className || currentClass?.name || '').trim().toLowerCase();
    const normSt = stClassName.replace(/^lớp\s+/i, '').trim();

    return (assignments || []).filter((hw) => {
      if (!hw) return false;

      // a. Nếu bài tập có chỉ định danh sách ID học sinh cụ thể
      if (Array.isArray(hw.targetStudentIds) && hw.targetStudentIds.length > 0) {
        return hw.targetStudentIds.some((id) => String(id) === stId);
      }
      if (Array.isArray((hw as any).assignedStudentIds) && (hw as any).assignedStudentIds.length > 0) {
        return (hw as any).assignedStudentIds.some((id: any) => String(id) === stId);
      }

      // b. Nếu bài tập được gán riêng theo studentId
      if (hw.studentId && String(hw.studentId).trim()) {
        return String(hw.studentId).trim() === stId;
      }

      // c. Nếu học sinh này đã có bài nộp trong bài tập này
      if (Array.isArray(hw.submissions) && hw.submissions.some((s) => s && String(s.studentId) === stId)) {
        return true;
      }

      // d. So khớp theo ID lớp học (classId)
      const hwClassId = String(hw.classId || '').trim().toLowerCase();
      if (hwClassId) {
        if (stClassId && hwClassId === stClassId) return true;
        if (stClassCode && hwClassId === stClassCode) return true;
        return false;
      }

      // e. So khớp theo Tên lớp học (className)
      const hwClassName = String(hw.className || '').trim().toLowerCase();
      if (hwClassName) {
        if (stClassName && hwClassName === stClassName) return true;
        const normHw = hwClassName.replace(/^lớp\s+/i, '').trim();
        if (normHw && normSt && normHw === normSt) return true;
        return false;
      }

      return false;
    });
  }, [assignments, currentStudent, currentClass]);

  // Thống kê số lượng bài tập theo trạng thái
  const submittedCount = useMemo(() => {
    return studentAssignments.filter((item) => {
      const studentSub = item.submissions?.find((s) => s.studentId === currentStudent.id);
      return Boolean(studentSub) || item.status === 'completed' || item.status === 'graded' || item.status === 'grading';
    }).length;
  }, [studentAssignments, currentStudent.id]);

  const unsubmittedCount = studentAssignments.length - submittedCount;

  const gradedCount = useMemo(() => {
    return studentAssignments.filter((item) => {
      const studentSub = item.submissions?.find((s) => s.studentId === currentStudent.id);
      return item.score !== undefined || studentSub?.score !== undefined;
    }).length;
  }, [studentAssignments, currentStudent.id]);

  // Helper: Filtered assignments for parent view (lọc theo bộ lọc Đã nộp / Chưa nộp / Có điểm)
  const filteredAssignments = useMemo(() => {
    return studentAssignments.filter((item) => {
      const studentSub = item.submissions?.find((s) => s.studentId === currentStudent.id);
      const isSubmitted = Boolean(studentSub) || item.status === 'completed' || item.status === 'graded' || item.status === 'grading';
      const isGraded = item.score !== undefined || studentSub?.score !== undefined;
      if (homeworkFilter === 'submitted') return isSubmitted;
      if (homeworkFilter === 'unsubmitted') return !isSubmitted;
      if (homeworkFilter === 'graded') return isGraded;
      return true;
    });
  }, [studentAssignments, homeworkFilter, currentStudent.id]);

  // Leave submission handler
  const handleSendLeaveRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLeaveModalOpen(false);
    const msg = `Đã gửi đơn xin nghỉ ngày ${leaveDate} (${leaveSession}) của em ${currentStudent.name} tới GVCN & Trung tâm thành công!`;
    setLeaveSentToast({ show: true, msg });
    if (onRequestLeaveSuccess) {
      onRequestLeaveSuccess(currentStudent.name, leaveDate, leaveReason);
    }
    setTimeout(() => {
      setLeaveSentToast({ show: false, msg: '' });
    }, 4500);
  };

  // Reply submission handler
  const handleSendReply = (remarkId: string) => {
    const text = parentReplyInput[remarkId];
    if (text && text.trim()) {
      setParentReplies((prev) => ({ ...prev, [remarkId]: text.trim() }));
      setParentReplyInput((prev) => ({ ...prev, [remarkId]: '' }));
    }
  };

  const renderAttendanceDot = (status: string) => {
    if (status === 'present') {
      return (
        <span 
          title="Có mặt đúng giờ" 
          className="w-4 h-4 rounded-full bg-[#00A86B] inline-flex items-center justify-center text-white text-[9px] font-bold shadow-xs transition-transform hover:scale-125"
        >
          ✓
        </span>
      );
    }
    if (status === 'excused') {
      return (
        <span 
          title="Vắng có phép" 
          className="w-4 h-4 rounded-full bg-[#F39C12] inline-flex items-center justify-center text-white text-[9px] font-bold shadow-xs transition-transform hover:scale-125"
        >
          !
        </span>
      );
    }
    if (status === 'unexcused') {
      return (
        <span 
          title="Vắng không phép" 
          className="w-4 h-4 rounded-full bg-[#E74C3C] inline-flex items-center justify-center text-white text-[9px] font-bold shadow-xs transition-transform hover:scale-125"
        >
          ✕
        </span>
      );
    }
    return <span title="Không có lịch" className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block" />;
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 pb-10">
      {/* Toast confirmation for leave request */}
      {leaveSentToast.show && (
        <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-400 p-4 text-xs font-bold text-emerald-900 flex items-center justify-between shadow-lg animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#00A86B] text-white shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <div>
              <p className="text-sm font-black text-emerald-950">Gửi đơn thành công!</p>
              <p className="text-xs text-emerald-800 mt-0.5">{leaveSentToast.msg}</p>
            </div>
          </div>
          <button 
            onClick={() => setLeaveSentToast({ show: false, msg: '' })} 
            className="text-emerald-700 hover:text-emerald-950 font-black text-base px-2 py-1 rounded-lg hover:bg-emerald-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. THẺ THÔNG TIN HỌC SINH (Student Overview Card)                         */}
      {/* Viền nổi bật theo màu thương hiệu: #0B486B & #0072B5                      */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border-3 border-[#0072B5] bg-gradient-to-br from-[#0B486B] via-[#0072B5] to-[#0B486B] p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-16 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          {/* Top row: Brand ribbon & Student Switcher for multi-child demo */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/20">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/25 px-3 py-1 text-xs font-black text-amber-200 border border-amber-300/40 tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Sổ Liên Lạc Điện Tử &bull; Trung Tâm Học Giỏi
              </span>
              <span className="text-[11px] font-mono font-bold bg-white/20 px-2.5 py-1 rounded-lg text-white">
                Niên khóa 2023 - 2024
              </span>
            </div>

            {/* Quick Switch Child Selector (if multiple students available) */}
            {allStudents.length > 1 && (
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/25">
                <span className="text-xs font-bold text-blue-100 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-amber-300" />
                  Chọn con:
                </span>
                <select
                  value={activeStudentId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    setActiveStudentId(sid);
                    const found = allStudents.find((s) => s.id === sid);
                    if (found && onSelectStudent) {
                      onSelectStudent(found);
                    }
                  }}
                  className="bg-transparent text-xs font-black text-white focus:outline-hidden cursor-pointer"
                >
                  {allStudents.map((s) => (
                    <option key={s.id} value={s.id} className="text-slate-900 bg-white font-medium">
                      {s.name} ({s.className})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Main profile row */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Identity Info */}
            <div className="flex items-start sm:items-center gap-4 sm:gap-5">
              <div className="relative">
                <AccountAvatar
                  name={currentStudent?.name || 'Học sinh'}
                  role="student"
                  size="2xl"
                  shape="rounded"
                  className="ring-4 ring-white/40 shadow-xl shrink-0"
                />
                <span className="absolute -bottom-1 -right-1 rounded-full bg-[#00A86B] p-1.5 ring-2 ring-white" title="Trạng thái: Đang theo học">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    {currentStudent.name}
                  </h1>
                  <span className="font-mono text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-md text-blue-100 border border-white/20">
                    Mã HS: {currentStudent.id.toUpperCase()}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-blue-100 font-medium">
                  <span className="font-bold flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg">
                    <GraduationCap className="w-4 h-4 text-amber-300" />
                    Lớp: <strong className="text-white font-extrabold">{currentStudent.className}</strong>
                  </span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg">
                    <School className="w-4 h-4 text-emerald-300" />
                    GVCN: <strong className="text-white font-extrabold">{teacherDisplayName}</strong> ({teacherPhoneDisplay})
                  </span>
                  <span>&bull;</span>
                  <span>
                    Phụ huynh: <strong className="text-white">{currentStudent.parentName}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions for Parent: Request Leave & Contact */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-2xl bg-[#F39C12] hover:bg-amber-600 active:scale-95 text-white font-extrabold text-xs sm:text-sm px-4 py-3 shadow-lg transition-all"
              >
                <Send className="w-4 h-4" />
                <span>Gửi Đơn Xin Phép Nghỉ Học</span>
              </button>

              <a
                href="tel:0912345678"
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs sm:text-sm px-4 py-3 border border-white/30 backdrop-blur-xs transition-all"
              >
                <PhoneCall className="w-4 h-4 text-amber-300" />
                <span>Gọi Hotline Trung Tâm</span>
              </a>
            </div>
          </div>

          {/* KPI Summary Cards with Brand Colors */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {/* Card 1: Điểm GPA (Cam ngả vàng #F39C12) */}
            <div className="rounded-2xl border-2 border-amber-300/60 bg-amber-500/20 p-3.5 backdrop-blur-md">
              <div className="flex items-center justify-between text-amber-200 text-xs font-bold">
                <span>Điểm TB (GPA)</span>
                <Award className="w-4 h-4 text-amber-300" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-amber-300">{currentStudent.gpa}</span>
                <span className="text-xs text-amber-200">/ 10</span>
              </div>
              <span className="mt-0.5 inline-block text-[10px] font-extrabold text-white bg-amber-400/30 px-2 py-0.5 rounded">
                Học lực: Xuất sắc
              </span>
            </div>

            {/* Card 2: Chuyên cần (Xanh lá #00A86B) */}
            <div className="rounded-2xl border-2 border-emerald-300/60 bg-emerald-500/20 p-3.5 backdrop-blur-md">
              <div className="flex items-center justify-between text-emerald-200 text-xs font-bold">
                <span>Tỷ lệ Chuyên Cần</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-300">96.8%</span>
              </div>
              <span className="mt-0.5 inline-block text-[10px] font-extrabold text-white bg-emerald-400/30 px-2 py-0.5 rounded">
                21/23 buổi đúng giờ
              </span>
            </div>

            {/* Card 3: Vắng có phép (Xanh dương tươi #0072B5) */}
            <div className="rounded-2xl border-2 border-cyan-300/60 bg-cyan-500/20 p-3.5 backdrop-blur-md">
              <div className="flex items-center justify-between text-cyan-200 text-xs font-bold">
                <span>Số Buổi Vắng</span>
                <CalendarCheck className="w-4 h-4 text-cyan-300" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-cyan-200">2</span>
                <span className="text-xs text-cyan-100">buổi phép</span>
              </div>
              <span className="mt-0.5 inline-block text-[10px] font-extrabold text-white bg-cyan-400/30 px-2 py-0.5 rounded">
                0 buổi không phép
              </span>
            </div>

            {/* Card 4: Bài tập hoàn thành (Đỏ tươi / Cam rực rỡ) */}
            <div className="rounded-2xl border-2 border-indigo-300/60 bg-indigo-500/20 p-3.5 backdrop-blur-md">
              <div className="flex items-center justify-between text-indigo-200 text-xs font-bold">
                <span>Bài Tập Về Nhà</span>
                <FileCheck className="w-4 h-4 text-indigo-300" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-white">100%</span>
                <span className="text-xs text-indigo-200">đã nộp</span>
              </div>
              <span className="mt-0.5 inline-block text-[10px] font-extrabold text-white bg-indigo-400/30 px-2 py-0.5 rounded">
                Điểm gần nhất: {currentStudent.recentGrade}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. LỊCH ĐIỂM DANH DẠNG TUẦN / THÁNG VỚI MÃ MÀU                             */}
      {/* Viền màu nổi bật: Xanh lá cây (#00A86B) & Xanh dương                      */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border-3 border-[#00A86B] bg-white p-5 sm:p-6 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-[#0B486B] flex items-center gap-2">
              <span className="flex h-6 w-2 rounded-full bg-[#00A86B]"></span>
              Lịch Điểm Danh &amp; Theo Dõi Chuyên Cần
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Dữ liệu đồng bộ tức thời từ bảng điểm danh của Giáo viên tại lớp học
            </p>
          </div>

          {/* Toggle View: Theo Tuần vs Theo Tháng */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-2xl bg-slate-100 p-1 border border-slate-200 shadow-inner">
              <button
                type="button"
                onClick={() => setAttendanceViewMode('week')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  attendanceViewMode === 'week'
                    ? 'bg-white text-[#0B486B] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📅 Xem Theo Tuần
              </button>
              <button
                type="button"
                onClick={() => setAttendanceViewMode('month')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  attendanceViewMode === 'month'
                    ? 'bg-[#00A86B] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🗓️ Lịch Cả Tháng (Tháng 3/2024)
              </button>
            </div>
          </div>
        </div>

        {/* Brand Legend: Mã màu chuẩn */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3.5 text-xs text-slate-700 border border-slate-200/80">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-semibold">
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-[#00A86B] shadow-xs inline-flex items-center justify-center text-white text-[9px] font-bold">✓</span>
              <span><strong className="text-emerald-700">Màu Xanh lá</strong>: Có mặt đúng giờ (21 buổi)</span>
            </span>

            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-[#F39C12] shadow-xs inline-flex items-center justify-center text-white text-[9px] font-bold">!</span>
              <span><strong className="text-amber-700">Màu Cam</strong>: Vắng có phép (2 buổi)</span>
            </span>

            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-[#E74C3C] shadow-xs inline-flex items-center justify-center text-white text-[9px] font-bold">✕</span>
              <span><strong className="text-rose-700">Màu Đỏ</strong>: Vắng không phép (0 buổi)</span>
            </span>
          </div>

          <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-xl border border-emerald-200">
            Tổng kết: Đạt chuẩn 96.8% Chuyên cần
          </span>
        </div>

        {/* View 1: Chế độ Xem Theo Tuần (Weekly Matrix) */}
        {attendanceViewMode === 'week' && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-center text-xs">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-600 font-extrabold bg-slate-50/80">
                  <th className="py-3 px-4 text-left font-black text-slate-800">Tuần Học</th>
                  <th className="py-3 px-3">Thứ Hai (M)</th>
                  <th className="py-3 px-3">Thứ Ba (T)</th>
                  <th className="py-3 px-3">Thứ Tư (W)</th>
                  <th className="py-3 px-3">Thứ Năm (T)</th>
                  <th className="py-3 px-3">Thứ Sáu (F)</th>
                  <th className="py-3 px-3">Thứ Bảy (S)</th>
                  <th className="py-3 px-4 text-right">Tổng Kết Tuần</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {INITIAL_WEEKLY_ATTENDANCE.map((row, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3.5 px-4 text-left font-black text-[#0B486B] text-sm">
                      {row.weekLabel}
                    </td>
                    <td className="py-3.5 px-3">{renderAttendanceDot(row.mon)}</td>
                    <td className="py-3.5 px-3">{renderAttendanceDot(row.tue)}</td>
                    <td className="py-3.5 px-3">{renderAttendanceDot(row.wed)}</td>
                    <td className="py-3.5 px-3">{renderAttendanceDot(row.thu)}</td>
                    <td className="py-3.5 px-3">{renderAttendanceDot(row.fri)}</td>
                    <td className="py-3.5 px-3">{renderAttendanceDot(row.sat)}</td>
                    <td className="py-3.5 px-4 text-right">
                      {idx === 1 ? (
                        <span className="font-bold text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                          Nghỉ 1 buổi (Khám mắt)
                        </span>
                      ) : idx === 2 ? (
                        <span className="font-bold text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                          Nghỉ 1 buổi (Khám răng)
                        </span>
                      ) : (
                        <span className="font-bold text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                          ✓ Đầy đủ 100%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* View 2: Chế độ Xem Lịch Cả Tháng (Full Month 3/2024 Calendar) */}
        {attendanceViewMode === 'month' && (
          <div className="mt-5 space-y-3">
            <div className="grid grid-cols-7 gap-2 sm:gap-2.5 text-center text-xs">
              {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'].map((d, i) => (
                <div key={i} className="font-extrabold text-slate-600 py-2 bg-slate-100 rounded-xl">
                  {d}
                </div>
              ))}

              {MARCH_CALENDAR_DAYS.map((item) => {
                const isPresent = item.status === 'present';
                const isExcused = item.status === 'excused';
                const isOff = item.status === 'off';

                return (
                  <div
                    key={item.day}
                    className={`p-2 sm:p-2.5 rounded-2xl border-2 flex flex-col items-center justify-between min-h-[68px] transition-all hover:scale-102 hover:shadow-md ${
                      isPresent
                        ? 'border-emerald-300 bg-emerald-50/50 text-emerald-950'
                        : isExcused
                        ? 'border-amber-400 bg-amber-50/80 text-amber-950'
                        : 'border-slate-200 bg-slate-50/50 text-slate-400'
                    }`}
                  >
                    <div className="w-full flex items-center justify-between">
                      <span className="font-black text-xs sm:text-sm">{item.day}</span>
                      {isPresent && (
                        <span className="w-3.5 h-3.5 rounded-full bg-[#00A86B] text-white flex items-center justify-center text-[9px] font-bold shadow-2xs">
                          ✓
                        </span>
                      )}
                      {isExcused && (
                        <span className="w-3.5 h-3.5 rounded-full bg-[#F39C12] text-white flex items-center justify-center text-[9px] font-bold shadow-2xs">
                          !
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] sm:text-[11px] font-bold text-center w-full mt-1">
                      {isPresent ? (
                        <span className="text-emerald-700 bg-emerald-100/70 px-1 rounded block truncate">
                          {item.shift}
                        </span>
                      ) : isExcused ? (
                        <span className="text-amber-800 bg-amber-100 px-1 rounded block truncate" title={item.note}>
                          Có phép
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </div>

                    <div className="text-[9px] text-slate-400 truncate w-full text-center mt-0.5">
                      {item.note}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. LỊCH SỬ NHẬN XÉT & BÀI TẬP VỀ NHÀ                                      */}
      {/* 2 CỘT: Cột Trái: Timeline Nhận xét (Viền #0072B5)                         */}
      {/*        Cột Phải: Danh Sách Bài Tập & Lời Phê Chấm Bài (Viền #F39C12)      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CỘT TRÁI (7/12): TIMELINE XEM NHẬN XÉT HÀNG NGÀY CỦA GIÁO VIÊN */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-3xl border-3 border-[#0072B5] bg-white p-5 sm:p-6 shadow-md">
            <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-[#0B486B] flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#0072B5]" />
                  Timeline Nhận Xét Hàng Ngày Của Giáo Viên
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nhật ký ghi nhận trực tiếp sau mỗi ca học kèm ngày giờ chi tiết
                </p>
              </div>

              <span className="text-xs font-extrabold text-[#0072B5] bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                {timelineRemarks.length} nhận xét
              </span>
            </div>

            {/* Timeline Stream */}
            <div className="mt-5 relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-1 before:bg-blue-100">
              {timelineRemarks.map((remark) => (
                <div key={remark.id} className="relative group">
                  {/* Timeline bullet dot with brand color */}
                  <span className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-[#0072B5] ring-4 ring-blue-100 shadow-xs" />

                  {/* Card Container with soft border */}
                  <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/60 p-4 sm:p-5 hover:bg-white hover:border-[#0072B5] hover:shadow-md transition-all space-y-3">
                    {/* Header: Teacher Avatar, Name & Exact Date/Time */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <AccountAvatar
                          name={remark.teacherName}
                          role="teacher"
                          size="md"
                          className="ring-2 ring-blue-200 shadow-xs shrink-0"
                        />
                        <div>
                          <div className="text-sm font-black text-slate-800">
                            {remark.teacherName}
                          </div>
                          <div className="text-xs text-slate-500 font-medium">
                            {remark.teacherRole} &bull; Môn {remark.subject}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`inline-block text-xs font-black px-2.5 py-1 rounded-full border ${remark.badgeStyle}`}>
                          {remark.highlightBadge}
                        </span>
                        <div className="text-xs text-slate-500 font-semibold mt-1 flex items-center justify-end gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{remark.date} &bull; {remark.time}</span>
                        </div>
                      </div>
                    </div>

                    {/* Comment Content Box */}
                    <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-2xs">
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                        &ldquo;{remark.content}&rdquo;
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-md">
                          <CheckCircle2 className="w-4 h-4 text-[#00A86B]" /> {remark.homeworkStatus}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400">
                          ✓ Đã gửi tin nhắn thông báo phụ huynh
                        </span>
                      </div>
                    </div>

                    {/* Parent Reply Section */}
                    {parentReplies[remark.id] ? (
                      <div className="rounded-xl bg-emerald-50/80 p-3 border border-emerald-300 text-xs text-emerald-950">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-[#00A86B] flex items-center gap-1">
                            <HeartHandshake className="w-3.5 h-3.5" />
                            Phản hồi của phụ huynh (Bạch Duyên Thị Hoa):
                          </span>
                          <span className="text-[10px] text-emerald-700 font-semibold">Đã gửi tới GV</span>
                        </div>
                        <p className="mt-1 text-slate-700 italic font-medium">
                          &ldquo;{parentReplies[remark.id]}&rdquo;
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={parentReplyInput[remark.id] || ''}
                          onChange={(e) => setParentReplyInput({ ...parentReplyInput, [remark.id]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendReply(remark.id);
                          }}
                          placeholder="Nhập lời cảm ơn hoặc nhắn lại cô giáo..."
                          className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-200"
                        />
                        <button
                          type="button"
                          onClick={() => handleSendReply(remark.id)}
                          className="px-3.5 py-2 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Gửi</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI (5/12): DANH SÁCH BÀI TẬP VỀ NHÀ, ĐIỂM SỐ & LỜI PHÊ */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-3xl border-3 border-[#F39C12] bg-white p-5 sm:p-6 shadow-md">
            <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-[#0B486B] flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#F39C12]" />
                  Danh Sách Bài Tập Về Nhà &amp; Sổ Điểm
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tên bài, hạn nộp, trạng thái nộp bài, điểm số và lời phê của GV
                </p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setHomeworkFilter('all')}
                className={`py-1.5 rounded-xl transition-all ${
                  homeworkFilter === 'all' ? 'bg-white text-[#0B486B] shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Tất cả ({studentAssignments.length})
              </button>
              <button
                type="button"
                onClick={() => setHomeworkFilter('submitted')}
                className={`py-1.5 rounded-xl transition-all ${
                  homeworkFilter === 'submitted' ? 'bg-white text-[#00A86B] shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Đã nộp ({submittedCount})
              </button>
              <button
                type="button"
                onClick={() => setHomeworkFilter('unsubmitted')}
                className={`py-1.5 rounded-xl transition-all ${
                  homeworkFilter === 'unsubmitted' ? 'bg-white text-[#E74C3C] shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Chưa nộp ({unsubmittedCount > 0 ? unsubmittedCount : 0})
              </button>
              <button
                type="button"
                onClick={() => setHomeworkFilter('graded')}
                className={`py-1.5 rounded-xl transition-all ${
                  homeworkFilter === 'graded' ? 'bg-white text-[#F39C12] shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Có điểm ({gradedCount})
              </button>
            </div>

            {/* Homework List Cards */}
            <div className="mt-4 space-y-3 max-h-[580px] overflow-y-auto pr-1">
              {filteredAssignments.map((hw) => {
                const mySub = hw.submissions?.find((s) => s.studentId === currentStudent.id);
                const isGraded = hw.score !== undefined || mySub?.score !== undefined;
                const finalScore = hw.score !== undefined ? hw.score : mySub?.score;
                const isSubmitted = Boolean(mySub) || hw.status === 'completed' || hw.status === 'graded';
                const hasAttachment = Boolean(hw.attachedFile || hw.attachedFileUrl);
                const ext = (hw.attachedFile || '').split('.').pop()?.toLowerCase();
                const isImg =
                  hw.attachedFileType === 'image' ||
                  /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(hw.attachedFile || '') ||
                  Boolean(hw.attachedFileUrl && hw.attachedFileUrl.startsWith('data:image/'));
                const isPdf = hw.attachedFileType === 'pdf' || ext === 'pdf';

                return (
                  <div
                    key={hw.id}
                    className="rounded-2xl border-2 border-slate-200 bg-white p-4 hover:border-[#F39C12] hover:shadow-md transition-all space-y-3"
                  >
                    {/* Top Row: Title, Due Date, Status Badge & Score */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-black text-sm text-slate-800 leading-snug">
                          {hw.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {hw.subject}
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1 font-bold text-amber-700">
                            <Clock className="w-3.5 h-3.5" /> Hạn nộp: {hw.dueDate}
                          </span>
                        </div>
                      </div>

                      {/* Score or Status Badge */}
                      <div className="text-right shrink-0">
                        {(mySub?.score !== undefined || hw.score !== undefined) ? (
                          <div className="flex flex-col items-end">
                            <span className="text-base font-black text-[#00A86B] bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-300 shadow-2xs">
                              {(mySub?.score !== undefined ? mySub.score : hw.score)?.toFixed(1)} / 10
                            </span>
                            <span className="text-[10px] font-bold text-emerald-700 mt-0.5">
                              Đã chấm điểm
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className={`text-xs font-black px-2.5 py-1 rounded-xl border ${
                              isSubmitted
                                ? 'bg-emerald-50 text-[#00A86B] border-emerald-200'
                                : 'bg-rose-50 text-[#E74C3C] border-rose-200'
                            }`}>
                              {isSubmitted ? 'Đã nộp bài' : 'Chưa nộp (Đang làm)'}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 mt-0.5">
                              {isSubmitted ? 'Chờ cô giáo chấm' : 'Cần nộp trước hạn'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Teacher instructions / Dặn dò */}
                    {hw.content && (
                      <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200 text-xs text-slate-700">
                        <span className="font-bold text-[#0072B5] block mb-0.5">Lời dặn của cô giáo:</span>
                        <p className="leading-relaxed whitespace-pre-wrap">{hw.content}</p>
                      </div>
                    )}

                    {/* Teacher attached homework file / photo preview button */}
                    {hasAttachment && (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {isImg && hw.attachedFileUrl ? (
                            <img
                              src={hw.attachedFileUrl}
                              alt={hw.attachedFile || 'Đề bài'}
                              className="w-9 h-9 object-cover rounded-lg border border-blue-200 shrink-0"
                            />
                          ) : (
                            <div className="p-1.5 rounded-lg bg-blue-100 text-[#0072B5] shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-[10px] font-black uppercase text-blue-800 block">
                              {isImg ? 'Ảnh chụp đề bài' : isPdf ? 'Tệp đề bài PDF' : 'Tài liệu bài tập'}
                            </span>
                            <span className="text-xs font-bold text-slate-800 truncate block" title={hw.attachedFile || ''}>
                              {hw.attachedFile || 'De_bai_tap'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setPreviewDoc({
                              fileName: hw.attachedFile || (isImg ? `${hw.title}.jpg` : `${hw.title}.pdf`),
                              fileUrl: hw.attachedFileUrl,
                              fileType: isImg ? 'image' : isPdf ? 'pdf' : 'word',
                              assignmentTitle: hw.title,
                              subject: hw.subject,
                              className: currentStudent.className,
                              teacherName: teacherDisplayName,
                              dueDate: hw.dueDate,
                              assignmentContent: hw.content || '',
                            });
                            setIsPreviewOpen(true);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#0072B5] hover:bg-[#0B486B] transition-all shadow-2xs cursor-pointer shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem đề bài</span>
                        </button>
                      </div>
                    )}

                    {/* Student submission info if already submitted */}
                    {mySub && (
                      <div className="rounded-xl bg-emerald-50/90 p-3 border border-emerald-300 text-xs text-emerald-950 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="font-extrabold text-[#00A86B] flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-[#00A86B]" />
                            Đã nộp bài lúc: {mySub.submittedAt}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                            {mySub.fileName}
                          </span>
                        </div>
                        {mySub.note && (
                          <p className="text-slate-700 italic bg-white/80 p-2 rounded-lg border border-emerald-200">
                            Lời nhắn: &ldquo;{mySub.note}&rdquo;
                          </p>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewDoc({
                                fileName: mySub.fileName,
                                fileUrl: mySub.fileUrl,
                                fileType: mySub.fileType,
                                assignmentTitle: `${hw.title} - Bài nộp của ${currentStudent.name}`,
                                subject: hw.subject,
                                className: currentStudent.className,
                                teacherName: teacherDisplayName,
                                dueDate: hw.dueDate,
                                assignmentContent: mySub.note ? `Lời nhắn từ phụ huynh: ${mySub.note}` : '',
                              });
                              setIsPreviewOpen(true);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem bài đã nộp</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenSubmitModal(hw)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-[#0072B5] hover:bg-blue-50 transition-all cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Nộp lại / Gửi thêm</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Teacher Grading Feedback Quote (Lời Phê Chấm Bài Từ Giáo Viên) */}
                    {(mySub?.feedback || hw.comment) && (
                      <div className="rounded-xl bg-amber-50/70 p-3 border border-amber-200/90 text-xs text-slate-700">
                        <strong className="text-[#0B486B] not-italic block font-black text-xs mb-1 flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-[#F39C12]" />
                          Lời phê chấm bài từ Giáo viên:
                        </strong>
                        <p className="italic leading-relaxed text-slate-800">
                          &ldquo;{mySub?.feedback || hw.comment}&rdquo;
                        </p>
                      </div>
                    )}

                    {/* Teacher corrected file if provided */}
                    {mySub?.teacherCorrectedFileUrl && (
                      <div className="rounded-xl bg-blue-50 p-3 border border-blue-200 text-xs flex items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-[#0072B5] block">Bài sửa / Chấm chữa từ giáo viên:</span>
                          <span className="text-slate-700 font-semibold">{mySub.teacherCorrectedFileName || 'Bai_sua_cua_co.pdf'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewDoc({
                              fileName: mySub.teacherCorrectedFileName || 'Bai_sua_cua_co.pdf',
                              fileUrl: mySub.teacherCorrectedFileUrl,
                              fileType: 'pdf',
                              assignmentTitle: `${hw.title} - Bài sửa của cô`,
                              subject: hw.subject,
                              className: currentStudent.className,
                              teacherName: teacherDisplayName,
                              dueDate: hw.dueDate,
                              assignmentContent: mySub.feedback || '',
                            });
                            setIsPreviewOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#0072B5] text-white font-bold text-xs shrink-0 cursor-pointer"
                        >
                          Xem bài sửa
                        </button>
                      </div>
                    )}

                    {/* Button Nộp Bài / Gửi bài làm cho cô nếu chưa nộp */}
                    {!mySub && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => handleOpenSubmitModal(hw)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-extrabold text-xs text-white bg-[#00A86B] hover:bg-emerald-700 shadow-sm transition-all cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Nộp bài / Gửi bài làm cho cô</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredAssignments.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Không có bài tập nào phù hợp với bộ lọc hiện tại.
                </div>
              )}
            </div>
          </div>

          {/* Quick Hotline & Center Contact Card (Viền #0B486B) */}
          <div className="rounded-3xl border-3 border-[#0B486B] bg-gradient-to-br from-blue-50/90 via-white to-amber-50/50 p-5 shadow-sm text-xs space-y-3">
            <div className="font-black text-sm text-[#0B486B] flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-[#0072B5]" />
              Kênh Trao Đổi Trực Tiếp Phụ Huynh &amp; Giáo Viên
            </div>
            <p className="text-slate-600 leading-relaxed">
              Mọi thắc mắc về tình hình học tập, kết quả điểm số hoặc xin tài liệu học thêm, phụ huynh có thể liên hệ trực tiếp với <strong>{teacherDisplayName} (GVCN)</strong> hoặc Ban Quản lý Trung tâm:
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href={`tel:${teacherPhoneDisplay.replace(/[^0-9]/g, '') || '0988123456'}`}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0072B5] text-white font-bold hover:bg-[#0B486B] transition-colors shadow-xs"
              >
                <PhoneCall className="w-4 h-4" />
                <span>GVCN: {teacherPhoneDisplay}</span>
              </a>
              <span className="text-slate-500 font-semibold">Giờ tiếp phụ huynh: 08:00 - 21:00 hàng ngày</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: GỬI ĐƠN XIN NGHỈ HỌC (Leave Request Modal)                        */}
      {/* ========================================================================= */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl bg-white p-5 sm:p-7 shadow-2xl animate-fade-in border-2 border-amber-300">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-100 text-[#F39C12]">
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Gửi Đơn Xin Phép Nghỉ Học</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Học sinh: {currentStudent.name} &bull; {currentStudent.className}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendLeaveRequest} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Học sinh xin nghỉ</label>
                <input
                  type="text"
                  disabled
                  value={`${currentStudent.name} (${currentStudent.className || 'Lớp học'}) - GVCN: ${teacherDisplayName}`}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 p-2.5 font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Ngày xin phép nghỉ</label>
                  <input
                    type="date"
                    required
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Ca học xin nghỉ</label>
                  <select
                    value={leaveSession}
                    onChange={(e) => setLeaveSession(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-200"
                  >
                    <option value="Ca tối (18:00 - 20:00)">Ca tối (18:00 - 20:00)</option>
                    <option value="Ca chiều (17:30 - 19:30)">Ca chiều (17:30 - 19:30)</option>
                    <option value="Cả ngày">Cả ngày</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Lý do xin phép nghỉ học</label>
                <textarea
                  rows={3}
                  required
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Nhập lý do chi tiết để giáo viên chuẩn bị tài liệu học bù..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-200 leading-relaxed"
                />
              </div>

              <div className="rounded-2xl bg-amber-50 p-3.5 border border-amber-300/80 text-xs text-amber-900 space-y-1">
                <span className="font-extrabold flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="w-4 h-4 text-[#F39C12]" />
                  Chính sách điểm danh của Trung tâm Học Giỏi:
                </span>
                <p className="text-[11px] leading-relaxed text-amber-950">
                  Đơn xin nghỉ gửi trước giờ học sẽ được trung tâm tự động xếp vào diện <strong>Vắng có phép (Màu Cam)</strong>. Giáo viên chủ nhiệm sẽ gửi phiếu bài giảng và bài tập về nhà để học sinh không bị hổng kiến thức.
                </p>
              </div>

              <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-[#F39C12] hover:bg-amber-600 active:scale-95 text-white px-5 py-2.5 font-black shadow-md transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>Gửi Đơn Xin Nghỉ Học</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: XEM CHI TIẾT BÀI TẬP VỀ NHÀ                                      */}
      {/* ========================================================================= */}
      {viewingAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl animate-fade-in border-2 border-blue-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-[#0072B5]">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">Chi Tiết Bài Tập</h3>
                  <p className="text-xs text-slate-500">{viewingAssignment.subject}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingAssignment(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-slate-700">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Tên bài tập:</span>
                <p className="font-extrabold text-sm text-[#0B486B] mt-0.5">{viewingAssignment.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Hạn nộp:</span>
                  <span className="font-bold text-slate-800">{viewingAssignment.dueDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Trạng thái:</span>
                  <span className="font-bold text-[#00A86B]">
                    {viewingAssignment.status === 'completed' ? 'Đã hoàn thành' : 'Đang làm'}
                  </span>
                </div>
              </div>

              {viewingAssignment.comment && (
                <div className="rounded-xl bg-amber-50 p-3 border border-amber-200">
                  <span className="font-bold text-amber-800 block mb-1">Lời phê giáo viên:</span>
                  <p className="italic text-slate-700">&ldquo;{viewingAssignment.comment}&rdquo;</p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingAssignment(null)}
                  className="rounded-xl bg-[#0072B5] text-white px-4 py-2 font-bold hover:bg-[#0B486B] transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST THÔNG BÁO NỘP BÀI TẬP */}
      {submitToast.show && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-2xl p-4 text-xs font-bold text-white shadow-xl animate-fade-in ${
            submitToast.type === 'success' ? 'bg-[#00A86B]' : 'bg-[#E74C3C]'
          }`}
        >
          {submitToast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{submitToast.msg}</span>
        </div>
      )}

      {/* MODAL 3: NỘP BÀI LÀM / GỬI TÀI LIỆU CHO CÔ GIÁO */}
      {isSubmitModalOpen && selectedHwToSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-5 animate-fade-in overflow-hidden">
          <div className="flex flex-col w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold">Nộp Bài Làm Cho Cô Giáo</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Học sinh: <strong className="text-white">{currentStudent.name}</strong> &bull; Môn: {selectedHwToSubmit.subject}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSubmitModalOpen(false);
                  setSubmissionFile(null);
                  setSubmissionPreviewUrl(null);
                }}
                className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitHomework} className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[75vh]">
              {/* Assignment Brief */}
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs space-y-1">
                <div className="font-extrabold text-[#0B486B] text-sm">{selectedHwToSubmit.title}</div>
                <div className="text-slate-600 flex items-center gap-3">
                  <span>Hạn nộp: <strong className="text-amber-800">{selectedHwToSubmit.dueDate}</strong></span>
                  <span>GV: <strong className="text-slate-800">{teacherDisplayName}</strong></span>
                </div>
                {selectedHwToSubmit.content && (
                  <p className="text-slate-700 italic pt-1 border-t border-blue-100">
                    &ldquo;{selectedHwToSubmit.content}&rdquo;
                  </p>
                )}
              </div>

              {/* Upload & Camera Buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Chọn ảnh chụp bài làm hoặc file PDF:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleOpenCameraModal}
                    className="flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/70 hover:bg-amber-100 hover:border-amber-400 transition-all text-amber-900 cursor-pointer"
                  >
                    <Camera className="w-6 h-6 text-amber-600 mb-1" />
                    <span className="text-xs font-bold">Chụp ảnh trực tiếp</span>
                    <span className="text-[10px] text-amber-700">Mở Camera điện thoại/máy</span>
                  </button>

                  <label className="flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 hover:border-emerald-400 transition-all text-emerald-900 cursor-pointer">
                    <ImageIcon className="w-6 h-6 text-emerald-600 mb-1" />
                    <span className="text-xs font-bold">Tải ảnh chụp từ máy</span>
                    <span className="text-[10px] text-emerald-700">Thư viện ảnh hoặc file</span>
                    <input
                      type="file"
                      accept="image/*,.pdf,.docx,.doc"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleSelectSubmissionFile(e.target.files[0]);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Selected file preview */}
              {submissionFile && (
                <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-1.5 truncate max-w-[280px]">
                      <Paperclip className="w-4 h-4 text-[#0072B5] shrink-0" />
                      <span className="truncate">{submissionFile.name}</span>
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                      {submissionFileType === 'image' ? 'Ảnh chụp' : 'Tệp PDF'}
                    </span>
                  </div>

                  {submissionFileType === 'image' && submissionPreviewUrl && (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-48 flex items-center justify-center bg-white p-1">
                      <img src={submissionPreviewUrl} alt="Bài làm" className="max-h-44 object-contain rounded-lg" />
                    </div>
                  )}
                </div>
              )}

              {/* Optional Parent Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lời nhắn gửi cô giáo (không bắt buộc):
                </label>
                <textarea
                  rows={2}
                  value={submissionNote}
                  onChange={(e) => setSubmissionNote(e.target.value)}
                  placeholder="Ví dụ: Cháu đã làm xong bài 1 và 2, nhờ cô kiểm tra giúp cháu..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitModalOpen(false);
                    setSubmissionFile(null);
                    setSubmissionPreviewUrl(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !submissionFile}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#00A86B] hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tải lên Firebase Storage...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Gửi Bài Làm Cho Cô</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CAMERA VIEW FINDER CHO PHỤ HUYNH CHỤP ẢNH BÀI LÀM */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-extrabold">Chụp Ảnh Bài Làm Của Con</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseCameraModal}
                className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 flex flex-col items-center justify-center min-h-[300px] relative">
              {cameraError ? (
                <div className="text-center p-6 space-y-3 max-w-md">
                  <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">{cameraError}</p>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all">
                    <ImageIcon className="w-4 h-4" />
                    <span>Chọn Ảnh Bài Làm Từ Thiết Bị</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleSelectSubmissionFile(e.target.files[0]);
                          handleCloseCameraModal();
                        }
                      }}
                    />
                  </label>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-[55vh] object-contain rounded-2xl border border-slate-800 bg-black"
                />
              )}
            </div>

            <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const nextMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
                  setCameraFacingMode(nextMode);
                  startCameraStream(nextMode);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Đổi Camera</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseCameraModal}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                {!cameraError && (
                  <button
                    type="button"
                    onClick={handleCapturePhotoFromCamera}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00A86B] hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Chụp Ảnh Này</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: TRÌNH XEM TRƯỚC TÀI LIỆU / ĐỀ BÀI / BÀI NỘP TOÀN MÀN HÌNH */}
      <DocumentPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        document={previewDoc}
      />
    </div>
  );
};
