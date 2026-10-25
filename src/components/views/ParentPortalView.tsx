import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  HeartHandshake, 
  Calendar, 
  Award, 
  CheckCircle,
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
  Loader2,
  Table,
  XCircle,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Printer,
  DollarSign,
  Lock,
  QrCode,
  Copy
} from 'lucide-react';
import { StudentItem, AssignmentItem, TeacherItem, ClassItem, INITIAL_WEEKLY_ATTENDANCE, AssignmentSubmission } from '../../data/mockData';
import { AccountAvatar } from '../common/AccountAvatar';
import { DocumentPreviewModal, DocumentPreviewData } from '../common/DocumentPreviewModal';
import {
  submitStudentHomework,
  getRealtimeAttendance,
  MonthlyTuitionLockItem,
  getRealtimeMonthlyTuitionLocks,
  calculateStudentMonthlyAttendedSessions,
  CenterPaymentSettings,
  getRealtimeCenterPaymentSettings,
  TuitionPaymentRecord,
  getRealtimeCenterTuitionPayments,
  checkPayOSPaymentStatus,
  buildPayOSIframeListenerUrl,
  parsePayOSPostMessageEvent,
  recordStudentTuitionPaymentSuccess,
  normalizeTuitionMonthPair,
} from '../../services/firebaseService';
import { TuitionPaymentModal } from './TuitionPaymentModal';

interface ParentPortalViewProps {
  student?: StudentItem | null;
  assignments: AssignmentItem[];
  allStudents?: StudentItem[];
  classes?: ClassItem[];
  teachers?: TeacherItem[];
  activeCenterId?: string;
  centerName?: string;
  attendanceRecords?: any[];
  activeTab?: 'attendance' | 'homework' | 'remarks';
  initialTab?: 'attendance' | 'homework' | 'remarks';
  onTabChange?: (tab: 'attendance' | 'homework' | 'remarks') => void;
  onSelectStudent?: (student: StudentItem) => void;
  onRequestLeaveSuccess?: (studentName: string, date: string, reason: string) => void;
}

const EMPTY_STUDENT_LIST: StudentItem[] = [];
const EMPTY_CLASS_LIST: ClassItem[] = [];
const EMPTY_TEACHER_LIST: TeacherItem[] = [];
const EMPTY_ATTENDANCE_LIST: any[] = [];

const EMPTY_PLACEHOLDER_STUDENT: StudentItem = {
  id: '',
  name: 'Chưa có học sinh',
  classId: '',
  className: 'Chưa có lớp',
  avatar: '',
  attendanceStatus: 'present',
  note: '',
  parentName: 'Chưa cập nhật',
  parentPhone: '',
  gpa: 0,
  recentGrade: '—',
};

export const ParentPortalView: React.FC<ParentPortalViewProps> = ({
  student,
  assignments,
  allStudents = EMPTY_STUDENT_LIST,
  classes = EMPTY_CLASS_LIST,
  teachers = EMPTY_TEACHER_LIST,
  activeCenterId,
  centerName = 'Trung Tâm Đào Tạo',
  attendanceRecords: propAttendanceRecords = EMPTY_ATTENDANCE_LIST,
  activeTab: activeTabProp,
  initialTab,
  onTabChange,
  onSelectStudent,
  onRequestLeaveSuccess,
}) => {
  // Chỉ lấy danh sách học sinh thực tế của trung tâm (loại bỏ hoàn toàn bản ghi mặc định ảo)
  const validStudents = useMemo(() => {
    return (allStudents || []).filter((s) => s && s.id && s.id !== 'student-default');
  }, [allStudents]);

  const validPropStudent = student && student.id && student.id !== 'student-default' ? student : null;
  const hasAnyStudent = validStudents.length > 0 || Boolean(validPropStudent);

  const [activeStudentId, setActiveStudentId] = useState<string>(
    validPropStudent?.id || validStudents[0]?.id || ''
  );

  // Tự động đồng bộ activeStudentId theo đúng học sinh của tài khoản phụ huynh đang đăng nhập
  useEffect(() => {
    if (!hasAnyStudent) {
      if (activeStudentId !== '') {
        setActiveStudentId('');
      }
      return;
    }
    if (validPropStudent?.id) {
      if (activeStudentId !== validPropStudent.id) {
        setActiveStudentId(validPropStudent.id);
      }
      return;
    }
    if (activeStudentId && validStudents.some((s) => s.id === activeStudentId)) {
      return;
    }
    const nextId = validStudents[0]?.id || '';
    if (nextId !== activeStudentId) {
      setActiveStudentId(nextId);
    }
  }, [hasAnyStudent, validStudents, validPropStudent, activeStudentId]);

  const currentStudent: StudentItem = hasAnyStudent
    ? validPropStudent || validStudents.find((s) => s.id === activeStudentId) || validStudents[0]
    : EMPTY_PLACEHOLDER_STUDENT;

  const [internalTab, setInternalTab] = useState<'attendance' | 'homework' | 'remarks'>(activeTabProp || initialTab || 'attendance');
  const activeTab = activeTabProp || internalTab;

  useEffect(() => {
    if (activeTabProp) {
      setInternalTab(activeTabProp);
    }
  }, [activeTabProp]);

  const handleSwitchTab = (tab: 'attendance' | 'homework' | 'remarks') => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };
  const setActiveTab = handleSwitchTab;

  const [localAttendanceRecords, setLocalAttendanceRecords] = useState<any[]>(propAttendanceRecords || []);
  const [isAttendanceSyncing, setIsAttendanceSyncing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(() => new Date().toLocaleTimeString('vi-VN'));
  const [selectedAttendanceMonth, setSelectedAttendanceMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [tuitionLocks, setTuitionLocks] = useState<MonthlyTuitionLockItem[]>([]);
  const [isTuitionModalOpen, setIsTuitionModalOpen] = useState<boolean>(false);
  const [centerPaymentSettings, setCenterPaymentSettings] = useState<CenterPaymentSettings | null>(null);
  const [paidMonthsMap, setPaidMonthsMap] = useState<Record<string, boolean>>({});
  const [centerTuitionPayments, setCenterTuitionPayments] = useState<TuitionPaymentRecord[]>([]);

  // Lắng nghe trạng thái Chốt sổ học phí tháng từ center_admin theo thời gian thực
  useEffect(() => {
    const effectiveCId = (activeCenterId || currentStudent?.centerId || '').trim();
    const unsub = getRealtimeMonthlyTuitionLocks(effectiveCId, (locks) => {
      setTuitionLocks(locks);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [activeCenterId, currentStudent?.centerId]);

  // Lắng nghe danh sách giao dịch học phí của trung tâm theo thời gian thực
  useEffect(() => {
    const effectiveCId = (activeCenterId || currentStudent?.centerId || '').trim();
    const unsub = getRealtimeCenterTuitionPayments(effectiveCId, (payments) => {
      setCenterTuitionPayments(payments);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [activeCenterId, currentStudent?.centerId]);

  // Danh sách các đơn PENDING của học sinh hiện tại có paymentLinkId / checkoutUrl
  const pendingOrdersForCurrentStudent = useMemo(() => {
    if (!currentStudent?.id || centerTuitionPayments.length === 0) return [];
    const stId = String(currentStudent.id).trim();
    return centerTuitionPayments.filter(
      (p) =>
        p &&
        p.status === 'PENDING' &&
        String(p.studentId || '').trim() === stId &&
        Boolean(p.paymentLinkId || p.checkoutUrl)
    );
  }, [centerTuitionPayments, currentStudent?.id]);

  // Tự động kiểm tra các đơn PENDING có paymentLinkId trên PayOS (trong trường hợp phụ huynh đã quét QR nhưng đóng modal hoặc tải lại trang)
  useEffect(() => {
    if (pendingOrdersForCurrentStudent.length === 0) return;

    let cancelled = false;
    const verifyPendingOrders = async () => {
      for (const order of pendingOrdersForCurrentStudent) {
        if (cancelled) return;
        const res = await checkPayOSPaymentStatus({
          paymentLinkId: order.paymentLinkId,
          checkoutUrl: order.checkoutUrl,
        });
        if (!cancelled && res.isPaid) {
          await recordStudentTuitionPaymentSuccess({
            orderCode: order.orderCode,
            paymentLinkId: order.paymentLinkId,
            centerId: order.centerId || (activeCenterId || currentStudent.centerId || 'HG01').trim(),
            centerName: order.centerName || centerName,
            studentId: order.studentId,
            studentName: order.studentName || currentStudent.name,
            classId: order.classId || currentStudent.classId,
            className: order.className || currentStudent.className,
            month: order.displayMonth || order.month,
            attendedSessions: order.attendedSessions,
            amount: order.amount,
            description: order.description,
          });
          setPaidMonthsMap((prev) => ({
            ...prev,
            [order.displayMonth]: true,
            [order.isoMonth]: true,
          }));
        }
      }
    };

    verifyPendingOrders();
    const timer = setInterval(verifyPendingOrders, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pendingOrdersForCurrentStudent, currentStudent, activeCenterId, centerName]);

  // Lắng nghe sự kiện postMessage từ iframe pay.payos.vn cho các đơn PENDING của học sinh (hoạt động 100% client-side trên Cloudflare Pages)
  useEffect(() => {
    if (pendingOrdersForCurrentStudent.length === 0) return;

    const handlePayOSMessage = async (event: MessageEvent) => {
      const parsed = parsePayOSPostMessageEvent(event);
      if (!parsed.isPayOSEvent || !parsed.isPaid) return;

      const matchedOrder = pendingOrdersForCurrentStudent.find(
        (o) =>
          (parsed.orderCode && Number(o.orderCode) === Number(parsed.orderCode)) ||
          (parsed.paymentLinkId &&
            o.paymentLinkId &&
            o.paymentLinkId.toLowerCase() === parsed.paymentLinkId.toLowerCase())
      );

      if (matchedOrder) {
        await recordStudentTuitionPaymentSuccess({
          orderCode: matchedOrder.orderCode,
          paymentLinkId: matchedOrder.paymentLinkId || parsed.paymentLinkId,
          centerId:
            matchedOrder.centerId || (activeCenterId || currentStudent.centerId || 'HG01').trim(),
          centerName: matchedOrder.centerName || centerName,
          studentId: matchedOrder.studentId,
          studentName: matchedOrder.studentName || currentStudent.name,
          classId: matchedOrder.classId || currentStudent.classId,
          className: matchedOrder.className || currentStudent.className,
          month: matchedOrder.displayMonth || matchedOrder.month,
          attendedSessions: matchedOrder.attendedSessions,
          amount: matchedOrder.amount,
          description: matchedOrder.description,
        });
        setPaidMonthsMap((prev) => ({
          ...prev,
          [matchedOrder.displayMonth]: true,
          [matchedOrder.isoMonth]: true,
        }));
      }
    };

    window.addEventListener('message', handlePayOSMessage);
    return () => {
      window.removeEventListener('message', handlePayOSMessage);
    };
  }, [pendingOrdersForCurrentStudent, currentStudent, activeCenterId, centerName]);

  // Lắng nghe thông tin Thiết lập thanh toán (BankId, Số TK, Tên chủ thẻ) từ center_admin trên Firebase
  useEffect(() => {
    const effectiveCId = (activeCenterId || currentStudent?.centerId || '').trim();
    const unsub = getRealtimeCenterPaymentSettings(effectiveCId, (settings) => {
      setCenterPaymentSettings(settings);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [activeCenterId, currentStudent?.centerId]);

  // Đồng bộ khi propAttendanceRecords thay đổi từ component cha (kể cả khi danh sách rỗng ở trung tâm mới)
  useEffect(() => {
    setLocalAttendanceRecords(Array.isArray(propAttendanceRecords) ? propAttendanceRecords : []);
    setLastSyncedTime(new Date().toLocaleTimeString('vi-VN'));
  }, [propAttendanceRecords]);

  // Lắng nghe dữ liệu điểm danh thời gian thực (Real-time Firebase Listener) theo đúng activeCenterId
  useEffect(() => {
    if (!activeCenterId) {
      setLocalAttendanceRecords([]);
      return;
    }
    setIsAttendanceSyncing(true);
    const unsub = getRealtimeAttendance(
      activeCenterId,
      (records) => {
        if (records && Array.isArray(records)) {
          const scopedRecords = records.filter(
            (r: any) => !r?.centerId || r.centerId === activeCenterId
          );
          setLocalAttendanceRecords(scopedRecords);
          setLastSyncedTime(new Date().toLocaleTimeString('vi-VN'));
        } else {
          setLocalAttendanceRecords([]);
        }
        setIsAttendanceSyncing(false);
      },
      (err) => {
        console.warn('Realtime attendance sync notice:', err);
        setIsAttendanceSyncing(false);
      }
    );
    return () => {
      if (unsub) unsub();
    };
  }, [activeCenterId]);

  // Filter for homework: 'all' | 'submitted' | 'unsubmitted' | 'graded'
  const [homeworkFilter, setHomeworkFilter] = useState<'all' | 'submitted' | 'unsubmitted' | 'graded'>('all');

  // Accordion state: Quản lý danh sách ID bài tập đang được xổ xuống (mở rộng chi tiết)
  const [expandedHomeworkIds, setExpandedHomeworkIds] = useState<Record<string, boolean>>({});

  const toggleHomeworkExpand = (id: string) => {
    setExpandedHomeworkIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAllHomework = () => {
    const next: Record<string, boolean> = {};
    studentAssignments.forEach((h) => {
      next[h.id] = true;
    });
    setExpandedHomeworkIds(next);
  };

  const collapseAllHomework = () => {
    setExpandedHomeworkIds({});
  };

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
  const [parentReplies, setParentReplies] = useState<Record<string, string>>({});

  // Tìm giáo viên phụ trách thực tế từ danh sách lớp học hoặc giáo viên
  const currentClass = hasAnyStudent
    ? classes.find(
        (c) =>
          (currentStudent?.classId && (c.id === currentStudent.classId || c.code === currentStudent.classId)) ||
          (currentStudent?.className && (c.name === currentStudent.className || c.code === currentStudent.className))
      )
    : undefined;
  const currentTeacher = hasAnyStudent
    ? teachers.find(
        (t) =>
          (currentClass?.teacherId && t.id === currentClass.teacherId) ||
          (currentStudent?.classId && t.mainClassId === currentStudent.classId) ||
          (currentClass?.id && t.mainClassId === currentClass.id) ||
          (currentClass?.teacherName && t.name === currentClass.teacherName)
      )
    : undefined;
  const teacherDisplayName = currentTeacher?.name || currentClass?.teacherName || (hasAnyStudent ? 'Chưa phân công' : 'Chưa có giáo viên');
  const teacherPhoneDisplay = currentTeacher?.phone || currentClass?.teacherPhone || '';

  // =========================================================================
  // ĐỒNG BỘ ĐIỂM DANH TỪ GIÁO VIÊN: CHỈ LỌC CHO RIÊNG HỌC SINH HIỆN TẠI
  // =========================================================================
  const studentAttendanceHistory = useMemo(() => {
    if (!hasAnyStudent || !currentStudent || !currentStudent.id) return [];
    const stId = String(currentStudent.id || '').trim();
    const stName = String(currentStudent.name || '').trim().toLowerCase();

    const results: Array<{
      id: string;
      docId: string;
      date: string;
      dateObj: Date;
      dayOfWeek: string;
      formattedDate: string;
      className: string;
      classId: string;
      teacherName: string;
      status: 'present' | 'excused' | 'absent';
      rawStatus: string;
      statusLabel: string;
      note: string;
      shift: string;
      isRealtimeFromTeacher: boolean;
    }> = [];

    const seenDates = new Set<string>();

    // Duyệt qua tất cả các bản ghi điểm danh thực tế do Giáo viên đã lưu từ Firestore của trung tâm hiện tại
    (localAttendanceRecords || []).forEach((doc: any, docIdx: number) => {
      if (!doc) return;
      if (activeCenterId && doc.centerId && doc.centerId !== activeCenterId) return;
      const sessionDate = doc.date || doc.sessionDate || (doc.createdAt ? String(doc.createdAt).slice(0, 10) : '');
      if (!sessionDate) return;

      // Tìm bản ghi điểm danh tương ứng với học sinh của phụ huynh trong mảng records
      let matchedRecord: any = null;
      if (Array.isArray(doc.records)) {
        matchedRecord = doc.records.find((r: any) => {
          if (!r) return false;
          if (r.studentId && stId && String(r.studentId).trim() === stId) return true;
          if (r.studentName && stName && String(r.studentName).trim().toLowerCase() === stName) return true;
          return false;
        });
      }

      // Hỗ trợ nếu document lưu dạng phẳng (flat record)
      if (!matchedRecord) {
        if ((doc.studentId && stId && String(doc.studentId).trim() === stId) ||
            (doc.studentName && stName && String(doc.studentName).trim().toLowerCase() === stName)) {
          matchedRecord = doc;
        }
      }

      if (matchedRecord) {
        const dedupeKey = `${sessionDate}_${doc.classId || 'class'}`;
        if (!seenDates.has(dedupeKey)) {
          seenDates.add(dedupeKey);
          const rawStatus = String(matchedRecord.status || doc.status || 'present').toLowerCase();
          let status: 'present' | 'excused' | 'absent' = 'present';
          let statusLabel = 'Có mặt đúng giờ';

          if (rawStatus === 'excused' || rawStatus.includes('phép')) {
            status = 'excused';
            statusLabel = 'Vắng có phép';
          } else if (rawStatus === 'absent' || rawStatus === 'unexcused' || rawStatus.includes('không phép')) {
            status = 'absent';
            statusLabel = 'Vắng không phép';
          } else if (rawStatus === 'late' || rawStatus.includes('muộn')) {
            status = 'present';
            statusLabel = 'Đi muộn';
          }

          const parts = sessionDate.split('-');
          let dObj = new Date(sessionDate);
          if (parts.length === 3) {
            dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          }
          const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
          const dayOfWeek = dayNames[dObj.getDay()] || 'Thứ Hai';
          const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : sessionDate;

          results.push({
            id: doc.id || `att_entry_${docIdx}`,
            docId: doc.id || `doc_${docIdx}`,
            date: sessionDate,
            dateObj: dObj,
            dayOfWeek,
            formattedDate,
            className: doc.className || currentClass?.name || currentStudent.className || 'Lớp học',
            classId: doc.classId || currentStudent.classId || '',
            teacherName: doc.teacherName || teacherDisplayName || 'Giáo viên phụ trách',
            status,
            rawStatus,
            statusLabel,
            note: matchedRecord.note || matchedRecord.remark || doc.generalNote || '',
            shift: currentClass?.schedule || '18:00 - 20:00',
            isRealtimeFromTeacher: true,
          });
        }
      }
    });

    // Sắp xếp ngày mới nhất lên đầu
    results.sort((a, b) => b.date.localeCompare(a.date));
    return results;
  }, [hasAnyStudent, localAttendanceRecords, currentStudent, currentClass, teacherDisplayName, activeCenterId]);

  // Sĩ số học sinh thực tế thuộc lớp của học sinh hiện tại (nếu trung tâm chưa có học sinh -> trả về mảng rỗng [])
  const classStudents = useMemo(() => {
    if (!hasAnyStudent || !currentStudent || !currentStudent.id) return [];

    const cId = String(currentClass?.id || currentStudent?.classId || '').trim();
    const cName = String(currentClass?.name || currentStudent?.className || '').trim().toLowerCase();
    const cCode = String(currentClass?.code || currentClass?.classCode || '').trim().toLowerCase();

    const list = validStudents.filter((s) => {
      if (!s) return false;
      const sClassId = String(s.classId || '').trim();
      const sClassName = String(s.className || '').trim().toLowerCase();
      if (sClassId && cId && sClassId === cId) return true;
      if (sClassId && cCode && sClassId.toLowerCase() === cCode) return true;
      if (sClassName && cName && cName !== 'chưa phân lớp' && cName !== 'chưa xếp lớp' && (sClassName === cName || sClassName.includes(cName) || cName.includes(sClassName))) return true;
      if (sClassName && cCode && sClassName === cCode) return true;
      return false;
    });

    return list.length > 0 ? list : [currentStudent];
  }, [hasAnyStudent, validStudents, currentClass, currentStudent]);

  const classStudentsCount = hasAnyStudent ? classStudents.length : 0;

  // Hàm chuẩn xác định một bản ghi điểm danh Firestore có thuộc về lớp học hoặc học sinh này không
  const isRecordForStudentOrClass = useCallback(
    (att: any) => {
      if (!hasAnyStudent || !att || !currentStudent?.id) return false;
      if (activeCenterId && att.centerId && att.centerId !== activeCenterId) return false;

      const stId = String(currentStudent.id || '').trim();
      const stName = String(currentStudent.name || '').trim().toLowerCase();

      // 1. Kiểm tra trực tiếp trong mảng danh sách học sinh của buổi điểm danh
      if (Array.isArray(att.records) && att.records.length > 0) {
        const hasStudent = att.records.some((r: any) => {
          if (!r) return false;
          if (stId && r.studentId && String(r.studentId).trim() === stId) return true;
          if (stName && r.studentName && String(r.studentName).trim().toLowerCase() === stName) return true;
          return false;
        });
        if (hasStudent) return true;
      }

      // 2. Kiểm tra nếu bản ghi là document đơn (flat record)
      if (stId && att.studentId && String(att.studentId).trim() === stId) return true;
      if (stName && att.studentName && String(att.studentName).trim().toLowerCase() === stName) return true;

      // 3. Khớp theo mã lớp (classId / classCode) - chỉ khớp khi có mã lớp hợp lệ
      const cId = String(currentClass?.id || currentStudent?.classId || '').trim();
      const cCode = String(currentClass?.code || currentClass?.classCode || '').trim().toLowerCase();
      if (att.classId) {
        const attCId = String(att.classId).trim();
        if (cId && attCId === cId) return true;
        if (cCode && attCId.toLowerCase() === cCode) return true;
      }

      // 4. Khớp theo tên lớp (chỉ khớp khi lớp có tên thực tế, không khớp 'Chưa phân lớp')
      const cName = String(currentClass?.name || currentStudent?.className || '').trim().toLowerCase();
      if (att.className && cName && cName !== 'chưa phân lớp' && cName !== 'chưa xếp lớp' && cName !== 'chưa có lớp') {
        const attCName = String(att.className).trim().toLowerCase();
        if (attCName === cName) return true;
        const cleanAtt = attCName.replace(/^lớp\s+/i, '').trim();
        const cleanC = cName.replace(/^lớp\s+/i, '').trim();
        if (cleanAtt && cleanC && cleanAtt === cleanC) return true;
      }

      return false;
    },
    [hasAnyStudent, currentStudent, currentClass, activeCenterId]
  );

  // Danh sách các ngày trong tháng được chọn (từ 1 đến 28/29/30/31)
  const daysInMonthList = useMemo(() => {
    const [yearStr, monthStr] = selectedAttendanceMonth.split('-');
    const y = parseInt(yearStr, 10) || 2026;
    const m = parseInt(monthStr, 10) || 10;
    const daysCount = new Date(y, m, 0).getDate();
    return Array.from({ length: daysCount }, (_, i) => i + 1);
  }, [selectedAttendanceMonth]);

  // Danh sách bản ghi điểm danh thuộc tháng được chọn từ Firebase (chỉ lấy dữ liệu thật từ Firestore của trung tâm hiện tại)
  const monthlyAttendanceRecords = useMemo(() => {
    if (!hasAnyStudent) return [];
    return (localAttendanceRecords || []).filter((doc: any) => {
      if (!doc) return false;
      const docDate = doc.date || doc.sessionDate || (doc.createdAt ? String(doc.createdAt).slice(0, 10) : '');
      const matchMonth = docDate && (docDate.startsWith(selectedAttendanceMonth) || doc.sessionMonth === selectedAttendanceMonth);
      return matchMonth && isRecordForStudentOrClass(doc);
    });
  }, [hasAnyStudent, localAttendanceRecords, selectedAttendanceMonth, isRecordForStudentOrClass]);

  // Danh sách các tháng có dữ liệu để phụ huynh dễ dàng chuyển đổi (mặc định là tháng hiện tại)
  const availableAttendanceMonths = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    const curYear = now.getFullYear();
    set.add(`${curYear}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    // Thêm các tháng trong năm hiện tại để phụ huynh chọn xem bất kỳ tháng nào
    for (let m = 1; m <= 12; m++) {
      set.add(`${curYear}-${String(m).padStart(2, '0')}`);
    }
    (localAttendanceRecords || []).forEach((r: any) => {
      if (!isRecordForStudentOrClass(r)) return;
      const d = r.date || r.sessionDate;
      if (d && d.length >= 7) set.add(d.slice(0, 7));
    });
    (tuitionLocks || []).forEach((lock) => {
      if (lock?.month && lock.month.length >= 7) set.add(lock.month);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [localAttendanceRecords, isRecordForStudentOrClass, tuitionLocks]);

  // Đồng bộ dữ liệu học phí tháng được chọn (chỉ hiển thị khi center_admin đã chốt sổ)
  const monthlyTuitionStatus = useMemo(() => {
    const sId = String(currentStudent?.id || '').trim();
    const sName = String(currentStudent?.name || '').trim();
    const sClassId = String(currentClass?.id || currentStudent?.classId || '').trim();
    const sClassName = String(currentClass?.name || currentStudent?.className || '').trim();

    // Tìm bản ghi chốt sổ của center_admin cho tháng đang chọn
    const matchedLocks = (tuitionLocks || []).filter((lock) => {
      if (!lock || lock.month !== selectedAttendanceMonth || !lock.isFinalized) return false;
      // Ưu tiên khớp theo học sinh trong studentsMap
      if (sId && lock.studentsMap && lock.studentsMap[sId]) return true;
      if (sName && lock.studentsMap) {
        const foundByName = Object.values(lock.studentsMap).some(
          (st) => String(st.studentName || '').trim().toLowerCase() === sName.toLowerCase()
        );
        if (foundByName) return true;
      }
      // Hoặc khớp theo lớp hoặc chốt toàn trung tâm ('ALL')
      if (lock.classId === 'ALL') return true;
      if (sClassId && String(lock.classId || '').trim() === sClassId) return true;
      if (
        sClassName &&
        (String(lock.className || '').trim().toLowerCase() === sClassName.toLowerCase() ||
          String(lock.classId || '').trim().toLowerCase() === sClassName.toLowerCase())
      ) {
        return true;
      }
      return false;
    });

    // Ưu tiên lock cụ thể của lớp/học sinh trước, sau đó đến lock 'ALL'
    const specificLock =
      matchedLocks.find((l) => l.classId !== 'ALL' && ((sId && l.studentsMap?.[sId]) || l.classId === sClassId)) ||
      matchedLocks[0] ||
      null;

    const isFinalized = Boolean(specificLock && specificLock.isFinalized);

    // Lấy snapshot của học sinh từ bản chốt sổ (nếu có)
    let studentSnapshot = sId && specificLock?.studentsMap ? specificLock.studentsMap[sId] : undefined;
    if (!studentSnapshot && sName && specificLock?.studentsMap) {
      studentSnapshot = Object.values(specificLock.studentsMap).find(
        (st) => String(st.studentName || '').trim().toLowerCase() === sName.toLowerCase()
      );
    }

    // Tính số buổi có mặt đồng bộ 100% với BẢNG ĐIỂM DANH THÁNG của giáo viên
    let liveAttendedSessions = 0;
    if (hasAnyStudent) {
      daysInMonthList.forEach((d) => {
        const dStr = d.toString().padStart(2, '0');
        const isoDate = `${selectedAttendanceMonth}-${dStr}`;
        const rec = monthlyAttendanceRecords.find(
          (r: any) =>
            (r.date === isoDate || r.sessionDate === isoDate) && isRecordForStudentOrClass(r)
        );
        const sRec =
          rec?.records?.find(
            (r: any) =>
              (r.studentId && sId && String(r.studentId).trim() === sId) ||
              (r.studentName &&
                sName &&
                String(r.studentName).trim().toLowerCase() === sName.toLowerCase())
          ) || (rec?.studentId === sId ? rec : null);

        if (sRec) {
          const st = String(sRec.status || '').toLowerCase();
          if (st === 'present' || st === 'late' || st.includes('có mặt')) {
            liveAttendedSessions++;
          }
        }
      });
    }

    // Đảm bảo đồng bộ trực tiếp với bảng điểm danh của giáo viên; nếu bảng live chưa tải kịp thì dùng số buổi đã chốt
    const syncedSessions =
      liveAttendedSessions > 0
        ? liveAttendedSessions
        : studentSnapshot?.attendedSessions !== undefined
        ? Number(studentSnapshot.attendedSessions)
        : 0;

    // Đơn giá/buổi ưu tiên từ cấu hình lớp hiện tại hoặc bản chốt sổ của center_admin
    const pricePerSession = Number(
      currentClass?.pricePerSession ??
        studentSnapshot?.pricePerSession ??
        specificLock?.pricePerSession ??
        40000
    );

    const totalTuition = syncedSessions * pricePerSession;
    const studentNameVal = currentStudent?.name || studentSnapshot?.studentName || 'Học sinh';
    const classNameVal = currentClass?.name || currentStudent?.className || studentSnapshot?.className || 'Lớp đang học';

    const monthPart = selectedAttendanceMonth.split('-')[1] || '';
    const monthNumber = Number(monthPart) || monthPart;
    const paymentMemo = `HOCPHI T${monthNumber} ${studentNameVal} ${classNameVal}`;

    const bankId = (centerPaymentSettings?.bankId || '').trim().toUpperCase();
    const accountNo = (centerPaymentSettings?.accountNo || '').trim().replace(/[\[\]\s]/g, '');
    const accountName = (centerPaymentSettings?.accountName || '').trim().toUpperCase().replace(/^\[|\]$/g, '');

    const vietQrUrl =
      bankId && accountNo
        ? `https://img.vietqr.io/image/${encodeURIComponent(bankId)}-${encodeURIComponent(
            accountNo
          )}-compact2.png?amount=${totalTuition}&addInfo=${encodeURIComponent(
            paymentMemo
          )}&accountName=${encodeURIComponent(accountName)}`
        : '';

    let formattedFinalizedAt = '';
    const rawFinalizedAt: any = specificLock?.finalizedAt;
    if (rawFinalizedAt) {
      try {
        const dObj =
          typeof rawFinalizedAt?.toDate === 'function'
            ? rawFinalizedAt.toDate()
            : rawFinalizedAt?.seconds !== undefined
            ? new Date(rawFinalizedAt.seconds * 1000)
            : new Date(rawFinalizedAt);
        if (!isNaN(dObj.getTime())) {
          formattedFinalizedAt = dObj.toLocaleString('vi-VN');
        }
      } catch {}
    }

    const { isoMonth, displayMonth } = normalizeTuitionMonthPair(selectedAttendanceMonth);

    // Kiểm tra trạng thái Đã thanh toán của học sinh cho tháng đang chọn từ mọi nguồn đồng bộ
    const matchedPaidPayment = (centerTuitionPayments || []).find(
      (p) =>
        p &&
        p.status === 'PAID' &&
        ((sId && String(p.studentId || '').trim() === sId) ||
          (sName && String(p.studentName || '').trim().toLowerCase() === sName.toLowerCase())) &&
        (p.isoMonth === isoMonth || p.displayMonth === displayMonth || p.month === displayMonth || p.month === isoMonth)
    );

    const studentTuitionByMonth = (currentStudent as any)?.tuitionByMonth || {};
    const studentPaidMonths = (currentStudent as any)?.paidMonths || {};
    const monthStatusVal = String(
      studentTuitionByMonth[displayMonth] || studentTuitionByMonth[isoMonth] || ''
    )
      .toLowerCase()
      .trim();
    const snapshotStatusVal = String(studentSnapshot?.tuitionStatus || '')
      .toLowerCase()
      .trim();

    const isPaid = Boolean(
      paidMonthsMap[displayMonth] ||
        paidMonthsMap[isoMonth] ||
        studentPaidMonths[displayMonth] ||
        studentPaidMonths[isoMonth] ||
        monthStatusVal === 'đã thanh toán' ||
        monthStatusVal === 'đã nộp' ||
        monthStatusVal === 'paid' ||
        studentSnapshot?.isPaid ||
        snapshotStatusVal === 'đã thanh toán' ||
        snapshotStatusVal === 'đã nộp' ||
        snapshotStatusVal === 'paid' ||
        matchedPaidPayment
    );

    const paidOrderCode =
      matchedPaidPayment?.orderCode ||
      studentSnapshot?.paidOrderCode ||
      (currentStudent as any)?.lastPaidOrderCode ||
      undefined;

    return {
      isFinalized,
      isPaid,
      paidOrderCode,
      displayMonth,
      isoMonth,
      lockRecord: specificLock,
      studentName: studentNameVal,
      className: classNameVal,
      attendedSessions: syncedSessions,
      pricePerSession,
      totalTuition,
      bankId,
      accountNo,
      accountName,
      paymentMemo,
      vietQrUrl,
      finalizedAt: formattedFinalizedAt,
      finalizedBy: specificLock?.finalizedBy || 'Ban giám đốc Trung tâm',
    };
  }, [
    tuitionLocks,
    selectedAttendanceMonth,
    currentStudent,
    currentClass,
    hasAnyStudent,
    daysInMonthList,
    monthlyAttendanceRecords,
    isRecordForStudentOrClass,
    centerPaymentSettings,
    centerTuitionPayments,
    paidMonthsMap,
  ]);

  // Xuất file Excel bảng điểm danh theo tháng
  const handleExportMonthlyCsv = () => {
    if (!hasAnyStudent) return;
    const [year, month] = selectedAttendanceMonth.split('-');
    const daysHeader = daysInMonthList.join(',');
    let csv = `BẢNG ĐIỂM DANH THÁNG ${month}/${year}\n`;
    csv += `Lớp: ${currentClass?.name || currentStudent.className || 'Chưa phân lớp'},Học sinh: ${currentStudent.name},SĐT PH: ${currentStudent.parentPhone || ''}\n\n`;
    csv += `TT,TÊN HỌC SINH,SĐT PH,${daysHeader},Tổng buổi\n`;

    let attended = 0;
    const dayValues = daysInMonthList.map((d) => {
      const dStr = d.toString().padStart(2, '0');
      const isoDate = `${selectedAttendanceMonth}-${dStr}`;
      const rec = monthlyAttendanceRecords.find((r: any) => r.date === isoDate || r.sessionDate === isoDate);
      const sRec = rec?.records?.find((r: any) =>
        (r.studentId && currentStudent.id && String(r.studentId).trim() === String(currentStudent.id).trim()) ||
        (r.studentName && currentStudent.name && r.studentName.trim().toLowerCase() === currentStudent.name.trim().toLowerCase())
      ) || (rec?.studentId === currentStudent.id ? rec : null);

      if (sRec) {
        const st = String(sRec.status || '').toLowerCase();
        if (st === 'present' || st === 'late' || st.includes('có mặt')) {
          attended++;
          return 'X';
        }
        if (st === 'excused' || st.includes('phép')) return 'P';
        if (st === 'absent' || st === 'unexcused' || st.includes('không phép')) return 'K';
      }
      return '';
    });

    csv += `1,"${currentStudent.name}","${currentStudent.parentPhone || ''}",${dayValues.join(',')},${attended}\n`;
    csv += `TỔNG CỘNG LỚP,"${classStudentsCount} HS","",${dayValues.map((v) => (v === 'X' ? '1' : '-')).join(',')},${attended}\n\n`;
    csv += `* Ghi chú: X = Có mặt (tính tiền) | P = Vắng có phép | K = Vắng không phép | Ô trống = Chưa điểm danh\n`;

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bang_Diem_Danh_${currentStudent.name.replace(/\s+/g, '_')}_Thang_${month}_${year}.csv`;
    link.click();
  };

  // In bảng điểm danh
  const handlePrintAttendanceTable = () => {
    window.print();
  };

  // Cập nhật timeline nhận xét giáo viên từ các buổi điểm danh thực tế (không tạo nhận xét ảo cho trung tâm mới)
  const timelineRemarks = useMemo(() => {
    if (!hasAnyStudent) {
      return [];
    }

    const commentsFromAttendance = studentAttendanceHistory
      .filter((r) => r.note && r.note.trim().length > 0)
      .map((r, idx) => ({
        id: `att_comment_${r.id || idx}`,
        teacherName: r.teacherName,
        teacherRole: 'Giáo viên phụ trách',
        subject: currentClass?.subject || 'Bộ môn',
        date: r.formattedDate,
        time: r.shift || '18:00 - 20:00',
        content: r.note,
        homeworkStatus: r.status === 'present' ? 'Có mặt đầy đủ' : 'Nghỉ có phép',
        highlightBadge: r.status === 'present' ? 'Đánh Giá Buổi Học' : 'Ghi Nhận Vắng',
        badgeStyle: r.status === 'present' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300',
      }));

    if (
      commentsFromAttendance.length === 0 &&
      currentStudent.note &&
      currentStudent.note.trim().length > 0 &&
      currentStudent.note !== 'Học sinh mới tiếp nhận' &&
      currentStudent.note !== 'Chưa có nhận xét.'
    ) {
      commentsFromAttendance.push({
        id: `student_note_${currentStudent.id}`,
        teacherName: teacherDisplayName,
        teacherRole: 'GVCN Lớp',
        subject: currentClass?.subject || 'Bộ môn',
        date: new Date().toLocaleDateString('vi-VN'),
        time: currentClass?.schedule || 'Ghi chú lớp học',
        content: currentStudent.note,
        homeworkStatus: 'Ghi chú học tập',
        highlightBadge: 'Nhận Xét Học Sinh',
        badgeStyle: 'bg-blue-50 text-blue-800 border-blue-300',
      });
    }

    return commentsFromAttendance;
  }, [hasAnyStudent, studentAttendanceHistory, currentStudent, currentClass, teacherDisplayName]);

  // 1. Chỉ lấy những bài tập được giao cho học sinh này hoặc lớp của học sinh này (không hiển thị bài tập lớp khác)
  const studentAssignments = useMemo(() => {
    if (!hasAnyStudent || !currentStudent || !currentStudent.id) return [];

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
          {/* Top row: Brand ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/20">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/25 px-3 py-1 text-xs font-black text-amber-200 border border-amber-300/40 tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Sổ Liên Lạc Điện Tử &bull; {centerName}
              </span>
              <span className="text-[11px] font-mono font-bold bg-white/20 px-2.5 py-1 rounded-lg text-white">
                Năm học {new Date().getFullYear()}
              </span>
            </div>
          </div>

          {/* Main profile row */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Identity Info */}
            <div className="flex items-start sm:items-center gap-4 sm:gap-5">
              <div className="relative">
                <AccountAvatar
                  name={hasAnyStudent ? currentStudent.name : 'HS'}
                  role="student"
                  size="2xl"
                  shape="rounded"
                  className="ring-4 ring-white/40 shadow-xl shrink-0"
                />
                {hasAnyStudent && (
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-[#00A86B] p-1.5 ring-2 ring-white" title="Trạng thái: Đang theo học">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    {hasAnyStudent ? currentStudent.name : 'Chưa có học sinh trong trung tâm'}
                  </h1>
                  {hasAnyStudent && (
                    <span className="font-mono text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-md text-blue-100 border border-white/20">
                      Mã HS: {(currentStudent.studentCode || currentStudent.id).toUpperCase()}
                    </span>
                  )}
                </div>

                {hasAnyStudent ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-blue-100 font-medium">
                    <span className="font-bold flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg">
                      <GraduationCap className="w-4 h-4 text-amber-300" />
                      Lớp: <strong className="text-white font-extrabold">{currentClass?.name || currentStudent.className || 'Chưa phân lớp'}</strong>
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg">
                      <School className="w-4 h-4 text-emerald-300" />
                      GVCN: <strong className="text-white font-extrabold">{teacherDisplayName}</strong>
                      {teacherPhoneDisplay ? ` (${teacherPhoneDisplay})` : ''}
                    </span>
                    <span>&bull;</span>
                    <span>
                      Phụ huynh: <strong className="text-white">{currentStudent.parentName || 'Chưa cập nhật'}</strong>
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-blue-100 font-medium">
                    Trung tâm mới khởi tạo chưa có dữ liệu học sinh. Vui lòng thêm Lớp học và Học sinh ở mục Quản lý để theo dõi Sổ Liên Lạc &amp; Điểm Danh.
                  </p>
                )}
              </div>
            </div>

            {/* Quick Actions for Parent: Request Leave & Contact */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <button
                type="button"
                disabled={!hasAnyStudent}
                onClick={() => setIsLeaveModalOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-2xl bg-[#F39C12] hover:bg-amber-600 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-white font-extrabold text-xs sm:text-sm px-4 py-3 shadow-lg transition-all"
              >
                <Send className="w-4 h-4" />
                <span>Gửi Đơn Xin Phép Nghỉ Học</span>
              </button>

              {teacherPhoneDisplay && (
                <a
                  href={`tel:${teacherPhoneDisplay.replace(/[^0-9]/g, '')}`}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs sm:text-sm px-4 py-3 border border-white/30 backdrop-blur-xs transition-all"
                >
                  <PhoneCall className="w-4 h-4 text-amber-300" />
                  <span>Gọi GVCN ({teacherPhoneDisplay})</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. NỘI DUNG MENU ĐIỂM DANH: LỊCH ĐIỂM DANH & THEO DÕI CHUYÊN CẦN          */}
      {/* ========================================================================= */}
      {activeTab === 'attendance' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4 animate-fade-in">
          {/* Card Header: Title, Subtitle, Actions (Export Excel, In Bảng, Month selector) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#0B486B] flex items-center gap-2 uppercase tracking-wide">
                <Table className="w-5 h-5 text-[#0072B5]" />
                BẢNG ĐIỂM DANH THÁNG {selectedAttendanceMonth.split('-')[1]}/{selectedAttendanceMonth.split('-')[0]}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Lớp: <strong className="text-slate-800 font-extrabold">{hasAnyStudent ? (currentClass?.name || currentStudent.className || 'Chưa phân lớp') : 'Chưa có lớp'}</strong> &bull; Sĩ số: <strong className="text-[#0072B5] font-extrabold">{classStudentsCount} HS</strong> &bull; Đã lưu điểm danh trên Firebase: <strong className="text-emerald-700 font-extrabold">{monthlyAttendanceRecords.length} buổi</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Dropdown chọn Tháng */}
              <select
                value={selectedAttendanceMonth}
                onChange={(e) => setSelectedAttendanceMonth(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs focus:ring-2 focus:ring-emerald-300 focus:outline-hidden cursor-pointer"
              >
                {availableAttendanceMonths.map((m) => (
                  <option key={m} value={m}>
                    Tháng {m.split('-')[1]}/{m.split('-')[0]}
                  </option>
                ))}
              </select>

              {/* Nút Xuất File Excel (CSV) */}
              <button
                type="button"
                disabled={!hasAnyStudent}
                onClick={handleExportMonthlyCsv}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:pointer-events-none text-[#00A86B] border border-emerald-300 shadow-2xs transition-all cursor-pointer"
                title="Xuất bảng điểm danh tháng sang file Excel"
              >
                <Download className="w-4 h-4 text-[#00A86B]" />
                <span>Xuất File Excel</span>
              </button>

              {/* Nút In Bảng */}
              <button
                type="button"
                disabled={!hasAnyStudent}
                onClick={handlePrintAttendanceTable}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:pointer-events-none text-slate-700 border border-slate-300 shadow-2xs transition-all cursor-pointer"
                title="In bảng điểm danh tháng"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>In Bảng</span>
              </button>
            </div>
          </div>

          {/* Matrix Table: TT | TÊN HỌC SINH | SĐT PH | 1..31 | Tổng buổi */}
          <div className="space-y-1.5">
            <div className="overflow-x-auto border border-slate-300/80 rounded-xl shadow-2xs">
              <table className="w-full text-center text-xs border-collapse">
                <thead>
                  {/* Tiêu đề THÁNG như hình ảnh mẫu */}
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-black">
                    <th
                      colSpan={3 + daysInMonthList.length + 1}
                      className="py-2.5 px-4 text-center text-sm font-black tracking-wider text-[#0B486B]"
                    >
                      THÁNG {selectedAttendanceMonth.split('-')[1]}/{selectedAttendanceMonth.split('-')[0]}
                    </th>
                  </tr>
                  {/* Dòng Tiêu Đề Cột: TT | TÊN HỌC SINH | SĐT PH | 1..31 | Tổng buổi */}
                  <tr className="bg-slate-50 text-slate-800 border-b border-slate-300 font-bold divide-x divide-slate-300">
                    <th className="py-2.5 px-2 w-10 sm:sticky sm:left-0 bg-slate-50 z-20">TT</th>
                    <th className="py-2.5 px-3 min-w-[150px] sm:min-w-[170px] text-left sm:sticky sm:left-10 bg-slate-50 z-20 shadow-xs">
                      TÊN HỌC SINH
                    </th>
                    <th className="py-2.5 px-2 min-w-[100px] sm:min-w-[110px] text-left sm:sticky sm:left-[210px] bg-slate-50 z-20 shadow-xs">
                      SĐT PH
                    </th>
                    {daysInMonthList.map((d) => {
                      const dStr = d.toString().padStart(2, '0');
                      const iso = `${selectedAttendanceMonth}-${dStr}`;
                      const isRecorded = monthlyAttendanceRecords.some(
                        (r: any) => (r.date === iso || r.sessionDate === iso) && isRecordForStudentOrClass(r)
                      );
                      return (
                        <th
                          key={d}
                          className={`py-2 px-1 w-8 min-w-[32px] text-center font-extrabold ${
                            isRecorded ? 'bg-blue-50/80 text-[#0072B5]' : 'text-slate-700'
                          }`}
                          title={`Ngày ${dStr}/${selectedAttendanceMonth.split('-')[1]}/${selectedAttendanceMonth.split('-')[0]}${
                            isRecorded ? ' - Đã lưu điểm danh trên Firebase' : ''
                          }`}
                        >
                          {d}
                        </th>
                      );
                    })}
                    <th className="py-2.5 px-2 min-w-[80px] text-center bg-blue-50/60 text-[#0072B5]">
                      Tổng buổi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-medium text-slate-800">
                  {!hasAnyStudent ? (
                    <tr>
                      <td
                        colSpan={3 + daysInMonthList.length + 1}
                        className="py-10 px-4 text-center text-slate-400 text-xs font-medium bg-white"
                      >
                        Chưa có dữ liệu học sinh trong trung tâm. Khi trung tâm thêm học sinh và giáo viên thực hiện điểm danh, dữ liệu sẽ hiển thị tại đây.
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      let attendedCount = 0;
                      return (
                        <tr className="hover:bg-slate-50/80 transition-colors divide-x divide-slate-300">
                          {/* TT */}
                          <td className="py-2 px-2 sm:sticky sm:left-0 bg-white z-10 font-bold text-slate-600">
                            1
                          </td>

                          {/* TÊN HỌC SINH */}
                          <td className="py-2 px-3 text-left sm:sticky sm:left-10 bg-white z-10 shadow-xs font-bold text-slate-800">
                            <div className="truncate max-w-[150px] sm:max-w-[170px]" title={currentStudent.name}>
                              {currentStudent.name}
                            </div>
                          </td>

                          {/* SĐT PH */}
                          <td className="py-2 px-2 text-left sm:sticky sm:left-[210px] bg-white z-10 shadow-xs text-slate-600 text-[11px]">
                            {currentStudent.parentPhone || '—'}
                          </td>

                          {/* Các cột ngày từ 1 đến 31 */}
                          {daysInMonthList.map((d) => {
                            const dStr = d.toString().padStart(2, '0');
                            const iso = `${selectedAttendanceMonth}-${dStr}`;
                            const rec = monthlyAttendanceRecords.find(
                              (r: any) => (r.date === iso || r.sessionDate === iso) && isRecordForStudentOrClass(r)
                            );
                            const sRec = rec?.records?.find(
                              (r: any) =>
                                (r.studentId && currentStudent.id && String(r.studentId).trim() === String(currentStudent.id).trim()) ||
                                (r.studentName && currentStudent.name && r.studentName.trim().toLowerCase() === currentStudent.name.trim().toLowerCase())
                            ) || (rec?.studentId === currentStudent.id ? rec : null);

                            let marker = '';
                            let markerClass = '';
                            let titleText = `Ngày ${dStr}: Chưa có dữ liệu`;

                            if (sRec) {
                              const st = String(sRec.status || '').toLowerCase();
                              if (st === 'present' || st === 'late' || st.includes('có mặt')) {
                                attendedCount++;
                                marker = 'X';
                                markerClass = 'font-black text-[#0B486B] text-xs';
                                titleText = `Ngày ${dStr}: Có mặt (tính tiền)`;
                              } else if (st === 'excused' || st.includes('phép')) {
                                marker = 'P';
                                markerClass = 'font-bold text-[#F39C12] text-[11px]';
                                titleText = `Ngày ${dStr}: Vắng có phép`;
                              } else if (st === 'absent' || st === 'unexcused' || st.includes('không phép')) {
                                marker = 'K';
                                markerClass = 'font-bold text-[#E74C3C] text-[11px]';
                                titleText = `Ngày ${dStr}: Vắng không phép`;
                              }
                            }

                            return (
                              <td
                                key={d}
                                className={`py-2 px-1 text-center select-none ${
                                  marker === 'X' ? 'bg-blue-50/30' : ''
                                }`}
                                title={titleText}
                              >
                                {marker ? (
                                  <span className={markerClass}>{marker}</span>
                                ) : (
                                  <span className="text-slate-300"></span>
                                )}
                              </td>
                            );
                          })}

                          {/* Tổng buổi */}
                          <td className="py-2 px-2 text-center font-bold text-[#0072B5] bg-blue-50/20">
                            {attendedCount}
                          </td>
                        </tr>
                      );
                    })()
                  )}
                </tbody>
                {/* Hàng Tổng cộng lớp */}
                <tfoot>
                  <tr className="bg-slate-100 font-extrabold text-slate-800 border-t-2 border-slate-300 divide-x divide-slate-300">
                    <td colSpan={2} className="py-2.5 px-3 text-left sticky left-0 bg-slate-100 z-20 font-black text-[#0B486B]">
                      TỔNG CỘNG LỚP
                    </td>
                    <td className="py-2.5 px-2 text-left sticky left-[210px] bg-slate-100 z-20 text-[11px] text-slate-600 font-bold">
                      {classStudentsCount} HS
                    </td>
                    {daysInMonthList.map((d) => {
                      const dStr = d.toString().padStart(2, '0');
                      const iso = `${selectedAttendanceMonth}-${dStr}`;
                      const rec = monthlyAttendanceRecords.find(
                        (r: any) => (r.date === iso || r.sessionDate === iso) && isRecordForStudentOrClass(r)
                      );
                      const presentCountForDay = (rec?.records || []).filter(
                        (r: any) => {
                          const st = String(r.status || '').toLowerCase();
                          return st === 'present' || st === 'late' || st.includes('có mặt');
                        }
                      ).length;
                      return (
                        <td key={d} className="py-2 px-1 text-center text-[11px] font-black text-[#0B486B]">
                          {presentCountForDay > 0 ? presentCountForDay : '—'}
                        </td>
                      );
                    })}
                    {/* Tổng số lượt có mặt cả lớp */}
                    <td className="py-2.5 px-2 text-center font-black text-[#0072B5] bg-blue-100/50">
                      {daysInMonthList.reduce((acc, d) => {
                        const dStr = d.toString().padStart(2, '0');
                        const iso = `${selectedAttendanceMonth}-${dStr}`;
                        const rec = monthlyAttendanceRecords.find(
                          (r: any) => (r.date === iso || r.sessionDate === iso) && isRecordForStudentOrClass(r)
                        );
                        if (!rec) return acc;
                        const presentCountForDay = (rec?.records || []).filter(
                          (r: any) => {
                            const st = String(r.status || '').toLowerCase();
                            return st === 'present' || st === 'late' || st.includes('có mặt');
                          }
                        ).length;
                        return acc + presentCountForDay;
                      }, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Chú thích bảng điểm danh */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="font-bold text-slate-700">Ký hiệu:</span>
                <span className="flex items-center gap-1 font-bold text-[#0B486B]">
                  <strong className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200">X</strong> Có mặt (tính tiền)
                </span>
                <span className="flex items-center gap-1 font-bold text-[#F39C12]">
                  <strong className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200">P</strong> Vắng có phép
                </span>
                <span className="flex items-center gap-1 font-bold text-[#E74C3C]">
                  <strong className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200">K</strong> Vắng không phép
                </span>
                <span className="text-slate-400 italic">
                  * Ô trống: Ngày không có buổi học hoặc chưa ghi nhận điểm danh trên Firebase
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MODAL THANH TOÁN HỌC PHÍ THÁNG (BÊN DƯỚI BẢNG ĐIỂM DANH THÁNG)            */}
          {/* ========================================================================= */}
          <div className="rounded-3xl border-3 border-[#0072B5] bg-white p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0B486B] to-[#0072B5] text-white flex items-center justify-center shadow-sm shrink-0">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-[#0B486B] uppercase tracking-tight">
                      Thanh toán học phí Tháng {selectedAttendanceMonth.split('-')[1]}/{selectedAttendanceMonth.split('-')[0]}
                    </h3>
                    {monthlyTuitionStatus.isFinalized ? (
                      <>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Đã chốt sổ
                        </span>
                        {monthlyTuitionStatus.isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-600 text-white shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            Đã thanh toán
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                            <Clock className="w-3.5 h-3.5 text-rose-500" />
                            Chưa thanh toán
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Đang cập nhật
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Dữ liệu số buổi học và học phí được đồng bộ trực tiếp với bảng điểm danh của giáo viên và Ban quản lý trung tâm
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-[#0072B5]" />
                  <span className="text-xs font-bold text-slate-600">Tháng:</span>
                  <select
                    value={selectedAttendanceMonth}
                    onChange={(e) => setSelectedAttendanceMonth(e.target.value)}
                    className="bg-transparent text-xs font-extrabold text-[#0B486B] focus:outline-none cursor-pointer"
                  >
                    {availableAttendanceMonths.map((m) => {
                      const [y, mo] = m.split('-');
                      return (
                        <option key={m} value={m}>
                          Tháng {mo}/{y}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {monthlyTuitionStatus.isFinalized ? (
              <div className="space-y-4">
                {/* 3 Thẻ thông tin cốt lõi: Tên học sinh - Số buổi học - Học phí */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Tên học sinh */}
                  <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/50 p-4 flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-[#0072B5] text-white flex items-center justify-center font-black text-base shrink-0 shadow-sm">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        Tên học sinh
                      </p>
                      <p className="text-base sm:text-lg font-black text-[#0B486B] truncate mt-0.5">
                        {monthlyTuitionStatus.studentName}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-600 truncate">
                        Lớp: {monthlyTuitionStatus.className}
                      </p>
                    </div>
                  </div>

                  {/* Số buổi học */}
                  <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-4 flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-base shrink-0 shadow-sm">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        Số buổi học
                      </p>
                      <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5">
                        {monthlyTuitionStatus.attendedSessions}{' '}
                        <span className="text-xs font-bold text-emerald-800">buổi</span>
                      </p>
                      <p className="text-[11px] font-semibold text-slate-600">
                        Đồng bộ bảng điểm danh GV
                      </p>
                    </div>
                  </div>

                  {/* Học phí */}
                  <div
                    className={`rounded-2xl border-2 p-4 flex items-center gap-3.5 ${
                      monthlyTuitionStatus.isPaid
                        ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50'
                        : 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl text-white flex items-center justify-center font-black text-base shrink-0 shadow-sm ${
                        monthlyTuitionStatus.isPaid ? 'bg-emerald-600' : 'bg-amber-500'
                      }`}
                    >
                      {monthlyTuitionStatus.isPaid ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <DollarSign className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                          Học phí
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            monthlyTuitionStatus.isPaid
                              ? 'bg-emerald-600 text-white'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {monthlyTuitionStatus.isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
                        </span>
                      </div>
                      <p
                        className={`text-xl sm:text-2xl font-black mt-0.5 ${
                          monthlyTuitionStatus.isPaid ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {monthlyTuitionStatus.totalTuition.toLocaleString('vi-VN')} ₫
                      </p>
                      <p className="text-[11px] font-semibold text-slate-600">
                        Đơn giá: {monthlyTuitionStatus.pricePerSession.toLocaleString('vi-VN')} ₫/buổi
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bảng chi tiết đối chiếu học phí */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0B486B] text-white font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Tên học sinh</th>
                        <th className="py-3 px-4">Lớp theo học</th>
                        <th className="py-3 px-4 text-center">Tháng quyết toán</th>
                        <th className="py-3 px-4 text-center">Số buổi học</th>
                        <th className="py-3 px-4 text-right">Đơn giá / buổi</th>
                        <th className="py-3 px-4 text-right">Học phí cần thanh toán</th>
                        <th className="py-3 px-4 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      <tr className="hover:bg-blue-50/40 font-semibold text-slate-800">
                        <td className="py-3.5 px-4 font-black text-[#0B486B] text-sm">
                          {monthlyTuitionStatus.studentName}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-bold">
                          {monthlyTuitionStatus.className}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-[#0072B5]">
                          Tháng {selectedAttendanceMonth.split('-')[1]}/{selectedAttendanceMonth.split('-')[0]}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs">
                            {monthlyTuitionStatus.attendedSessions} buổi
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-700">
                          {monthlyTuitionStatus.pricePerSession.toLocaleString('vi-VN')} ₫
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-black text-sm ${
                            monthlyTuitionStatus.isPaid ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {monthlyTuitionStatus.totalTuition.toLocaleString('vi-VN')} ₫
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {monthlyTuitionStatus.isPaid ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Đã thanh toán
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[11px]">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Chưa thanh toán
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Nút Thanh toán ngay bên dưới bảng thông tin học phí */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  <div className="text-[11px] text-slate-500 font-semibold">
                    * Số buổi học được tính tự động từ các buổi <strong className="text-[#0B486B]">Có mặt (X)</strong> trên bảng điểm danh của giáo viên.
                    {monthlyTuitionStatus.finalizedAt ? (
                      <span className="ml-2 font-bold text-emerald-700">
                        (Chốt sổ: {monthlyTuitionStatus.finalizedAt})
                      </span>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsTuitionModalOpen(true)}
                    className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-white text-xs sm:text-sm font-black shadow-md hover:shadow-lg transition-all cursor-pointer shrink-0 ${
                      monthlyTuitionStatus.isPaid
                        ? 'bg-gradient-to-r from-emerald-600 to-[#00A86B] hover:from-emerald-700 hover:to-emerald-600'
                        : 'bg-gradient-to-r from-[#0072B5] to-[#0B486B] hover:from-[#0B486B] hover:to-[#0072B5]'
                    }`}
                  >
                    {monthlyTuitionStatus.isPaid ? (
                      <CheckCircle2 className="w-4.5 h-4.5" />
                    ) : (
                      <QrCode className="w-4.5 h-4.5" />
                    )}
                    <span>
                      {monthlyTuitionStatus.isPaid
                        ? `Đã thanh toán học phí (${monthlyTuitionStatus.totalTuition.toLocaleString('vi-VN')} ₫)`
                        : `Thanh toán học phí (${monthlyTuitionStatus.totalTuition.toLocaleString('vi-VN')} ₫)`}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-6 sm:p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center mx-auto shadow-sm">
                  <Clock className="w-6 h-6" />
                </div>
                <p className="text-sm sm:text-base font-black text-[#0B486B] max-w-xl mx-auto leading-relaxed">
                  Dữ liệu học phí tháng này của con đang được cập nhật. Xin cảm ơn phụ huynh!
                </p>
                <p className="text-xs text-slate-500">
                  Thông tin học phí Tháng {selectedAttendanceMonth.split('-')[1]}/{selectedAttendanceMonth.split('-')[0]} sẽ tự động hiển thị ngay khi Quản trị viên trung tâm hoàn tất chốt sổ điểm danh cuối tháng.
                </p>
              </div>
            )}
          </div>

          {/* POPUP MODAL THANH TOÁN HỌC PHÍ MULTI-TENANT QUA MÃ VIETQR & PAYOS */}
          <TuitionPaymentModal
            isOpen={isTuitionModalOpen}
            onClose={() => setIsTuitionModalOpen(false)}
            centerId={(activeCenterId || currentStudent?.centerId || 'HG01').trim()}
            centerName={centerName || 'Trung Tâm Đào Tạo'}
            studentId={currentStudent?.id || ''}
            studentName={monthlyTuitionStatus.studentName}
            classId={currentClass?.id || currentStudent?.classId || ''}
            className={monthlyTuitionStatus.className}
            month={`${selectedAttendanceMonth.split('-')[1]}/${selectedAttendanceMonth.split('-')[0]}`}
            amount={monthlyTuitionStatus.totalTuition}
            attendedSessions={monthlyTuitionStatus.attendedSessions}
            bankId={monthlyTuitionStatus.bankId || 'MB'}
            accountNo={monthlyTuitionStatus.accountNo || '09995879999'}
            accountName={monthlyTuitionStatus.accountName || 'HUYNH THI HONG YEN'}
            isAlreadyPaid={monthlyTuitionStatus.isPaid}
            existingOrderCode={monthlyTuitionStatus.paidOrderCode}
            onPaymentSuccess={(orderCode) => {
              const formattedMonth = `${selectedAttendanceMonth.split('-')[1]}/${selectedAttendanceMonth.split('-')[0]}`;
              setPaidMonthsMap((prev) => ({
                ...prev,
                [formattedMonth]: true,
                [selectedAttendanceMonth]: true,
              }));
              setLeaveSentToast({
                show: true,
                msg: `Đã xác nhận thanh toán học phí Tháng ${formattedMonth} (Mã GD #${orderCode}) của em ${monthlyTuitionStatus.studentName} thành công!`,
              });
              setTimeout(() => {
                setLeaveSentToast({ show: false, msg: '' });
              }, 4500);
            }}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. NỘI DUNG MENU NHẬN XÉT: TIMELINE NHẬN XÉT HÀNG NGÀY CỦA GIÁO VIÊN      */}
      {/* ========================================================================= */}
      {activeTab === 'remarks' && (
        <div className="space-y-4 animate-fade-in">
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
            {timelineRemarks.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs font-medium">
                Chưa có nhận xét nào từ giáo viên cho học sinh này.
              </div>
            ) : (
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
                            Phản hồi của phụ huynh ({currentStudent.parentName || 'Phụ huynh'}):
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
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. NỘI DUNG MENU BÀI TẬP: DANH SÁCH BÀI TẬP VỀ NHÀ & SỔ ĐIỂM             */}
      {/* ========================================================================= */}
      {activeTab === 'homework' && (
        <div className="space-y-6 animate-fade-in">
          <div className="rounded-3xl border-3 border-[#F39C12] bg-white p-5 sm:p-6 shadow-md">
            {/* Header: Title, Subtitle, and Expand/Collapse All Buttons */}
            <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-[#0B486B] flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#F39C12]" />
                  Danh Sách Bài Tập Về Nhà &amp; Sổ Điểm
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tên bài, hạn nộp, trạng thái nộp bài, điểm số và lời phê của GV
                </p>
              </div>

              {/* Nút thao tác nhanh Mở tất cả / Thu gọn cho danh sách gọn gàng */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={expandAllHomework}
                  className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
                  title="Mở tất cả chi tiết bài tập"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
                  <span>Mở tất cả</span>
                </button>
                <button
                  type="button"
                  onClick={collapseAllHomework}
                  className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
                  title="Thu gọn danh sách cho gọn gàng"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-slate-600" />
                  <span>Thu gọn</span>
                </button>
              </div>
            </div>

            {/* BẢNG CẢNH BÁO TỔNG HỢP: Báo hiệu bài đã làm & Cảnh báo nổi bật bài chưa làm */}
            {unsubmittedCount > 0 ? (
              <div className="mt-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/10 border-2 border-amber-400 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-amber-950 flex items-center gap-2 flex-wrap">
                      CẢNH BÁO: CÓ {unsubmittedCount} BÀI TẬP CHƯA LÀM
                      <span className="text-[10px] font-black uppercase bg-rose-500 text-white px-2 py-0.5 rounded-full">
                        Cần chú ý
                      </span>
                    </h4>
                    <p className="text-[11px] text-amber-800 font-semibold mt-0.5">
                      Phụ huynh và học sinh vui lòng chú ý hoàn thành và gửi bài trước hạn để giáo viên kịp thời chấm điểm!
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHomeworkFilter('unsubmitted');
                    const unsubs: Record<string, boolean> = {};
                    studentAssignments.forEach((hw) => {
                      const hasSub = hw.submissions?.some((s) => s.studentId === currentStudent.id);
                      if (!hasSub && hw.status !== 'completed' && hw.status !== 'graded') {
                        unsubs[hw.id] = true;
                      }
                    });
                    setExpandedHomeworkIds(unsubs);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition-all shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Xem {unsubmittedCount} bài cần làm ngay</span>
                </button>
              </div>
            ) : studentAssignments.length > 0 ? (
              <div className="mt-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-3 sm:p-3.5 flex items-center gap-3 text-emerald-900 shadow-xs">
                <div className="w-8 h-8 rounded-xl bg-[#00A86B] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <strong className="font-black text-emerald-950 block">Tuyệt vời! Học sinh đã hoàn thành đầy đủ tất cả bài tập</strong>
                  <span className="text-emerald-800 font-medium">Không còn bài tập nào chưa nộp. Phụ huynh có thể xem điểm số và lời phê chi tiết bên dưới.</span>
                </div>
              </div>
            ) : null}

            {/* Filter Pills */}
            <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setHomeworkFilter('all')}
                className={`py-1.5 rounded-xl transition-all cursor-pointer ${
                  homeworkFilter === 'all' ? 'bg-white text-[#0B486B] shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Tất cả ({studentAssignments.length})
              </button>
              <button
                type="button"
                onClick={() => setHomeworkFilter('submitted')}
                className={`py-1.5 rounded-xl transition-all cursor-pointer ${
                  homeworkFilter === 'submitted' ? 'bg-white text-[#00A86B] shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Đã nộp ({submittedCount})
              </button>
              <button
                type="button"
                onClick={() => setHomeworkFilter('unsubmitted')}
                className={`py-1.5 rounded-xl transition-all cursor-pointer ${
                  homeworkFilter === 'unsubmitted' ? 'bg-white text-[#E74C3C] shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Chưa nộp ({unsubmittedCount > 0 ? unsubmittedCount : 0})
              </button>
              <button
                type="button"
                onClick={() => setHomeworkFilter('graded')}
                className={`py-1.5 rounded-xl transition-all cursor-pointer ${
                  homeworkFilter === 'graded' ? 'bg-white text-[#F39C12] shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Có điểm ({gradedCount})
              </button>
            </div>

            {/* Homework Accordion List (Dạng xổ xuống gọn gàng, có báo hiệu & cảnh báo) */}
            <div className="mt-4 space-y-3 max-h-[620px] overflow-y-auto pr-1">
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
                const isExcel = /\.(xlsx|xls|csv|ods)$/i.test(hw.attachedFile || '');
                const isWord = hw.attachedFileType === 'word' || /\.(docx|doc)$/i.test(hw.attachedFile || '');

                const isOverdue = !isSubmitted && hw.dueDate && new Date().toISOString().split('T')[0] > hw.dueDate;
                const isExpanded = !!expandedHomeworkIds[hw.id];

                return (
                  <div
                    key={hw.id}
                    className={`rounded-2xl border-2 transition-all overflow-hidden ${
                      !isSubmitted
                        ? (isOverdue 
                            ? 'border-rose-400 bg-rose-50/20 hover:border-rose-500 shadow-xs' 
                            : 'border-amber-400 bg-amber-50/25 hover:border-amber-500 shadow-xs ring-1 ring-amber-300/40')
                        : 'border-slate-200 bg-white hover:border-[#0072B5] shadow-2xs'
                    }`}
                  >
                    {/* ACCORDION HEADER (Nhấn vào để xổ xuống / thu gọn) */}
                    <div
                      onClick={() => toggleHomeworkExpand(hw.id)}
                      className={`p-3.5 sm:p-4 cursor-pointer select-none transition-colors flex items-start sm:items-center justify-between gap-3 ${
                        isExpanded
                          ? (!isSubmitted ? 'bg-amber-50/60 border-b border-amber-200/80' : 'bg-slate-50/90 border-b border-slate-200/80')
                          : (!isSubmitted ? 'hover:bg-amber-50/40' : 'hover:bg-slate-50/60')
                      }`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleHomeworkExpand(hw.id);
                        }
                      }}
                      title={isExpanded ? 'Nhấn để thu gọn thông tin bài tập' : 'Nhấn để xem thông tin chi tiết bài tập'}
                    >
                      {/* Cột trái: Tên bài, Môn, Hạn nộp & Cảnh báo / Báo hiệu */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Indicator icon: Check xanh lá hoặc Warning cam/đỏ */}
                          {!isSubmitted ? (
                            <span 
                              className={`flex items-center justify-center w-6 h-6 rounded-lg text-white shrink-0 ${
                                isOverdue ? 'bg-rose-500 animate-pulse' : 'bg-amber-500 animate-pulse'
                              }`} 
                              title={isOverdue ? 'Cảnh báo: Đã quá hạn nộp bài!' : 'Cảnh báo: Chưa nộp bài!'}
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#00A86B] text-white shrink-0" title="Đã nộp bài">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </span>
                          )}

                          <h4 className="font-black text-sm sm:text-base text-slate-800 leading-snug">
                            {hw.title}
                          </h4>

                          <span className="font-bold text-[11px] text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                            {hw.subject}
                          </span>
                        </div>

                        {/* Hàng thông tin phụ & Báo hiệu trạng thái */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className={`flex items-center gap-1 font-bold ${
                            isOverdue ? 'text-rose-600' : !isSubmitted ? 'text-amber-700' : 'text-slate-600'
                          }`}>
                            <Clock className="w-3.5 h-3.5" /> Hạn nộp: {hw.dueDate}
                          </span>

                          {/* Báo hiệu cảnh báo rõ ràng */}
                          {!isSubmitted ? (
                            <span className={`inline-flex items-center gap-1 font-black text-[11px] px-2 py-0.5 rounded-full border ${
                              isOverdue 
                                ? 'bg-rose-100 text-rose-800 border-rose-300' 
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                            }`}>
                              <AlertCircle className="w-3 h-3" />
                              {isOverdue ? 'ĐÃ QUÁ HẠN NỘP!' : 'CHƯA NỘP BÀI'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <Check className="w-3 h-3 text-[#00A86B]" />
                              Đã nộp bài
                              {mySub?.submittedAt ? ` (${mySub.submittedAt})` : ''}
                            </span>
                          )}

                          {hasAttachment && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md">
                              <Paperclip className="w-3 h-3" /> Có đính kèm đề bài
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cột phải: Điểm số / Huy hiệu trạng thái & Mũi tên xổ xuống */}
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Điểm số nếu có */}
                        {(mySub?.score !== undefined || hw.score !== undefined) ? (
                          <div className="text-right">
                            <span className="text-sm sm:text-base font-black text-[#00A86B] bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-300 shadow-2xs block">
                              {(mySub?.score !== undefined ? mySub.score : hw.score)?.toFixed(1)} / 10
                            </span>
                            <span className="text-[10px] font-bold text-emerald-700 block mt-0.5">
                              Đã chấm điểm
                            </span>
                          </div>
                        ) : !isSubmitted ? (
                          <div className="text-right hidden sm:block">
                            <span className={`text-[11px] font-black px-2.5 py-1 rounded-xl border block ${
                              isOverdue ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-amber-100 text-amber-900 border-amber-300'
                            }`}>
                              {isOverdue ? 'Cần làm gấp' : 'Cần nộp bài'}
                            </span>
                            <span className="text-[10px] text-amber-800 font-semibold block mt-0.5">
                              Nhấn để xem &amp; nộp
                            </span>
                          </div>
                        ) : (
                          <div className="text-right hidden sm:block">
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 block">
                              Đã nộp bài
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                              Chờ chấm điểm
                            </span>
                          </div>
                        )}

                        {/* Mũi tên xổ xuống / thu gọn */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                          isExpanded 
                            ? 'bg-[#0072B5] text-white shadow-xs' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}>
                          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${
                            isExpanded ? 'rotate-180' : ''
                          }`} />
                        </div>
                      </div>
                    </div>

                    {/* ACCORDION CONTENT (Thông tin chi tiết bài tập - Xổ xuống khi được nhấn vào) */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 space-y-4 bg-white animate-fade-in border-t border-slate-100">
                        {/* Lời dặn của cô giáo */}
                        {hw.content && (
                          <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs text-slate-700">
                            <span className="font-bold text-[#0072B5] block mb-1">Lời dặn của cô giáo:</span>
                            <p className="leading-relaxed whitespace-pre-wrap">{hw.content}</p>
                          </div>
                        )}

                        {/* Tài liệu bài tập / Đề bài đính kèm */}
                        {hasAttachment && (
                          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-blue-50/70 border border-blue-200">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {isImg && hw.attachedFileUrl ? (
                                <img
                                  src={hw.attachedFileUrl}
                                  alt={hw.attachedFile || 'Đề bài'}
                                  className="w-10 h-10 object-cover rounded-lg border border-blue-200 shrink-0"
                                />
                              ) : (
                                <div className="p-2 rounded-lg bg-blue-100 text-[#0072B5] shrink-0">
                                  <FileText className="w-5 h-5" />
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
                                  fileType: isImg ? 'image' : isPdf ? 'pdf' : isExcel ? 'excel' : isWord ? 'word' : 'other',
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

                        {/* Thông tin bài đã nộp của học sinh nếu đã nộp */}
                        {mySub && (
                          <div className="rounded-xl bg-emerald-50/90 p-3 sm:p-3.5 border border-emerald-300 text-xs text-emerald-950 space-y-2">
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
                            <div className="flex items-center gap-2 pt-1 flex-wrap">
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

                        {/* Lời phê chấm bài từ Giáo viên */}
                        {(mySub?.feedback || hw.comment) && (
                          <div className="rounded-xl bg-amber-50/70 p-3 sm:p-3.5 border border-amber-200/90 text-xs text-slate-700">
                            <strong className="text-[#0B486B] not-italic block font-black text-xs mb-1 flex items-center gap-1.5">
                              <Award className="w-3.5 h-3.5 text-[#F39C12]" />
                              Lời phê chấm bài từ Giáo viên:
                            </strong>
                            <p className="italic leading-relaxed text-slate-800">
                              &ldquo;{mySub?.feedback || hw.comment}&rdquo;
                            </p>
                          </div>
                        )}

                        {/* Bài sửa / Chấm chữa từ giáo viên nếu có */}
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

                        {/* Nút Nộp Bài / Gửi bài làm cho cô nếu chưa nộp */}
                        {!mySub && (
                          <div className="pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleOpenSubmitModal(hw)}
                              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm text-white shadow-md transition-all cursor-pointer active:scale-95 ${
                                isOverdue
                                  ? 'bg-rose-600 hover:bg-rose-700'
                                  : 'bg-[#00A86B] hover:bg-emerald-700'
                              }`}
                            >
                              <Camera className="w-4 h-4" />
                              <span>{isOverdue ? 'Nộp bài bù ngay (Đã quá hạn)' : 'Nộp bài / Gửi bài làm cho cô ngay'}</span>
                            </button>
                          </div>
                        )}
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
      )}

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

      {/* Iframe ẩn đồng bộ trạng thái đơn PENDING của học sinh trực tiếp từ pay.payos.vn */}
      {!isTuitionModalOpen &&
        pendingOrdersForCurrentStudent.slice(0, 3).map((order) => {
          const url = buildPayOSIframeListenerUrl({
            paymentLinkId: order.paymentLinkId,
            checkoutUrl: order.checkoutUrl,
          });
          if (!url) return null;
          return (
            <iframe
              key={`payos-sync-${order.orderCode}`}
              src={url}
              title={`PayOS Sync ${order.orderCode}`}
              className="hidden w-0 h-0 border-0 pointer-events-none"
              aria-hidden="true"
            />
          );
        })}
    </div>
  );
};
