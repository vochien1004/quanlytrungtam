import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { 
  ClipboardCheck, 
  BookMarked, 
  Award, 
  Send, 
  CheckCircle2, 
  XCircle,
  Clock, 
  AlertCircle, 
  Paperclip, 
  Trash2, 
  Zap, 
  Calendar, 
  CalendarCheck,
  Users, 
  FileCheck2, 
  Loader2,
  Phone,
  School,
  FileText,
  Check,
  Save,
  CheckCircle,
  Table,
  Download,
  Printer,
  Eye,
  Camera,
  Image as ImageIcon,
  RotateCw,
  Upload,
  X,
  Pencil,
  RotateCcw,
  CheckSquare,
  Square,
  MinusSquare,
  AlertTriangle
} from 'lucide-react';
import { ClassItem, TeacherItem, StudentItem, AssignmentItem, AttendanceStatus, AssignmentSubmission } from '../../data/mockData';
import { UserAccount } from '../../services/authService';
import { 
  getValidTeacherName, 
  saveDailyAttendance, 
  getRealtimeAttendance, 
  isTeacherRole, 
  uploadAssignmentFileToStorage,
  deleteAssignment,
  deleteMultipleAssignments,
  updateAssignment,
  reassignHomework,
  reassignMultipleHomeworks,
  deleteFileFromStorage,
  submitGrade
} from '../../services/firebaseService';
import { AccountAvatar } from '../common/AccountAvatar';
import { DocumentPreviewModal, DocumentPreviewData } from '../common/DocumentPreviewModal';
const PdfViewer = lazy(() => import('../common/PdfViewer').then((m) => ({ default: m.PdfViewer })));

interface TeacherWorkstationHubProps {
  teacher?: TeacherItem;
  currentUser?: UserAccount | null;
  classes?: ClassItem[];
  students?: StudentItem[];
  assignments?: AssignmentItem[];
  attendanceRecords?: any[];
  activeCenterId?: string;
  activeTabKey?: 'attendance' | 'homework' | 'grading';
  onUpdateAttendance?: (studentId: string, status: AttendanceStatus) => void;
  onUpdateStudentRemark?: (studentId: string, remark: string) => void;
  onSyncToAdmin?: (sessionData: any) => Promise<any> | void;
  onAssignHomework?: (newAssignment: any) => Promise<any> | void;
  onGradeStudentHomework?: (assignmentId: string, studentName: string, score: number, comment: string) => Promise<any> | void;
}

export const TeacherWorkstationHub: React.FC<TeacherWorkstationHubProps> = ({
  teacher,
  currentUser,
  classes = [],
  students = [],
  assignments = [],
  attendanceRecords = [],
  activeCenterId,
  activeTabKey = 'attendance',
  onUpdateAttendance,
  onUpdateStudentRemark,
  onSyncToAdmin,
  onAssignHomework,
  onGradeStudentHomework,
}) => {
  // Active feature tab: 'attendance' | 'homework' | 'grading'
  const [activeTab, setActiveTab] = useState<'attendance' | 'homework' | 'grading'>(activeTabKey);

  useEffect(() => {
    if (activeTabKey) {
      setActiveTab(activeTabKey);
    }
  }, [activeTabKey]);

  // 1. Identify current Teacher User UID & Profile
  const currentTeacherUid = currentUser?.uid || currentUser?.id || teacher?.id || '';

  // Phân quyền hiển thị: Đơn giá/buổi và phần Tổng tiền BỊ ẨN đối với tài khoản Giáo viên (role: teachers/teacher), CHỈ HIỂN THỊ đối với tài khoản center_admin
  const isTeacher = isTeacherRole(currentUser?.role);
  const isCenterAdmin = !isTeacher && (currentUser?.role === 'center_admin' || currentUser?.role === 'super_admin');
  const showFinancials = isCenterAdmin;

  // Xác định họ tên hiển thị chuẩn xác nhất của giáo viên
  const teacherDisplayName =
    getValidTeacherName(
      currentUser?.fullName,
      currentUser?.name,
      currentUser?.displayName,
      teacher?.fullName,
      teacher?.name
    ) || 'Giáo Viên';

  // Avatar helper
  const getAvatarUrl = (avatarUrl?: string | null, name?: string) => {
    if (avatarUrl && avatarUrl.trim() !== '') return avatarUrl;
    const displayName = name || 'Teacher';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=00A86B&color=fff&bold=true`;
  };

  // 2. Strict Class Assignment Filtering (Lọc danh sách Lớp học theo phân công thực tế từ Firebase)
  // Hỗ trợ 1 giáo viên đảm nhận nhiều lớp cùng lúc (assignedClassIds)
  const strictlyAssignedClasses = (classes || []).filter((c) => {
    if (!c) return false;
    const matchUid = currentTeacherUid && c.teacherId === currentTeacherUid;
    const matchTeacherId = teacher?.id && c.teacherId === teacher.id;
    const matchMainClass = teacher?.mainClassId && c.id === teacher.mainClassId;
    const matchAssignedArray = Array.isArray(teacher?.assignedClassIds) && teacher.assignedClassIds.includes(c.id);
    const matchCurrentUserAssigned = Array.isArray((currentUser as any)?.assignedClassIds) && (currentUser as any).assignedClassIds.includes(c.id);
    const matchTeacherName = teacher?.name && c.teacherName && c.teacherName.toLowerCase().includes(teacher.name.toLowerCase());
    const matchCurrentUserName = currentUser?.name && c.teacherName && c.teacherName.toLowerCase().includes(currentUser.name.toLowerCase());
    const matchCurrentUserFullName = currentUser?.fullName && c.teacherName && c.teacherName.toLowerCase().includes(currentUser.fullName.toLowerCase());
    const matchCurrentUserDisplayName = currentUser?.displayName && c.teacherName && c.teacherName.toLowerCase().includes(currentUser.displayName.toLowerCase());
    return matchUid || matchTeacherId || matchMainClass || matchAssignedArray || matchCurrentUserAssigned || matchTeacherName || matchCurrentUserName || matchCurrentUserFullName || matchCurrentUserDisplayName;
  });

  const assignedClasses = strictlyAssignedClasses.length > 0 ? strictlyAssignedClasses : classes;

  // Selected Class ID State (Defaults to first assigned class)
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [isClassLoading, setIsClassLoading] = useState<boolean>(false);

  useEffect(() => {
    if (assignedClasses.length > 0) {
      if (!selectedClassId || !assignedClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(assignedClasses[0].id);
      }
    } else {
      setSelectedClassId('');
    }
  }, [assignedClasses]);

  // Class switch handler with smooth loading spinner feedback
  const handleClassChange = (newClassId: string) => {
    if (newClassId === selectedClassId) return;
    setIsClassLoading(true);
    setSelectedClassId(newClassId);
    setTimeout(() => {
      setIsClassLoading(false);
    }, 300);
  };

  // Current selected Class object
  const currentClass = assignedClasses.find((c) => c.id === selectedClassId) || assignedClasses[0];

  // Helper tính toán chính xác số lượng học sinh thực tế trong từng lớp học
  const getClassStudentCount = (c: ClassItem) => {
    if (!c) return 0;
    const cId = String(c.id || '').trim();
    const cName = String(c.name || '').trim().toLowerCase();
    const cCode = String(c.classCode || '').trim().toLowerCase();

    const actualList = (students || []).filter((s) => {
      if (!s) return false;
      const sClassId = String(s.classId || '').trim();
      const sClassName = String(s.className || '').trim().toLowerCase();
      if (sClassId && cId && sClassId === cId) return true;
      if (sClassId && cCode && sClassId.toLowerCase() === cCode) return true;
      if (sClassName && cName && (sClassName === cName || sClassName.includes(cName) || cName.includes(sClassName))) return true;
      if (sClassName && cCode && sClassName === cCode) return true;
      return false;
    });

    if (actualList.length > 0) {
      return actualList.length;
    }
    return c.studentCount || 0;
  };

  // 3. Filter Students strictly for selectedClassId (từ dữ liệu thực Firestore)
  const assignedStudents = useMemo(() => {
    const cId = String(selectedClassId || '').trim();
    const cName = String(currentClass?.name || '').trim().toLowerCase();
    const cCode = String(currentClass?.classCode || '').trim().toLowerCase();

    const list = (students || []).filter((s) => {
      if (!s) return false;
      const sClassId = String(s.classId || '').trim();
      const sClassName = String(s.className || '').trim().toLowerCase();
      if (sClassId && cId && sClassId === cId) return true;
      if (sClassId && cCode && sClassId.toLowerCase() === cCode) return true;
      if (sClassName && cName && (sClassName === cName || sClassName.includes(cName) || cName.includes(sClassName))) return true;
      if (sClassName && cCode && sClassName === cCode) return true;
      return false;
    });

    return list;
  }, [students, selectedClassId, currentClass]);

  // Filter Assignments strictly for selectedClassId (Tab 3)
  const assignedHomeworks = (assignments || []).filter(
    (a) => a?.classId === selectedClassId || a?.className?.includes(selectedClassId) || (currentClass?.name && a?.className?.includes(currentClass.name))
  );

  // =========================================================================
  // MULTI-TENANT: LẮNG NGHE SUB-COLLECTION /centers/${currentCenterId}/attendance
  // =========================================================================
  // Xác định cơ sở trung tâm hiện tại (Multi-Tenant)
  const currentCenterId = (activeCenterId || currentUser?.centerId || teacher?.centerId || '').trim();

  // Lắng nghe sub-collection điểm danh của cơ sở hiện tại: /centers/${currentCenterId}/attendance
  const [realtimeAttendance, setRealtimeAttendance] = useState<any[]>([]);

  useEffect(() => {
    // Kiểm tra chặt chẽ điều kiện if (!currentCenterId) return; trước khi thực hiện truy vấn
    if (!currentCenterId) return;

    let isSubscribed = true;
    const unsubscribe = getRealtimeAttendance(
      currentCenterId,
      (records) => {
        if (isSubscribed) {
          setRealtimeAttendance(records);
        }
      },
      (err) => {
        console.warn('Lỗi listener attendance tại TeacherWorkstationHub:', err?.message);
      }
    );

    // Dọn dẹp listener (unsubscribe) khi component unmount
    return () => {
      isSubscribed = false;
      if (unsubscribe) unsubscribe();
    };
  }, [currentCenterId]);

  // Hợp nhất dữ liệu điểm danh từ props và listener sub-collection của trung tâm hiện tại
  const effectiveAttendanceRecords = useMemo(() => {
    const map = new Map<string, any>();
    (attendanceRecords || []).forEach((r) => {
      if (r) {
        const k = r.id || `${r.classId}_${r.date}`;
        map.set(k, r);
      }
    });
    (realtimeAttendance || []).forEach((r) => {
      if (r) {
        const k = r.id || `${r.classId}_${r.date}`;
        map.set(k, { ...(map.get(k) || {}), ...r });
      }
    });
    return Array.from(map.values());
  }, [attendanceRecords, realtimeAttendance]);

  // =========================================================================
  // DROPDOWN CHỌN THÁNG VÀ CHỌN NGÀY ĐIỂM DANH (XỔ XUỐNG)
  // =========================================================================
  const initialDateIso = new Date().toISOString().split('T')[0];
  const initialMonthIso = initialDateIso.slice(0, 7);

  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonthIso);
  const [sessionDate, setSessionDate] = useState<string>(initialDateIso);

  // Danh sách Tháng điểm danh (xổ xuống)
  const monthOptions = useMemo(() => {
    const year = parseInt(selectedMonth.split('-')[0] || '2026', 10);
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const mStr = m.toString().padStart(2, '0');
      months.push({
        value: `${year}-${mStr}`,
        label: `Tháng ${mStr}/${year}`,
      });
    }
    return months;
  }, [selectedMonth]);

  // Danh sách Ngày điểm danh trong tháng đã chọn (xổ xuống)
  const dayOptions = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr || '2026', 10);
    const month = parseInt(monthStr || '10', 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = d.toString().padStart(2, '0');
      const iso = `${yearStr}-${monthStr}-${dStr}`;
      const dObj = new Date(year, month - 1, d);
      const dayOfWeek = dayNames[dObj.getDay()];

      // Kiểm tra xem đã có bản ghi điểm danh thực tế từ Firebase cho ngày này chưa
      const record = (effectiveAttendanceRecords || []).find(
        (att) => att && att.classId === selectedClassId && att.date === iso
      );

      const hasAttendance = !!record;
      const statusText = hasAttendance
        ? `[✓ Đã điểm danh: ${record.presentCount || 0}/${record.totalCount || 0} HS]`
        : '[⚠ Chưa lưu điểm danh]';

      days.push({
        value: iso,
        label: `${dStr}/${monthStr}/${yearStr} • ${dayOfWeek} ${statusText}`,
        hasRecord: hasAttendance,
        record,
      });
    }
    return days;
  }, [selectedMonth, selectedClassId, effectiveAttendanceRecords]);

  // Tìm bản ghi điểm danh hiện có trên Firebase cho (selectedClassId, sessionDate)
  const existingRecord = useMemo(() => {
    return (effectiveAttendanceRecords || []).find(
      (a) => a && a.classId === selectedClassId && a.date === sessionDate
    );
  }, [effectiveAttendanceRecords, selectedClassId, sessionDate]);

  // =========================================================================
  // CHẾ ĐỘ XEM ĐIỂM DANH: 'daily' (Theo ngày) | 'monthly' (Toàn bộ lớp theo tháng)
  // =========================================================================
  const [attendanceViewMode, setAttendanceViewMode] = useState<'daily' | 'monthly'>('daily');

  // Đơn giá mỗi buổi học (VNĐ) để tính cột Tổng tiền tự động (mặc định 40,000 đ như ảnh mẫu của người dùng)
  const [pricePerSession, setPricePerSession] = useState<number>(40000);

  // Tất cả bản ghi điểm danh thực tế từ Firebase thuộc lớp học và tháng được chọn
  const monthlyRecords = useMemo(() => {
    return (effectiveAttendanceRecords || []).filter((att) => {
      if (!att || att.classId !== selectedClassId) return false;
      const dateStr = att.date || '';
      return att.sessionMonth === selectedMonth || dateStr.startsWith(selectedMonth);
    });
  }, [effectiveAttendanceRecords, selectedClassId, selectedMonth]);

  // Danh sách các ngày trong tháng (1 đến 28/29/30/31)
  const daysInMonthList = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr || '2026', 10);
    const month = parseInt(monthStr || '10', 10);
    const totalDays = new Date(year, month, 0).getDate();
    return Array.from({ length: totalDays }, (_, i) => i + 1);
  }, [selectedMonth]);

  // Xuất file CSV/Excel cho bảng điểm danh tháng (Tự động ẩn đơn giá & tổng tiền đối với giáo viên)
  const handleExportMonthlyCsv = () => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const dayCols = daysInMonthList;

    let csv = `\uFEFF${showFinancials ? 'BẢNG ĐIỂM DANH VÀ HỌC PHÍ' : 'BẢNG ĐIỂM DANH'} THÁNG ${monthStr}/${yearStr}\n`;
    csv += `Lớp học: ${currentClass?.name || ''} - Giáo viên phụ trách: ${teacherDisplayName}\n\n`;
    csv += `TT,TÊN HỌC SINH,SĐT PH,${dayCols.join(',')},Tổng buổi${showFinancials ? ',Đơn giá (VNĐ),Tổng tiền (VNĐ)' : ''}\n`;

    assignedStudents.forEach((st, idx) => {
      let attended = 0;
      const dayCells = dayCols.map((d) => {
        const dStr = d.toString().padStart(2, '0');
        const iso = `${selectedMonth}-${dStr}`;
        const rec = monthlyRecords.find((r) => r.date === iso);
        const sRec = rec?.records?.find((r: any) => r.studentId === st.id);
        if (sRec?.status === 'present') {
          attended++;
          return 'X';
        }
        if (sRec?.status === 'excused') return 'P';
        if (sRec?.status === 'unexcused') return 'K';
        return '';
      });
      if (showFinancials) {
        const fee = attended * pricePerSession;
        csv += `${idx + 1},"${st.name}","${st.parentPhone || ''}",${dayCells.join(',')},${attended},${pricePerSession},${fee}\n`;
      } else {
        csv += `${idx + 1},"${st.name}","${st.parentPhone || ''}",${dayCells.join(',')},${attended}\n`;
      }
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `DiemDanh_${(currentClass?.name || 'Lop').replace(/\s+/g, '_')}_Thang_${monthStr}_${yearStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trạng thái điểm danh & nhận xét từng học sinh trong buổi học
  const [sessionStatuses, setSessionStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [sessionRemarks, setSessionRemarks] = useState<Record<string, string>>({});
  const [generalRemark, setGeneralRemark] = useState<string>('');
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Đồng bộ dữ liệu thực tế từ Firestore khi đổi Lớp học, Ngày điểm danh, hoặc có bản ghi mới
  useEffect(() => {
    if (existingRecord && Array.isArray(existingRecord.records) && existingRecord.records.length > 0) {
      const statuses: Record<string, AttendanceStatus> = {};
      const remarks: Record<string, string> = {};
      existingRecord.records.forEach((r: any) => {
        if (r && r.studentId) {
          statuses[r.studentId] = r.status === 'present' ? 'present' : 'absent';
          if (r.note && !r.note.includes('Học sinh mới đăng ký')) remarks[r.studentId] = r.note;
        }
      });
      // Đối với học sinh mới chưa có trong bản ghi cũ
      assignedStudents.forEach((st) => {
        if (st?.id && !statuses[st.id]) {
          statuses[st.id] = 'present';
        }
      });
      setSessionStatuses(statuses);
      setSessionRemarks(remarks);
      setGeneralRemark(existingRecord.generalNote || '');
    } else {
      // Khi chưa có bản ghi trên Firebase cho ngày này, thiết lập trạng thái mặc định cho học sinh
      const statuses: Record<string, AttendanceStatus> = {};
      const remarks: Record<string, string> = {};
      assignedStudents.forEach((st) => {
        if (st?.id) {
          statuses[st.id] = 'present';
        }
      });
      setSessionStatuses(statuses);
      setSessionRemarks(remarks);
      setGeneralRemark('');
    }
  }, [existingRecord, selectedClassId, sessionDate, assignedStudents.length]);

  // Tạo hàm serialize trạng thái điểm danh hiện tại để so sánh chính xác
  const currentAttendanceStateHash = useMemo(() => {
    const statusPart = assignedStudents.map((st) => `${st.id}:${sessionStatuses[st.id] || 'present'}`).join('|');
    const remarkPart = assignedStudents.map((st) => `${st.id}:${sessionRemarks[st.id] || ''}`).join('|');
    return `${sessionDate}_${selectedClassId}_${statusPart}_${remarkPart}_${generalRemark || ''}`;
  }, [assignedStudents, sessionStatuses, sessionRemarks, generalRemark, sessionDate, selectedClassId]);

  // Trạng thái đã lưu gần nhất trong phiên
  const [justSavedHash, setJustSavedHash] = useState<string | null>(null);

  useEffect(() => {
    setJustSavedHash(null);
  }, [sessionDate, selectedClassId]);

  // Kiểm tra xem dữ liệu trong existingRecord có khớp với sessionStatuses hiện tại không
  const isCurrentSessionSavedInDb = useMemo(() => {
    if (!existingRecord) return false;
    if (!Array.isArray(existingRecord.records) || existingRecord.records.length === 0) return false;
    const oldRecordsMap = new Map<string, any>((existingRecord.records || []).map((r: any) => [r.studentId, r]));

    for (const st of assignedStudents) {
      if (!st?.id) continue;
      const oldRec: any = oldRecordsMap.get(st.id);
      if (!oldRec) return false;
      const currentSt = sessionStatuses[st.id] || 'present';
      const currentRem = sessionRemarks[st.id] || '';
      if ((oldRec.status || 'present') !== currentSt) return false;
      if ((oldRec.note || '') !== currentRem) return false;
    }

    if (generalRemark && generalRemark.trim() !== (existingRecord.generalNote || '').trim()) {
      return false;
    }

    return true;
  }, [existingRecord, assignedStudents, sessionStatuses, sessionRemarks, generalRemark]);

  // Biến cờ xác định Giáo viên chưa lưu điểm danh cho ngày/lớp đang chọn
  const isAttendanceUnsaved = useMemo(() => {
    if (justSavedHash === currentAttendanceStateHash) {
      return false;
    }
    return !isCurrentSessionSavedInDb;
  }, [justSavedHash, currentAttendanceStateHash, isCurrentSessionSavedInDb]);

  // Form state for creating homework (Tab 2)
  const [hwTitle, setHwTitle] = useState('');
  const [hwDueDate, setHwDueDate] = useState('');
  const [hwContent, setHwContent] = useState('');
  const [hwAttachedFile, setHwAttachedFile] = useState<string | null>(null);
  const [hwAttachedFileUrl, setHwAttachedFileUrl] = useState<string | null>(null);
  const [hwAttachedFileData, setHwAttachedFileData] = useState<ArrayBuffer | null>(null);
  const [hwAttachedFileType, setHwAttachedFileType] = useState<'pdf' | 'word' | 'image' | 'other'>('other');
  const [hwAttachedFileHtml, setHwAttachedFileHtml] = useState<string | null>(null);
  const [hwAttachedFileRaw, setHwAttachedFileRaw] = useState<File | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);

  // Modal preview tài liệu (Word, PDF, Ảnh)
  const [previewDoc, setPreviewDoc] = useState<DocumentPreviewData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Modal xem danh sách bài nộp của học sinh
  const [selectedHwForSubmissions, setSelectedHwForSubmissions] = useState<AssignmentItem | null>(null);
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
  const [submissionScores, setSubmissionScores] = useState<Record<string, number>>({});
  const [submissionFeedbacks, setSubmissionFeedbacks] = useState<Record<string, string>>({});
  const [savingSubStudentId, setSavingSubStudentId] = useState<string | null>(null);

  const handleSaveSubmissionGrade = async (asgId: string, studentId: string) => {
    const score = submissionScores[studentId] ?? 8.5;
    const feedback = submissionFeedbacks[studentId] ?? 'Bài làm tốt, trình bày sạch sẽ!';
    setSavingSubStudentId(studentId);
    try {
      const cId = currentClass?.centerId || currentCenterId || 'HG01';
      await submitGrade(cId, asgId, studentId, score, feedback, undefined, undefined, 'teacher');
      setActionToast({ type: 'success', message: 'Đã lưu điểm và lời phê thành công!' });
      if (selectedHwForSubmissions && selectedHwForSubmissions.id === asgId) {
        const updatedSubs = (selectedHwForSubmissions.submissions || []).map(s => {
          if (s.studentId === studentId) {
            return { ...s, score, feedback };
          }
          return s;
        });
        setSelectedHwForSubmissions({
          ...selectedHwForSubmissions,
          submissions: updatedSubs,
          score,
          comment: feedback,
          status: 'graded'
        });
      }
    } catch (err: any) {
      setActionToast({ type: 'error', message: err.message || 'Lỗi khi lưu điểm' });
    } finally {
      setSavingSubStudentId(null);
      setTimeout(() => setActionToast(null), 3500);
    }
  };

  // Camera chụp ảnh bài tập trực tiếp
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = React.useRef<MediaStream | null>(null);

  // Lưu đệm dữ liệu file đã tải lên trong phiên để xem trước mọi lúc kể cả sau khi bấm Giao bài tập
  const uploadedFilesCacheRef = React.useRef<
    Record<string, { data: ArrayBuffer; url: string; html: string | null; type: 'pdf' | 'word' | 'image' | 'other' }>
  >({});

  // Chuyển đổi ảnh chụp sang chuỗi DataURL nén hợp lý để lưu bền vững và hiển thị trong trình xem trước mọi lúc
  const convertImageFileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawDataUrl = e.target?.result as string;
        if (!rawDataUrl) {
          reject(new Error('Không thể đọc dữ liệu ảnh'));
          return;
        }
        const img = new window.Image();
        img.onload = () => {
          try {
            const maxDim = 1600;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = window.document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(rawDataUrl);
              return;
            }
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve(compressedDataUrl);
          } catch {
            resolve(rawDataUrl);
          }
        };
        img.onerror = () => resolve(rawDataUrl);
        img.src = rawDataUrl;
      };
      reader.onerror = () => reject(new Error('Lỗi đọc file ảnh'));
      reader.readAsDataURL(file);
    });
  };

  // Xoay ảnh chụp đính kèm 90 độ trực tiếp trên khung xem trước
  const handleRotateAttachedImage = () => {
    if (!hwAttachedFileUrl || hwAttachedFileType !== 'image') return;
    const img = new window.Image();
    img.onload = () => {
      const canvas = window.document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      const rotatedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setHwAttachedFileUrl(rotatedDataUrl);
      if (hwAttachedFile && uploadedFilesCacheRef.current[hwAttachedFile]) {
        uploadedFilesCacheRef.current[hwAttachedFile].url = rotatedDataUrl;
      }
    };
    img.src = hwAttachedFileUrl;
  };

  // Xử lý mở / đóng Camera chụp ảnh bài tập
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
        setCameraError('Trình duyệt không hỗ trợ truy cập Camera trực tiếp. Vui lòng chọn nút "Tải ảnh chụp từ thiết bị".');
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
      setCameraError('Không thể mở Camera (chưa cấp quyền hoặc thiết bị không có Camera). Bạn có thể chọn ảnh chụp từ máy bên dưới.');
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
        const fileName = `Anh_chup_bai_tap_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.jpg`;
        const capturedFile = new File([blob], fileName, { type: 'image/jpeg' });
        handleFileUpload(capturedFile);
        handleCloseCameraModal();
      },
      'image/jpeg',
      0.9
    );
  };

  // Xử lý đọc file và chuẩn bị dữ liệu xem trước (Word, PDF, Ảnh chụp)
  const handleFileUpload = async (file: File) => {
    setIsReadingFile(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isImgExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic'].includes(ext);
    const detectedType: 'pdf' | 'word' | 'image' | 'other' =
      ext === 'pdf' || file.type === 'application/pdf'
        ? 'pdf'
        : ext === 'docx' || ext === 'doc' || file.type.includes('word') || file.type.includes('officedocument')
        ? 'word'
        : isImgExt || file.type.startsWith('image/')
        ? 'image'
        : 'other';

    const objectUrl = URL.createObjectURL(file);

    try {
      const arrayBuffer = await file.arrayBuffer();
      let parsedHtml: string | null = null;
      let finalPreviewUrl = objectUrl;

      if (detectedType === 'word') {
        try {
          // @ts-ignore
          const mammothModule = await import('mammoth');
          const mammothInstance = (mammothModule as any).default || mammothModule;
          const result = await mammothInstance.convertToHtml({ arrayBuffer: arrayBuffer.slice(0) });
          parsedHtml = result.value;
        } catch (err) {
          console.warn('Lỗi phân tích file Word với mammoth:', err);
          parsedHtml = null;
        }
      } else if (detectedType === 'image') {
        try {
          finalPreviewUrl = await convertImageFileToDataUrl(file);
        } catch (imgErr) {
          console.warn('Sử dụng objectUrl cho ảnh chụp:', imgErr);
          finalPreviewUrl = objectUrl;
        }
      }

      uploadedFilesCacheRef.current[file.name] = {
        data: arrayBuffer,
        url: finalPreviewUrl,
        html: parsedHtml,
        type: detectedType,
      };

      setHwAttachedFileType(detectedType);
      setHwAttachedFileData(arrayBuffer);
      setHwAttachedFileUrl(finalPreviewUrl);
      setHwAttachedFileHtml(parsedHtml);
      setHwAttachedFile(file.name);
      setHwAttachedFileRaw(file);
    } catch (err) {
      console.warn('Lỗi đọc dữ liệu tệp:', err);
      setHwAttachedFileType(detectedType);
      setHwAttachedFileUrl(objectUrl);
      setHwAttachedFile(file.name);
      setHwAttachedFileRaw(file);
    } finally {
      setIsReadingFile(false);
    }
  };

  // Selected Assignment for Grading (Tab 3)
  const [selectedHomeworkId, setSelectedHomeworkId] = useState<string>('');
  const [gradingScores, setGradingScores] = useState<Record<string, number>>({});
  const [gradingComments, setGradingComments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (assignedHomeworks.length > 0) {
      if (!selectedHomeworkId || !assignedHomeworks.some((a) => a.id === selectedHomeworkId)) {
        setSelectedHomeworkId(assignedHomeworks[0].id);
      }
    } else {
      setSelectedHomeworkId('');
    }
  }, [assignedHomeworks]);

  // Thống kê Sĩ số & Điểm danh thực tế
  const totalCount = assignedStudents.length;
  const presentCount = assignedStudents.filter((s) => (sessionStatuses[s.id] || 'present') === 'present').length;
  const absentCount = totalCount - presentCount;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 100;

  // Actions
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [gradingLoadingId, setGradingLoadingId] = useState<string | null>(null);

  const handleMarkAllPresent = () => {
    const updated: Record<string, AttendanceStatus> = {};
    assignedStudents.forEach((st) => {
      if (st?.id) updated[st.id] = 'present';
    });
    setSessionStatuses((prev) => ({ ...prev, ...updated }));
  };

  const handleSetStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setSessionStatuses((prev) => ({ ...prev, [studentId]: status }));
    if (onUpdateAttendance) {
      onUpdateAttendance(studentId, status);
    }
  };

  const handleSyncAttendanceToAdmin = async () => {
    // Kiểm tra chặt chẽ điều kiện if (!currentCenterId) return; trước khi thực hiện truy vấn
    if (!currentCenterId) {
      setSyncErrorMsg('Vui lòng chọn hoặc liên kết cơ sở trung tâm hợp lệ trước khi lưu điểm danh!');
      setTimeout(() => setSyncErrorMsg(null), 4000);
      return;
    }
    if (!selectedClassId) {
      setSyncErrorMsg('Vui lòng chọn một lớp học để lưu điểm danh!');
      setTimeout(() => setSyncErrorMsg(null), 4000);
      return;
    }
    setIsSyncing(true);
    setSyncErrorMsg(null);
    try {
      const records = assignedStudents.map((st) => ({
        studentId: st.id,
        studentName: st.name,
        status: sessionStatuses[st.id] || 'present',
        note: sessionRemarks[st.id] !== undefined ? sessionRemarks[st.id] : '',
      }));

      const syncPayload = {
        centerId: currentCenterId,
        classId: selectedClassId,
        className: currentClass?.name || 'Lớp học',
        teacherId: currentTeacherUid,
        teacherName: teacherDisplayName,
        date: sessionDate,
        sessionDate,
        sessionMonth: selectedMonth,
        records,
        totalCount,
        presentCount,
        absentCount,
        generalNote: generalRemark || `Tổng số: ${totalCount}, Có mặt: ${presentCount}, Vắng mặt: ${absentCount}`,
      };

      // Chỉ tương tác với /centers/${currentCenterId}/attendance
      const recordId = await saveDailyAttendance(currentCenterId, syncPayload, 'teacher');

      if (onSyncToAdmin) {
        await onSyncToAdmin({ ...syncPayload, id: recordId });
      }
      setJustSavedHash(currentAttendanceStateHash);
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3500);
    } catch (err: any) {
      console.error('Lỗi khi lưu điểm danh:', err);
      setSyncErrorMsg(err?.message || 'Có lỗi khi lưu điểm danh vào Firebase.');
      setTimeout(() => setSyncErrorMsg(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateHomeworkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hwTitle.trim()) return;
    setIsAssigning(true);
    try {
      let finalUploadedUrl = hwAttachedFileUrl;
      let finalStoragePath = '';

      // Tải file lên Firebase Storage theo đúng phân cấp:
      // centers/${centerId}/teachers/${teacherId}/classes/${classId}/assignments/${Date.now()}_${fileName}
      if (hwAttachedFile) {
        try {
          const fileToUpload = hwAttachedFileRaw || (hwAttachedFileData ? new Blob([hwAttachedFileData]) : null);
          if (fileToUpload) {
            const uploadRes = await uploadAssignmentFileToStorage(
              activeCenterId || currentCenterId,
              currentTeacherUid,
              selectedClassId,
              fileToUpload,
              hwAttachedFile
            );
            if (uploadRes.downloadUrl) {
              finalUploadedUrl = uploadRes.downloadUrl;
              finalStoragePath = uploadRes.storagePath;
            }
          }
        } catch (uploadErr) {
          console.warn('Lỗi upload file đề bài tập lên Storage:', uploadErr);
        }
      }

      if (onAssignHomework) {
        const targetStudentIds = assignedStudents.map((s) => s.id);
        const targetStudentNames = assignedStudents.map((s) => s.name);

        await onAssignHomework({
          title: hwTitle.trim(),
          subject: currentClass?.subject || 'Văn hóa',
          dueDate: hwDueDate || sessionDate || '2026-10-30',
          assignedDate: new Date().toISOString().split('T')[0],
          status: 'working',
          maxScore: 10,
          classId: selectedClassId,
          className: currentClass?.name || 'Lớp học',
          targetStudentIds: targetStudentIds,
          assignedStudentIds: targetStudentIds,
          targetStudentNames: targetStudentNames,
          studentName: targetStudentNames.length > 0 ? targetStudentNames.join(', ') : (currentClass?.name || 'Cả lớp'),
          teacherId: currentTeacherUid,
          teacherName: currentUser?.name || teacher?.name || 'Giáo viên',
          content: hwContent,
          attachedFile: hwAttachedFile,
          attachedFileUrl: finalUploadedUrl,
          attachedFileType: hwAttachedFileType,
          attachedFileContentHtml: hwAttachedFileHtml,
          storagePath: finalStoragePath,
          submissions: [],
        });

        showActionToast(
          `✓ Đã giao bài tập thành công cho lớp ${currentClass?.name || ''} (${assignedStudents.length} học sinh)!`,
          'success'
        );
      }
      setHwTitle('');
      setHwContent('');
      setHwAttachedFile(null);
      setHwAttachedFileUrl(null);
      setHwAttachedFileData(null);
      setHwAttachedFileHtml(null);
      setHwAttachedFileRaw(null);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleOpenPreviewForHw = (hw: AssignmentItem) => {
    const cached = hw.attachedFile ? uploadedFilesCacheRef.current[hw.attachedFile] : undefined;
    const ext = (hw.attachedFile || '').split('.').pop()?.toLowerCase();
    const candidateUrl = cached?.url || hw.attachedFileUrl || null;
    const isDataImage = Boolean(candidateUrl && candidateUrl.startsWith('data:image/'));
    const type: 'pdf' | 'word' | 'image' | 'other' =
      cached?.type ||
      hw.attachedFileType ||
      (ext === 'pdf'
        ? 'pdf'
        : ext === 'docx' || ext === 'doc'
        ? 'word'
        : /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(hw.attachedFile || '') || isDataImage
        ? 'image'
        : 'word');

    const matchingFileData =
      cached?.data || (hw.attachedFile && hw.attachedFile === hwAttachedFile ? hwAttachedFileData : null);
    const isValidUrl =
      candidateUrl &&
      (candidateUrl.startsWith('blob:') ||
        candidateUrl.startsWith('data:') ||
        candidateUrl.startsWith('http://') ||
        candidateUrl.startsWith('https://'));

    setPreviewDoc({
      fileName: hw.attachedFile || (type === 'image' ? `${hw.title}.jpg` : `${hw.title}.docx`),
      fileUrl: isValidUrl ? candidateUrl : null,
      fileData: matchingFileData,
      fileType: type,
      htmlContent: cached?.html || hw.attachedFileContentHtml || null,
      assignmentTitle: hw.title,
      subject: hw.subject || currentClass?.subject || 'Văn hóa',
      className: hw.className || currentClass?.name || 'Lớp học',
      teacherName: hw.teacherName || teacherDisplayName,
      dueDate: hw.dueDate,
      assignmentContent: hw.content || '',
    });
    setIsPreviewOpen(true);
  };

  const handleSaveGradeSingle = async (studentId: string, studentName: string) => {
    setGradingLoadingId(studentId);
    try {
      const score = gradingScores[studentId] ?? 8.0;
      const comment = gradingComments[studentId] ?? 'Bài làm đạt yêu cầu.';
      const hwId = selectedHomeworkId || (assignedHomeworks[0]?.id || 'asg-1');
      if (onGradeStudentHomework) {
        await onGradeStudentHomework(hwId, studentName, score, comment);
      }
    } finally {
      setGradingLoadingId(null);
    }
  };

  // =========================================================================
  // XỬ LÝ CHỌN (CHECKBOX), XÓA, CHỈNH SỬA VÀ GIAO LẠI BÀI TẬP (FIREBASE & STORAGE)
  // =========================================================================
  const [selectedHwIds, setSelectedHwIds] = useState<string[]>([]);
  const [actionToast, setActionToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showActionToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setActionToast({ message, type });
    setTimeout(() => setActionToast(null), 4000);
  };

  const formatDisplayDate = (dateStr?: string | null, hwId?: string) => {
    if (dateStr) {
      if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        const parts = dateStr.split('T')[0].split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
      return dateStr;
    }
    if (hwId && hwId.startsWith('asg_')) {
      const ts = parseInt(hwId.replace('asg_', ''));
      if (!isNaN(ts) && ts > 1600000000000) {
        const d = new Date(ts);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
    }
    return sessionDate ? sessionDate.split('-').reverse().join('/') : new Date().toLocaleDateString('vi-VN');
  };

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return '--';
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const parts = dateStr.split('T')[0].split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const handleToggleSelectAllHw = () => {
    if (selectedHwIds.length === assignedHomeworks.length && assignedHomeworks.length > 0) {
      setSelectedHwIds([]);
    } else {
      setSelectedHwIds(assignedHomeworks.map((h) => h.id));
    }
  };

  const handleToggleSelectHw = (id: string) => {
    setSelectedHwIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // 1. Quản lý Xóa bài tập (Xóa đơn lẻ & Xóa hàng loạt theo ô tích chọn)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [hwsToDelete, setHwsToDelete] = useState<AssignmentItem[]>([]);
  const [isDeletingHw, setIsDeletingHw] = useState(false);

  const handleOpenDeleteSingle = (hw: AssignmentItem) => {
    setHwsToDelete([hw]);
    setIsDeleteModalOpen(true);
  };

  const handleOpenDeleteSelected = () => {
    const targets = assignedHomeworks.filter((h) => selectedHwIds.includes(h.id));
    if (targets.length === 0) return;
    setHwsToDelete(targets);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (hwsToDelete.length === 0) return;
    setIsDeletingHw(true);
    try {
      const targetCenter = activeCenterId || currentCenterId;
      await deleteMultipleAssignments(targetCenter, hwsToDelete, 'teacher');
      const deletedIds = new Set(hwsToDelete.map((h) => h.id));
      setSelectedHwIds((prev) => prev.filter((id) => !deletedIds.has(id)));
      setIsDeleteModalOpen(false);
      const count = hwsToDelete.length;
      setHwsToDelete([]);
      showActionToast(`Đã xóa thành công ${count} bài tập và đồng bộ Firebase & Storage!`, 'success');
    } catch (err: any) {
      console.error('Lỗi xóa bài tập:', err);
      showActionToast(`Lỗi khi xóa bài tập: ${err.message}`, 'error');
    } finally {
      setIsDeletingHw(false);
    }
  };

  // 2. Quản lý Giao lại bài tập cho học sinh
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [reassigningHws, setReassigningHws] = useState<AssignmentItem[]>([]);
  const [reassignDueDate, setReassignDueDate] = useState('');
  const [reassignNote, setReassignNote] = useState('');
  const [reassignResetSubmissions, setReassignResetSubmissions] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);

  const handleOpenReassignSingle = (hw: AssignmentItem) => {
    setReassigningHws([hw]);
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    setReassignDueDate(defaultDate.toISOString().split('T')[0]);
    setReassignNote('');
    setReassignResetSubmissions(false);
    setIsReassignModalOpen(true);
  };

  const handleOpenReassignSelected = () => {
    const targets = assignedHomeworks.filter((h) => selectedHwIds.includes(h.id));
    if (targets.length === 0) return;
    setReassigningHws(targets);
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    setReassignDueDate(defaultDate.toISOString().split('T')[0]);
    setReassignNote('');
    setReassignResetSubmissions(false);
    setIsReassignModalOpen(true);
  };

  const handleConfirmReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reassigningHws.length === 0 || !reassignDueDate) return;
    setIsReassigning(true);
    try {
      const targetCenter = activeCenterId || currentCenterId;
      const ids = reassigningHws.map((h) => h.id);
      await reassignMultipleHomeworks(
        targetCenter,
        ids,
        {
          newDueDate: reassignDueDate,
          resetSubmissions: reassignResetSubmissions,
          note: reassignNote,
        },
        'teacher'
      );
      showActionToast(
        `Đã giao lại thành công ${reassigningHws.length} bài tập cho học sinh!`,
        'success'
      );
      setIsReassignModalOpen(false);
      setReassigningHws([]);
      setSelectedHwIds([]);
    } catch (err: any) {
      console.error('Lỗi giao lại bài tập:', err);
      showActionToast(`Lỗi khi giao lại bài tập: ${err.message}`, 'error');
    } finally {
      setIsReassigning(false);
    }
  };

  // 3. Quản lý Chỉnh sửa bài tập
  const [editingHw, setEditingHw] = useState<AssignmentItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editMaxScore, setEditMaxScore] = useState<number>(10);
  const [editAttachedFile, setEditAttachedFile] = useState<string | null>(null);
  const [editAttachedFileUrl, setEditAttachedFileUrl] = useState<string | null>(null);
  const [editAttachedFileData, setEditAttachedFileData] = useState<ArrayBuffer | null>(null);
  const [editAttachedFileType, setEditAttachedFileType] = useState<'pdf' | 'word' | 'image' | 'other'>('other');
  const [editAttachedFileHtml, setEditAttachedFileHtml] = useState<string | null>(null);
  const [editAttachedFileRaw, setEditAttachedFileRaw] = useState<File | null>(null);
  const [editRemoveExistingFile, setEditRemoveExistingFile] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isReadingEditFile, setIsReadingEditFile] = useState(false);

  const handleOpenEdit = (hw: AssignmentItem) => {
    setEditingHw(hw);
    setEditTitle(hw.title || '');
    setEditDueDate(hw.dueDate || '');
    setEditContent(hw.content || '');
    setEditSubject(hw.subject || currentClass?.subject || 'Văn hóa');
    setEditMaxScore(hw.maxScore || 10);
    setEditAttachedFile(hw.attachedFile || null);
    setEditAttachedFileUrl(hw.attachedFileUrl || null);
    setEditAttachedFileData(hw.attachedFile ? uploadedFilesCacheRef.current[hw.attachedFile]?.data || null : null);
    setEditAttachedFileType(hw.attachedFileType || 'other');
    setEditAttachedFileHtml(hw.attachedFileContentHtml || null);
    setEditAttachedFileRaw(null);
    setEditRemoveExistingFile(false);
    setIsEditModalOpen(true);
  };

  const handleEditFileUpload = async (file: File) => {
    setIsReadingEditFile(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isImgExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic'].includes(ext);
    const detectedType: 'pdf' | 'word' | 'image' | 'other' =
      ext === 'pdf' || file.type === 'application/pdf'
        ? 'pdf'
        : ext === 'docx' || ext === 'doc' || file.type.includes('word') || file.type.includes('officedocument')
        ? 'word'
        : isImgExt || file.type.startsWith('image/')
        ? 'image'
        : 'other';

    const objectUrl = URL.createObjectURL(file);
    try {
      const arrayBuffer = await file.arrayBuffer();
      let parsedHtml: string | null = null;
      let finalPreviewUrl = objectUrl;

      if (detectedType === 'word') {
        try {
          // @ts-ignore
          const mammothModule = await import('mammoth');
          const mammothInstance = (mammothModule as any).default || mammothModule;
          const result = await mammothInstance.convertToHtml({ arrayBuffer: arrayBuffer.slice(0) });
          parsedHtml = result.value;
        } catch (err) {
          console.warn('Lỗi phân tích file Word với mammoth:', err);
          parsedHtml = null;
        }
      } else if (detectedType === 'image') {
        try {
          finalPreviewUrl = await convertImageFileToDataUrl(file);
        } catch (imgErr) {
          finalPreviewUrl = objectUrl;
        }
      }

      uploadedFilesCacheRef.current[file.name] = {
        data: arrayBuffer,
        url: finalPreviewUrl,
        html: parsedHtml,
        type: detectedType,
      };

      setEditAttachedFileType(detectedType);
      setEditAttachedFileData(arrayBuffer);
      setEditAttachedFileUrl(finalPreviewUrl);
      setEditAttachedFileHtml(parsedHtml);
      setEditAttachedFile(file.name);
      setEditAttachedFileRaw(file);
      setEditRemoveExistingFile(false);
    } catch (err) {
      console.warn('Lỗi đọc dữ liệu tệp chỉnh sửa:', err);
      setEditAttachedFileType(detectedType);
      setEditAttachedFileUrl(objectUrl);
      setEditAttachedFile(file.name);
      setEditAttachedFileRaw(file);
      setEditRemoveExistingFile(false);
    } finally {
      setIsReadingEditFile(false);
    }
  };

  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHw || !editTitle.trim()) return;
    setIsSavingEdit(true);
    try {
      const targetCenter = activeCenterId || currentCenterId;
      let finalUploadedUrl = editAttachedFileUrl;
      let finalStoragePath = editingHw.storagePath || '';

      // Gỡ bỏ tệp hiện tại
      if (editRemoveExistingFile) {
        if (editingHw.storagePath) {
          await deleteFileFromStorage(editingHw.storagePath);
        }
        finalUploadedUrl = null;
        finalStoragePath = '';
      } 
      // Có tệp mới được tải lên
      else if (editAttachedFileRaw || (editAttachedFile && editAttachedFile !== editingHw.attachedFile)) {
        const fileToUpload = editAttachedFileRaw || (editAttachedFileData ? new Blob([editAttachedFileData]) : null);
        if (fileToUpload) {
          if (editingHw.storagePath) {
            await deleteFileFromStorage(editingHw.storagePath);
          }
          const uploadRes = await uploadAssignmentFileToStorage(
            targetCenter,
            currentTeacherUid,
            selectedClassId,
            fileToUpload,
            editAttachedFile || 'bai_tap'
          );
          if (uploadRes.downloadUrl) {
            finalUploadedUrl = uploadRes.downloadUrl;
            finalStoragePath = uploadRes.storagePath;
          }
        }
      }

      const updatedPayload: Partial<AssignmentItem> = {
        title: editTitle.trim(),
        dueDate: editDueDate || editingHw.dueDate,
        content: editContent,
        subject: editSubject || editingHw.subject,
        maxScore: editMaxScore || 10,
        attachedFile: editRemoveExistingFile ? '' : (editAttachedFile || ''),
        attachedFileUrl: editRemoveExistingFile ? null : finalUploadedUrl,
        attachedFileType: editRemoveExistingFile ? 'other' : editAttachedFileType,
        attachedFileContentHtml: editRemoveExistingFile ? null : editAttachedFileHtml,
        storagePath: editRemoveExistingFile ? '' : finalStoragePath,
      };

      await updateAssignment(targetCenter, editingHw.id, updatedPayload, 'teacher');
      showActionToast(`Đã lưu thay đổi bài tập "${editTitle}" và đồng bộ Firebase & Storage!`, 'success');
      setIsEditModalOpen(false);
      setEditingHw(null);
    } catch (err: any) {
      console.error('Lỗi lưu bài tập:', err);
      showActionToast(`Lỗi khi cập nhật bài tập: ${err.message}`, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // =========================================================================
  // TRƯỜNG HỢP 1: GIÁO VIÊN CHƯA ĐƯỢC ADMIN PHÂN CÔNG LỚP HỌC NÀO
  // =========================================================================
  if (assignedClasses.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in text-slate-800">
        {/* Header Profile Banner */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <AccountAvatar
              name={teacherDisplayName}
              role="teacher"
              size="xl"
              className="ring-3 ring-[#00A86B] shadow-xs shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-[#0B486B]">
                  {teacherDisplayName}
                </h1>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                  Chờ phân công lớp
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Chuyên môn: <strong className="text-slate-800">{teacher?.subject || currentUser?.subject || 'Bộ môn Văn hóa'}</strong> &bull; SĐT: {teacher?.phone || currentUser?.phone || 'Chưa cập nhật'}
              </p>
            </div>
          </div>
        </div>

        {/* REQUIRED ALERT UI BANNER */}
        <div className="rounded-3xl bg-amber-50/90 border-2 border-amber-300 p-8 text-center max-w-2xl mx-auto shadow-md space-y-4 my-8 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-amber-100 text-[#F39C12] border-2 border-amber-300 flex items-center justify-center mx-auto shadow-2xs">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-amber-950">
            Bạn chưa được phân công quản lý lớp học nào. Vui lòng liên hệ Admin.
          </h2>
          <p className="text-xs text-amber-800 leading-relaxed max-w-lg mx-auto font-medium">
            Hệ thống quản lý lớp học dựa trên phân công thực tế từ Ban Giám Đốc. Sau khi Admin chọn bạn làm giáo viên phụ trách trên danh mục Quản Lý Lớp Học, các chức năng <strong>Điểm danh &amp; Sĩ số</strong>, <strong>Giao bài tập</strong> và <strong>Chấm điểm</strong> sẽ tự động kích hoạt tại đây.
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center gap-2 bg-white border border-amber-300 text-amber-900 px-4 py-2 rounded-xl text-xs font-bold shadow-2xs">
              <Phone className="w-4 h-4 text-[#0072B5]" />
              Hotline Ban Giám Đốc Admin: 0988.123.456 &bull; admin@tthocgioi.edu.vn
            </span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TRƯỜNG HỢP 2: CÓ LỚP HỌC PHÂN CÔNG -> HIỂN THỊ MENU GIÁO VIÊN ĐẦY ĐỦ
  // =========================================================================
  return (
    <div className="space-y-5 animate-fade-in text-slate-800">
      {/* 1. Header Profile & Feature Navigation Tabs */}
      <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-r from-blue-50/70 via-white to-emerald-50/50 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <AccountAvatar
            name={teacherDisplayName}
            role="teacher"
            size="xl"
            className="ring-3 ring-[#00A86B] shadow-xs shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-[#0B486B]">
                {teacherDisplayName}
              </h1>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Cổng Giáo Viên Đứng Lớp
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Đang phụ trách: <strong className="text-[#0072B5]">{assignedClasses.length} lớp học</strong> &bull; Đang chọn: <strong>{currentClass?.name || 'Lớp học'}</strong> ({assignedStudents.length} HS)
            </p>
          </div>
        </div>

        {/* Feature Tab Navigation Buttons */}
        <div className="w-full sm:w-auto grid grid-cols-3 sm:flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/80 shadow-inner gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
              activeTab === 'attendance'
                ? 'bg-white text-[#00A86B] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardCheck className="w-4 h-4 text-[#00A86B] shrink-0" />
            <span className="hidden sm:inline">1. Điểm Danh &amp; Sĩ Số</span>
            <span className="sm:hidden text-[11px]">1. Điểm danh</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('homework')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
              activeTab === 'homework'
                ? 'bg-white text-[#0072B5] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookMarked className="w-4 h-4 text-[#0072B5] shrink-0" />
            <span className="hidden sm:inline">2. Giao Bài Tập</span>
            <span className="sm:hidden text-[11px]">2. Giao bài</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('grading')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
              activeTab === 'grading'
                ? 'bg-white text-[#F39C12] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="w-4 h-4 text-[#F39C12] shrink-0" />
            <span className="hidden sm:inline">3. Chấm Điểm &amp; Nhận Xét</span>
            <span className="sm:hidden text-[11px]">3. Chấm điểm</span>
          </button>
        </div>
      </div>

      {/* 2. CLASS, MONTH & DAY SELECTOR DROPDOWN BAR (KHUNG CHỌN ĐIỂM DANH CÓ DẠNG NHƯ HÌNH) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Selector 1: Chọn Lớp Được Phân Công (Xổ xuống từ Firebase) */}
          <div>
            <label className="block font-bold text-[#0B486B] mb-1.5 flex items-center gap-1.5">
              <School className="w-4 h-4 text-[#0072B5]" />
              Chọn Lớp Được Phân Công:
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50/80 p-2.5 font-extrabold text-slate-800 shadow-2xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0072B5]/20 focus:border-[#0072B5] transition-all cursor-pointer"
            >
              {assignedClasses.map((c) => {
                const count = getClassStudentCount(c);
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({count} HS)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Selector 2: Chọn Tháng Điểm Danh / Chọn Tháng */}
          <div>
            <label className="block font-bold text-[#0B486B] mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#00A86B]" />
              {activeTab === 'homework' ? 'Chọn Tháng:' : 'Chọn Tháng Điểm Danh:'}
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => {
                const newMonth = e.target.value;
                setSelectedMonth(newMonth);
                const [y, m] = newMonth.split('-');
                const prevDay = sessionDate.split('-')[2] || '01';
                const maxDays = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
                const safeDay = Math.min(parseInt(prevDay, 10), maxDays).toString().padStart(2, '0');
                setSessionDate(`${newMonth}-${safeDay}`);
              }}
              className="w-full rounded-xl border border-slate-300 bg-slate-50/80 p-2.5 font-bold text-slate-800 shadow-2xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#00A86B]/20 focus:border-[#00A86B] transition-all cursor-pointer"
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Selector 3: Chọn Ngày Điểm Danh / Ngày Giao */}
          <div>
            <label className="block font-bold mb-1.5 flex items-center justify-between text-xs">
              <span className={`flex items-center gap-1.5 ${activeTab !== 'homework' && isAttendanceUnsaved ? 'text-orange-700 font-extrabold' : 'text-[#0B486B]'}`}>
                <CalendarCheck className={`w-4 h-4 ${activeTab !== 'homework' && isAttendanceUnsaved ? 'text-orange-600' : 'text-[#0072B5]'}`} />
                {activeTab === 'homework' ? 'Ngày Giao:' : 'Chọn Ngày Điểm Danh:'}
              </span>
              {activeTab !== 'homework' && isAttendanceUnsaved && (
                <span className="text-[10px] font-extrabold text-orange-700 bg-orange-100 border border-orange-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                  Chưa lưu
                </span>
              )}
            </label>
            <select
              value={sessionDate}
              onChange={(e) => {
                setSessionDate(e.target.value);
                if (activeTab === 'homework') {
                  const d = new Date(e.target.value);
                  d.setDate(d.getDate() + 3);
                  setHwDueDate(d.toISOString().split('T')[0]);
                }
              }}
              className={`w-full rounded-xl p-2.5 font-bold shadow-2xs transition-all cursor-pointer focus:outline-hidden ${
                activeTab !== 'homework' && isAttendanceUnsaved
                  ? 'border-2 border-orange-500 bg-orange-50/90 text-orange-950 ring-2 ring-orange-400/30 focus:border-orange-600 focus:ring-orange-500/40'
                  : 'border border-slate-300 bg-slate-50/80 text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0072B5]/20 focus:border-[#0072B5]'
              }`}
            >
              {dayOptions.map((d) => (
                <option
                  key={d.value}
                  value={d.value}
                  className={activeTab !== 'homework' && !d.hasRecord ? 'text-orange-700 bg-orange-50 font-bold' : 'text-slate-800'}
                >
                  {activeTab === 'homework' ? d.label.split(' [')[0] : d.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading Spinner Indicator when Switching Classes */}
      {isClassLoading && (
        <div className="flex items-center justify-center p-8 bg-white/80 backdrop-blur-xs rounded-2xl border border-slate-200">
          <Loader2 className="w-6 h-6 text-[#0072B5] animate-spin mr-2" />
          <span className="text-xs font-bold text-slate-700">Đang tải dữ liệu thực tế từ Firebase Firestore...</span>
        </div>
      )}

      {/* Toast thông báo lưu thành công */}
      {showSavedToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-bold flex items-center justify-between animate-fade-in shadow-xs">
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#00A86B]" />
            ✓ Đã lưu và đồng bộ điểm danh ngày {sessionDate.split('-').reverse().join('/')} cho lớp {currentClass?.name} vào Firebase thành công!
          </span>
          <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200 font-semibold">
            Đồng bộ Firestore
          </span>
        </div>
      )}

      {/* Toast thông báo lỗi lưu thất bại */}
      {syncErrorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-rose-900 text-xs font-bold flex items-center justify-between animate-fade-in shadow-xs">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            Lỗi khi lưu điểm danh lên Firebase: {syncErrorMsg}
          </span>
          <span className="text-[11px] text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200 font-semibold">
            Vui lòng thử lại
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: KHUNG ĐIỂM DANH & SĨ SỐ (DỮ LIỆU THỰC TỪ FIREBASE)                */}
      {/* ========================================================================= */}
      {!isClassLoading && activeTab === 'attendance' && (
        <div className="space-y-4 animate-fade-in">
          {/* Sub-view switcher: [📅 1. Điểm danh theo ngày] vs [📊 2. Xem toàn bộ danh sách lớp theo tháng (Excel)] */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#0B486B] flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-[#0072B5]" />
                Chế độ xem:
              </span>
              <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setAttendanceViewMode('daily')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    attendanceViewMode === 'daily'
                      ? 'bg-white text-[#00A86B] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarCheck className="w-3.5 h-3.5 text-[#00A86B]" />
                  <span>Điểm Danh Theo Ngày</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAttendanceViewMode('monthly')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    attendanceViewMode === 'monthly'
                      ? 'bg-white text-[#0072B5] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Table className="w-3.5 h-3.5 text-[#0072B5]" />
                  <span>Xem Toàn Bộ Lớp Theo Tháng (Excel)</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {attendanceViewMode === 'daily' ? (
                <button
                  type="button"
                  onClick={() => setAttendanceViewMode('monthly')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-[#0072B5] border border-blue-200 shadow-2xs transition-all cursor-pointer"
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Bảng Tổng Hợp Cả Tháng ({selectedMonth.split('-').reverse().join('/')}) &rarr;</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAttendanceViewMode('daily')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-[#00A86B] border border-emerald-200 shadow-2xs transition-all cursor-pointer"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>&larr; Quay Lại Điểm Danh Theo Ngày</span>
                </button>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CHẾ ĐỘ 1: ĐIỂM DANH THEO TỪNG NGÀY CHI TIẾT                              */}
          {/* ========================================================================= */}
          {attendanceViewMode === 'daily' && (
            <div className="space-y-4 animate-fade-in">
              {/* KPI Header Bar & Thao Tác Điểm Danh */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#00A86B]"></span>
                    <span className="text-xs font-bold text-slate-700">
                      Có mặt: <strong className="text-emerald-700 text-sm">{presentCount}</strong>/{totalCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#E74C3C]"></span>
                    <span className="text-xs font-bold text-slate-700">
                      Vắng mặt: <strong className="text-rose-700 text-sm">{absentCount}</strong>
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-[#00A86B] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Tỷ lệ chuyên cần: {attendanceRate}%
                  </span>

                  {/* Chỉ báo trạng thái đồng bộ Firebase */}
                  {!isAttendanceUnsaved && existingRecord ? (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-3 py-1 rounded-full border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                      <CheckCircle className="w-3.5 h-3.5 text-[#00A86B]" />
                      Firebase: Đã lưu buổi học ({existingRecord.updatedAt ? new Date(existingRecord.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Hôm nay'})
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-orange-900 bg-orange-100 px-3 py-1 rounded-full border border-orange-300 flex items-center gap-1.5 shadow-2xs">
                      <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
                      {existingRecord ? 'Có thay đổi chưa lưu điểm danh' : 'Chưa lưu điểm danh ngày này trên Firebase'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleMarkAllPresent}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#00A86B] border border-emerald-300 px-3.5 py-2.5 text-xs font-bold transition-all shadow-2xs min-h-[42px] cursor-pointer"
                    title="Đánh dấu nhanh tất cả học sinh trong lớp có mặt"
                  >
                    <Zap className="w-4 h-4 text-[#00A86B]" />
                    <span>⚡ Tất Cả Có Mặt</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={handleSyncAttendanceToAdmin}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-2xs min-h-[42px] cursor-pointer disabled:opacity-50 ${
                      isAttendanceUnsaved
                        ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/30 ring-2 ring-orange-400/50'
                        : 'bg-[#00A86B] hover:bg-emerald-700 text-white'
                    }`}
                    title={isAttendanceUnsaved ? 'Có thay đổi điểm danh chưa lưu, bấm để lưu' : 'Điểm danh đã được lưu'}
                  >
                    {isSyncing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Lưu Điểm Danh</span>
                  </button>
                </div>
              </div>

              {/* Student Roster Table (Dữ liệu học sinh thực tế từ Firestore) */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <span className="font-extrabold text-xs text-[#0B486B]">
                    Danh Sách Học Sinh Điểm Danh &bull; {currentClass?.name || 'Lớp học'} ({assignedStudents.length} học sinh) &bull; Ngày: {sessionDate.split('-').reverse().join('/')}
                  </span>
                </div>

                {assignedStudents.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50/50">
                    <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">Chưa có học sinh nào trong lớp {currentClass?.name} trên cơ sở dữ liệu Firebase</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Vui lòng thêm học sinh hoặc xếp lớp cho học sinh trong mục Quản lý học sinh trên hệ thống.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {assignedStudents.map((st, index) => {
                      if (!st) return null;
                      const currentStatus = sessionStatuses[st.id] || 'present';
                      const isPresent = currentStatus === 'present';
                      const isAbsent = currentStatus === 'absent';

                      return (
                        <div key={st.id || index} className="p-4 hover:bg-slate-50/60 transition-colors">
                          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-[220px]">
                              <span className="text-xs font-bold text-slate-400 w-5">#{index + 1}</span>
                              <AccountAvatar
                                name={st?.name || 'Học sinh'}
                                role="student"
                                size="md"
                                className="ring-2 ring-slate-200 shadow-2xs shrink-0"
                              />
                              <div>
                                <div className="font-extrabold text-sm text-slate-800">{st?.name || 'Học sinh'}</div>
                                <div className="text-[11px] text-slate-500">
                                  PH: {st?.parentName || 'N/A'} &bull; SĐT: {st?.parentPhone || 'N/A'}
                                </div>
                              </div>
                            </div>

                            {/* Attendance Toggles: 2 nút Có mặt và Vắng mặt */}
                            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto shrink-0">
                              <button
                                type="button"
                                onClick={() => handleSetStudentStatus(st.id, 'present')}
                                className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-bold transition-all border min-h-[42px] cursor-pointer ${
                                  isPresent
                                    ? 'bg-[#00A86B] text-white border-[#00A86B] shadow-2xs ring-2 ring-emerald-200'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-[#00A86B] hover:text-[#00A86B]'
                                }`}
                              >
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span>Có mặt</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSetStudentStatus(st.id, 'absent')}
                                className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-bold transition-all border min-h-[42px] cursor-pointer ${
                                  isAbsent
                                    ? 'bg-[#E74C3C] text-white border-[#E74C3C] shadow-2xs ring-2 ring-rose-200'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-[#E74C3C] hover:text-[#E74C3C]'
                                }`}
                              >
                                <XCircle className="w-4 h-4 shrink-0" />
                                <span>Vắng mặt</span>
                              </button>
                            </div>

                            {/* Remark input (không còn gợi ý nhận xét) */}
                            <div className="flex-1 w-full lg:max-w-md">
                              <input
                                type="text"
                                value={sessionRemarks[st.id] || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSessionRemarks((prev) => ({ ...prev, [st.id]: val }));
                                  if (onUpdateStudentRemark) onUpdateStudentRemark(st.id, val);
                                }}
                                placeholder="Nhận xét cá nhân (VD: Tiếp thu tốt, Hăng hái phát biểu...)"
                                className="w-full rounded-xl border border-slate-300 bg-slate-50/60 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Ghi chú chung buổi học */}
                {assignedStudents.length > 0 && (
                  <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#0072B5]" />
                      Ghi chú &amp; Nhận xét chung của buổi học:
                    </label>
                    <textarea
                      rows={2}
                      value={generalRemark}
                      onChange={(e) => setGeneralRemark(e.target.value)}
                      placeholder="Ghi chú chung tình hình học tập của cả lớp gửi Admin và lưu sổ (VD: Lớp chăm chú nghe giảng, hoàn thành tốt bài kiểm tra 15 phút...)"
                      className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-100 shadow-2xs"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CHẾ ĐỘ 2: BẢNG ĐIỂM DANH & HỌC PHÍ TOÀN BỘ DANH SÁCH LỚP THEO THÁNG       */}
          {/* ========================================================================= */}
          {attendanceViewMode === 'monthly' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 overflow-hidden animate-fade-in">
              {/* Header: Tiêu đề tháng + Đơn giá + Nút xuất Excel + In */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-100">
                <div>
                  <div className="text-base font-black text-[#0B486B] uppercase tracking-wide flex items-center gap-2">
                    <Table className="w-5 h-5 text-[#0072B5]" />
                    <span>{showFinancials ? 'BẢNG ĐIỂM DANH VÀ HỌC PHÍ' : 'BẢNG ĐIỂM DANH'} THÁNG {selectedMonth.split('-')[1]}/{selectedMonth.split('-')[0]}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Lớp: <strong className="text-slate-800">{currentClass?.name}</strong> &bull; Sĩ số: <strong className="text-[#0072B5]">{assignedStudents.length} HS</strong> &bull; Đã lưu điểm danh trên Firebase: <strong className="text-emerald-700">{monthlyRecords.length} buổi</strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Cài đặt Đơn giá / buổi học để tính cột Tổng tiền - ẨN ĐỐI VỚI GIÁO VIÊN, CHỈ HIỂN THỊ VỚI CENTER_ADMIN */}
                  {showFinancials && (
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700">
                      <span className="text-slate-600">Đơn giá/buổi:</span>
                      <input
                        type="number"
                        step="5000"
                        min="0"
                        value={pricePerSession}
                        onChange={(e) => setPricePerSession(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-xs font-black text-[#0072B5] text-right focus:outline-hidden focus:ring-1 focus:ring-blue-300"
                      />
                      <span className="text-[11px] text-slate-500 font-semibold">đ</span>
                    </div>
                  )}

                  {/* Nút Xuất File Excel (CSV) */}
                  <button
                    type="button"
                    onClick={handleExportMonthlyCsv}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-[#00A86B] border border-emerald-300 shadow-2xs transition-all cursor-pointer"
                    title="Xuất bảng điểm danh tháng sang file Excel"
                  >
                    <Download className="w-4 h-4 text-[#00A86B]" />
                    <span>Xuất File Excel</span>
                  </button>

                  {/* Nút In Bảng */}
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-2xs transition-all cursor-pointer"
                    title="In bảng điểm danh tháng"
                  >
                    <Printer className="w-4 h-4 text-slate-600" />
                    <span>In Bảng</span>
                  </button>
                </div>
              </div>

              {/* Matrix Table: TT | TÊN HỌC SINH | SĐT PH | 1..31 | Tổng buổi | Tổng tiền */}
              {assignedStudents.length === 0 ? (
                <div className="p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Chưa có học sinh nào trong lớp {currentClass?.name} trên cơ sở dữ liệu Firebase</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Vui lòng thêm hoặc xếp lớp cho học sinh trên hệ thống Admin để hiển thị bảng điểm danh.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="sm:hidden flex items-center justify-between text-[11px] text-[#0072B5] bg-blue-50/80 px-3 py-1.5 rounded-lg border border-blue-200">
                    <span>💡 <strong>Mẹo di động:</strong> Vuốt ngang để xem đủ 31 ngày</span>
                    <span>&rarr;</span>
                  </div>
                  <div className="overflow-x-auto border border-slate-300/80 rounded-xl shadow-2xs">
                    <table className="w-full text-center text-xs border-collapse">
                      <thead>
                        {/* Tiêu đề THÁNG như hình ảnh mẫu */}
                        <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-black">
                          <th colSpan={3 + daysInMonthList.length + (showFinancials ? 2 : 1)} className="py-2.5 px-4 text-center text-sm font-black tracking-wider text-[#0B486B]">
                            THÁNG {selectedMonth.split('-')[1]}/{selectedMonth.split('-')[0]}
                          </th>
                        </tr>
                        {/* Dòng Tiêu Đề Cột: TT | TÊN HỌC SINH | SĐT PH | 1..31 | Tổng buổi | (Tổng tiền: chỉ center_admin) */}
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
                          const iso = `${selectedMonth}-${dStr}`;
                          const isRecorded = monthlyRecords.some((r) => r.date === iso);
                          return (
                            <th
                              key={d}
                              className={`py-2 px-1 w-8 min-w-[32px] text-center font-extrabold ${
                                isRecorded ? 'bg-blue-50/80 text-[#0072B5]' : 'text-slate-700'
                              }`}
                              title={`Ngày ${dStr}/${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}${isRecorded ? ' - Đã lưu điểm danh trên Firebase' : ''}`}
                            >
                              {d}
                            </th>
                          );
                        })}
                        <th className="py-2.5 px-2 min-w-[80px] text-center bg-blue-50/60 text-[#0072B5]">
                          Tổng buổi
                        </th>
                        {showFinancials && (
                          <th className="py-2.5 px-3 min-w-[110px] text-right bg-emerald-50/70 text-emerald-900 font-black">
                            Tổng tiền
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 font-medium text-slate-800">
                      {assignedStudents.map((st, idx) => {
                        if (!st) return null;
                        // Tính toán số buổi có mặt của học sinh trong tháng từ Firebase
                        let attendedCount = 0;

                        return (
                          <tr key={st.id || idx} className="hover:bg-slate-50/80 transition-colors divide-x divide-slate-300">
                            {/* TT */}
                            <td className="py-2 px-2 sm:sticky sm:left-0 bg-white z-10 font-bold text-slate-600">
                              {idx + 1}
                            </td>

                            {/* TÊN HỌC SINH */}
                            <td className="py-2 px-3 text-left sm:sticky sm:left-10 bg-white z-10 shadow-xs font-bold text-slate-800">
                              <div className="truncate max-w-[150px] sm:max-w-[170px]" title={st.name}>
                                {st.name}
                              </div>
                            </td>

                            {/* SĐT PH */}
                            <td className="py-2 px-2 text-left sm:sticky sm:left-[210px] bg-white z-10 shadow-xs text-slate-600 text-[11px]">
                              {st.parentPhone || '—'}
                            </td>

                            {/* Các cột ngày từ 1 đến 31 (chuẩn theo hình ảnh) */}
                            {daysInMonthList.map((d) => {
                              const dStr = d.toString().padStart(2, '0');
                              const iso = `${selectedMonth}-${dStr}`;
                              const rec = monthlyRecords.find((r) => r.date === iso);
                              const sRec = rec?.records?.find((r: any) => r.studentId === st.id);

                              let marker = '';
                              let markerClass = '';
                              let titleText = `Ngày ${dStr}: Chưa có dữ liệu`;

                              if (sRec) {
                                if (sRec.status === 'present') {
                                  attendedCount++;
                                  marker = 'X';
                                  markerClass = 'font-black text-[#0B486B] text-xs';
                                  titleText = `Ngày ${dStr}: Có mặt`;
                                } else if (sRec.status === 'excused') {
                                  marker = 'P';
                                  markerClass = 'font-bold text-[#F39C12] text-[11px]';
                                  titleText = `Ngày ${dStr}: Vắng có phép`;
                                } else if (sRec.status === 'unexcused') {
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

                            {/* Tổng tiền - Ẩn đối với tài khoản Giáo viên, chỉ hiển thị đối với center_admin */}
                            {showFinancials && (
                              <td className="py-2 px-3 text-right font-black text-emerald-800 bg-emerald-50/20">
                                {(attendedCount * pricePerSession).toLocaleString('vi-VN')}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Hàng Tổng cộng lớp */}
                    <tfoot>
                      <tr className="bg-slate-100 font-extrabold text-slate-800 border-t-2 border-slate-300 divide-x divide-slate-300">
                        <td colSpan={2} className="py-2.5 px-3 text-left sticky left-0 bg-slate-100 z-20 font-black text-[#0B486B]">
                          TỔNG CỘNG LỚP
                        </td>
                        <td className="py-2.5 px-2 text-left sticky left-[210px] bg-slate-100 z-20 text-[11px] text-slate-600 font-bold">
                          {assignedStudents.length} HS
                        </td>
                        {daysInMonthList.map((d) => {
                          const dStr = d.toString().padStart(2, '0');
                          const iso = `${selectedMonth}-${dStr}`;
                          const rec = monthlyRecords.find((r) => r.date === iso);
                          const presentCountForDay = (rec?.records || []).filter((r: any) => r.status === 'present').length;
                          return (
                            <td key={d} className="py-2 px-1 text-center text-[11px] font-black text-[#0B486B]">
                              {presentCountForDay > 0 ? presentCountForDay : '—'}
                            </td>
                          );
                        })}
                        {/* Tổng số lượt có mặt cả lớp */}
                        <td className="py-2.5 px-2 text-center font-black text-[#0072B5] bg-blue-100/50">
                          {assignedStudents.reduce((acc, st) => {
                            const count = daysInMonthList.reduce((sAcc, d) => {
                              const dStr = d.toString().padStart(2, '0');
                              const iso = `${selectedMonth}-${dStr}`;
                              const rec = monthlyRecords.find((r) => r.date === iso);
                              const sRec = rec?.records?.find((r: any) => r.studentId === st.id);
                              return sRec?.status === 'present' ? sAcc + 1 : sAcc;
                            }, 0);
                            return acc + count;
                          }, 0)}
                        </td>
                        {/* Tổng tiền học phí cả lớp - Ẩn đối với giáo viên, chỉ hiển thị đối với center_admin */}
                        {showFinancials && (
                          <td className="py-2.5 px-3 text-right font-black text-emerald-800 bg-emerald-100/60 text-sm">
                            {assignedStudents
                              .reduce((acc, st) => {
                                const count = daysInMonthList.reduce((sAcc, d) => {
                                  const dStr = d.toString().padStart(2, '0');
                                  const iso = `${selectedMonth}-${dStr}`;
                                  const rec = monthlyRecords.find((r) => r.date === iso);
                                  const sRec = rec?.records?.find((r: any) => r.studentId === st.id);
                                  return sRec?.status === 'present' ? sAcc + 1 : sAcc;
                                }, 0);
                                return acc + count * pricePerSession;
                              }, 0)
                              .toLocaleString('vi-VN')}
                          </td>
                        )}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

              {/* Chú thích bảng điểm danh & học phí */}
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
                {/* Công thức tính Tổng tiền - Ẩn đối với giáo viên, chỉ hiển thị đối với center_admin */}
                {showFinancials && (
                  <div className="text-slate-500 font-medium">
                    Công thức: <strong>Tổng tiền = Tổng buổi có mặt &times; Đơn giá ({pricePerSession.toLocaleString('vi-VN')} đ/buổi)</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GIAO BÀI TẬP (Gắn kèm classId: selectedClassId & teacherId)         */}
      {/* ========================================================================= */}
      {!isClassLoading && activeTab === 'homework' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in">
          {/* Form Create Homework */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#0B486B] flex items-center gap-2">
                  <BookMarked className="w-4 h-4 text-[#0072B5]" />
                  Giao Bài Tập Về Nhà Mới
                </h3>
                <span className="text-[11px] font-bold text-[#0072B5] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                  {currentClass?.name || 'Lớp học'}
                </span>
              </div>

              <form onSubmit={handleCreateHomeworkSubmit} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tên / Tiêu đề bài tập</label>
                  <input
                    type="text"
                    required
                    value={hwTitle}
                    onChange={(e) => setHwTitle(e.target.value)}
                    placeholder="VD: Phiếu bài tập tuần 5 - Phương trình bậc nhất"
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Hạn nộp bài</label>
                    <input
                      type="date"
                      required
                      value={hwDueDate}
                      onChange={(e) => setHwDueDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-800 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Thang điểm</label>
                    <input
                      type="text"
                      disabled
                      value="10 Điểm"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-600 text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nội dung hướng dẫn &amp; dặn dò</label>
                  <textarea
                    rows={3}
                    value={hwContent}
                    onChange={(e) => setHwContent(e.target.value)}
                    placeholder="Mô tả các dạng bài tập, quy cách nộp bài..."
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-hidden"
                  />
                </div>

                {/* File & Photo Attachment */}
                <div
                  onPaste={(e) => {
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    for (let i = 0; i < items.length; i++) {
                      if (items[i].type.startsWith('image/')) {
                        const pastedFile = items[i].getAsFile();
                        if (pastedFile) {
                          const now = new Date();
                          const namedFile = new File(
                            [pastedFile],
                            `Anh_dan_bai_tap_${now.getHours()}${now.getMinutes()}${now.getSeconds()}.png`,
                            { type: pastedFile.type }
                          );
                          handleFileUpload(namedFile);
                          break;
                        }
                      }
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-700">
                      Đính kèm Bài tập (Ảnh chụp bài tập, Word .docx, PDF)
                    </label>
                    {hwAttachedFile && (
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                        hwAttachedFileType === 'pdf' ? 'bg-rose-100 text-rose-800' :
                        hwAttachedFileType === 'word' ? 'bg-blue-100 text-[#0072B5]' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {hwAttachedFileType === 'pdf' ? 'PDF File' : hwAttachedFileType === 'word' ? 'Word (.docx)' : 'Ảnh chụp bài tập'}
                      </span>
                    )}
                  </div>

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(true);
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFileUpload(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`rounded-xl border-2 border-dashed p-3 transition-all ${
                      isDraggingFile
                        ? 'border-[#0072B5] bg-blue-50/70'
                        : 'border-slate-300 bg-slate-50/90'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate text-slate-600 min-w-0">
                        {hwAttachedFileType === 'image' && hwAttachedFile ? (
                          <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate font-semibold text-xs text-slate-800" title={hwAttachedFile || ''}>
                          {hwAttachedFile || 'Chưa chọn tệp (Hỗ trợ tải ảnh chụp, chụp trực tiếp, dán Ctrl+V, hoặc file Word/PDF)'}
                        </span>
                      </div>

                      {hwAttachedFile && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewDoc({
                                fileName: hwAttachedFile,
                                fileUrl: hwAttachedFileUrl,
                                fileData: hwAttachedFileData,
                                fileType: hwAttachedFileType,
                                htmlContent: hwAttachedFileHtml,
                                assignmentTitle: hwTitle || 'Bài tập mới',
                                subject: currentClass?.subject || 'Văn hóa',
                                className: currentClass?.name || 'Lớp học',
                                teacherName: teacherDisplayName,
                                dueDate: hwDueDate || sessionDate,
                                assignmentContent: hwContent,
                              });
                              setIsPreviewOpen(true);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#0072B5] bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all cursor-pointer"
                            title="Xem trước bài tập"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem trước</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHwAttachedFile(null);
                              setHwAttachedFileUrl(null);
                              setHwAttachedFileData(null);
                              setHwAttachedFileHtml(null);
                            }}
                            className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Xóa tệp đính kèm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Các nút chọn tải ảnh chụp / chụp ảnh camera / tải file Word-PDF */}
                    <div className="flex flex-wrap items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-200/80">
                      {/* 1. Nút Tải Ảnh Chụp Bài Tập */}
                      <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50/90 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs transition-all">
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{hwAttachedFile ? 'Đổi ảnh chụp' : 'Tải ảnh chụp bài tập'}</span>
                        <input
                          type="file"
                          accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.heic"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(e.target.files[0]);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>

                      {/* 2. Nút Chụp Ảnh Trực Tiếp Bằng Camera */}
                      <button
                        type="button"
                        onClick={handleOpenCameraModal}
                        className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs transition-all"
                        title="Sử dụng Camera máy tính hoặc điện thoại để chụp ảnh đề bài tập"
                      >
                        <Camera className="w-3.5 h-3.5 text-amber-600" />
                        <span>Chụp ảnh trực tiếp</span>
                      </button>

                      {/* 3. Nút Tải File Word / PDF */}
                      <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold text-[#0072B5] hover:text-[#0B486B] bg-white hover:bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 shadow-2xs transition-all">
                        <Upload className="w-3.5 h-3.5 text-[#0072B5]" />
                        <span>{hwAttachedFile ? 'Đổi file Word / PDF' : 'Tải file Word / PDF'}</span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,image/*,.png,.jpg,.jpeg,.webp"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(e.target.files[0]);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  {isReadingFile && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[#0072B5] mt-1.5 font-semibold">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang xử lý tệp / ảnh chụp để tạo bản xem trước...</span>
                    </div>
                  )}
                </div>

                {/* TRÌNH XEM TRƯỚC FILE & ẢNH CHỤP TRỰC TIẾP TRÊN TRANG (LIVE ON-PAGE PREVIEW) */}
                {hwAttachedFile && (
                  <div className="rounded-2xl border-2 border-[#0072B5]/30 bg-white p-3.5 shadow-sm space-y-2.5 animate-fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                          hwAttachedFileType === 'pdf' ? 'bg-rose-100 text-rose-700' :
                          hwAttachedFileType === 'word' ? 'bg-blue-100 text-[#0072B5]' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {hwAttachedFileType === 'pdf' ? 'PDF' : hwAttachedFileType === 'word' ? 'DOCX' : 'ẢNH CHỤP'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-800 truncate" title={hwAttachedFile}>
                            Trình xem trước: <span className="text-[#0072B5]">{hwAttachedFile}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {hwAttachedFileType === 'image' && hwAttachedFileUrl && (
                          <button
                            type="button"
                            onClick={handleRotateAttachedImage}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
                            title="Xoay ảnh chụp 90 độ"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Xoay ảnh</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setPreviewDoc({
                              fileName: hwAttachedFile,
                              fileUrl: hwAttachedFileUrl,
                              fileData: hwAttachedFileData,
                              fileType: hwAttachedFileType,
                              htmlContent: hwAttachedFileHtml,
                              assignmentTitle: hwTitle || 'Bài tập mới',
                              subject: currentClass?.subject || 'Văn hóa',
                              className: currentClass?.name || 'Lớp học',
                              teacherName: teacherDisplayName,
                              dueDate: hwDueDate || sessionDate,
                              assignmentContent: hwContent,
                            });
                            setIsPreviewOpen(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#0072B5] hover:bg-[#0B486B] transition-all shadow-2xs cursor-pointer shrink-0 whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span>Mở Toàn Màn Hình</span>
                        </button>
                      </div>
                    </div>

                    {/* Hiển thị nội dung tệp trực tiếp theo từng định dạng */}
                    {hwAttachedFileType === 'pdf' && (
                      <div className="w-full bg-slate-100 rounded-xl p-1 border border-slate-200">
                        {(hwAttachedFileData || hwAttachedFileUrl) ? (
                          <Suspense fallback={<div className="p-6 text-center text-xs text-slate-500 font-bold">Đang tải trình đọc PDF...</div>}>
                            <PdfViewer
                              fileUrl={hwAttachedFileUrl}
                              fileData={hwAttachedFileData}
                              fileName={hwAttachedFile || 'Tai_lieu.pdf'}
                              inlineMode={true}
                              className="h-[420px]"
                            />
                          </Suspense>
                        ) : (
                          <div className="p-6 text-center text-xs text-slate-500 font-bold">Đang tải tài liệu PDF...</div>
                        )}
                      </div>
                    )}

                    {hwAttachedFileType === 'word' && (
                      <div className="w-full max-h-[380px] overflow-auto bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div className="bg-white p-4 rounded-lg shadow-2xs border border-slate-200 text-xs text-slate-800 space-y-2">
                          {hwAttachedFileHtml ? (
                            <div
                              className="prose prose-xs max-w-none text-xs leading-relaxed text-slate-800"
                              dangerouslySetInnerHTML={{ __html: hwAttachedFileHtml }}
                            />
                          ) : (
                            <div className="p-4 text-center text-slate-500 text-xs">
                              Không thể phân tích nội dung trực tiếp cho định dạng tệp này. Nhấn &ldquo;Mở Toàn Màn Hình&rdquo; hoặc tải về để xem.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {hwAttachedFileType === 'image' && hwAttachedFileUrl && (
                      <div className="w-full flex flex-col items-center justify-center bg-slate-100/90 rounded-xl p-3 border border-slate-200 space-y-2">
                        <div
                          onClick={() => {
                            setPreviewDoc({
                              fileName: hwAttachedFile,
                              fileUrl: hwAttachedFileUrl,
                              fileData: hwAttachedFileData,
                              fileType: 'image',
                              htmlContent: null,
                              assignmentTitle: hwTitle || 'Bài tập mới',
                              subject: currentClass?.subject || 'Văn hóa',
                              className: currentClass?.name || 'Lớp học',
                              teacherName: teacherDisplayName,
                              dueDate: hwDueDate || sessionDate,
                              assignmentContent: hwContent,
                            });
                            setIsPreviewOpen(true);
                          }}
                          className="relative group cursor-pointer bg-white p-2 rounded-xl shadow-xs border border-slate-200 max-w-full flex items-center justify-center overflow-hidden"
                          title="Nhấn vào ảnh để phóng to toàn màn hình"
                        >
                          <img
                            src={hwAttachedFileUrl}
                            alt={hwAttachedFile}
                            className="max-h-[360px] w-auto object-contain rounded-lg transition-transform duration-200 group-hover:scale-[1.01]"
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium text-center">
                          Nhấn trực tiếp vào ảnh chụp hoặc chọn <strong>&ldquo;Mở Toàn Màn Hình&rdquo;</strong> để phóng to / xoay / in ảnh bài tập.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isAssigning}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white py-2.5 font-bold transition-all shadow-xs mt-2 disabled:opacity-50 cursor-pointer"
                >
                  {isAssigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tạo bài tập...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Giao Bài Tập Cho Lớp {currentClass?.name} ({assignedStudents.length} HS)</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right List: Homeworks Created for selectedClassId */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3.5">
              {/* Header Bar */}
              <div className="pb-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0072B5] flex items-center justify-center font-bold">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#0B486B]">
                      Bài Tập Đã Giao Cho Lớp {currentClass?.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Hỗ trợ chọn nhiều bài để xóa, chỉnh sửa nội dung hoặc giao lại cho học sinh
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {assignedHomeworks.length > 0 && (
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-xl cursor-pointer select-none transition-all">
                      <input
                        type="checkbox"
                        checked={selectedHwIds.length === assignedHomeworks.length && assignedHomeworks.length > 0}
                        onChange={handleToggleSelectAllHw}
                        className="w-4 h-4 rounded text-[#0072B5] focus:ring-[#0072B5] cursor-pointer"
                      />
                      <span>Chọn tất cả</span>
                    </label>
                  )}
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                    Tổng: <strong>{assignedHomeworks.length}</strong> bài tập
                  </span>
                </div>
              </div>

              {/* Bulk Actions Toolbar (Hiển thị khi có bài tập được chọn) */}
              {selectedHwIds.length > 0 && (
                <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-2.5 animate-fade-in shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-[#0072B5] text-white text-xs font-black">
                      {selectedHwIds.length}
                    </span>
                    <span className="text-xs font-bold text-[#0B486B]">
                      Đang chọn <strong>{selectedHwIds.length}</strong> bài tập
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Giao lại các bài đã chọn */}
                    <button
                      type="button"
                      onClick={handleOpenReassignSelected}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#0072B5] hover:bg-[#0B486B] transition-all shadow-2xs cursor-pointer"
                      title="Giao lại các bài tập đã chọn cho học sinh"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Giao lại ({selectedHwIds.length})</span>
                    </button>

                    {/* Chỉnh sửa (khi chọn đúng 1 bài) */}
                    {selectedHwIds.length === 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = assignedHomeworks.find((h) => h.id === selectedHwIds[0]);
                          if (target) handleOpenEdit(target);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 transition-all shadow-2xs cursor-pointer"
                        title="Chỉnh sửa bài tập đang chọn"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#0072B5]" />
                        <span>Chỉnh sửa</span>
                      </button>
                    )}

                    {/* Xóa các bài đã chọn */}
                    <button
                      type="button"
                      onClick={handleOpenDeleteSelected}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all shadow-2xs cursor-pointer"
                      title="Xóa các bài tập đã chọn khỏi hệ thống & Storage"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Xóa ({selectedHwIds.length})</span>
                    </button>

                    {/* Bỏ chọn */}
                    <button
                      type="button"
                      onClick={() => setSelectedHwIds([])}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
                      title="Bỏ chọn"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Danh sách bài tập - Hiển thị dạng bảng ngắn gọn, khoa học */}
              {assignedHomeworks.length === 0 ? (
                <div className="p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <BookMarked className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Chưa có bài tập nào được giao cho lớp này</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Sử dụng biểu mẫu bên trái để giao bài tập kèm ảnh chụp, file Word hoặc PDF lên hệ thống.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                        <th className="py-2.5 px-3 w-16 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={selectedHwIds.length === assignedHomeworks.length && assignedHomeworks.length > 0}
                              onChange={handleToggleSelectAllHw}
                              className="w-3.5 h-3.5 rounded text-[#0072B5] focus:ring-[#0072B5] cursor-pointer"
                              title="Chọn tất cả"
                            />
                            <span>STT</span>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Ngày giao</th>
                        <th className="py-2.5 px-3 min-w-[140px]">Tên bài tập</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Hạn nộp</th>
                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Bài nộp</th>
                        <th className="py-2.5 px-2 text-center w-12 whitespace-nowrap" title="Xem trước bài tập">Xem</th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assignedHomeworks.map((hw, index) => {
                        const isSelected = selectedHwIds.includes(hw.id);
                        const cached = hw.attachedFile ? uploadedFilesCacheRef.current[hw.attachedFile] : undefined;
                        const ext = (hw.attachedFile || '').split('.').pop()?.toLowerCase();
                        const previewUrl = cached?.url || hw.attachedFileUrl || null;
                        const isPdf = hw.attachedFileType === 'pdf' || ext === 'pdf';
                        const isWord = hw.attachedFileType === 'word' || ext === 'docx' || ext === 'doc';
                        const isImage =
                          hw.attachedFileType === 'image' ||
                          /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(hw.attachedFile || '') ||
                          Boolean(previewUrl && previewUrl.startsWith('data:image/'));

                        // Ngày giao & Hạn nộp
                        const assignedDateStr = formatDisplayDate(hw.assignedDate, hw.id);
                        const dueDateStr = formatDueDate(hw.dueDate);
                        const submissionsCount = hw.submissions?.length || 0;

                        return (
                          <tr
                            key={hw.id}
                            className={`transition-colors hover:bg-slate-50/70 ${
                              isSelected ? 'bg-blue-50/40' : ''
                            }`}
                          >
                            {/* 1. STT & Checkbox */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectHw(hw.id)}
                                  className="w-3.5 h-3.5 rounded text-[#0072B5] focus:ring-[#0072B5] cursor-pointer"
                                  title={`Chọn bài tập ${hw.title}`}
                                />
                                <span className="font-bold text-slate-700 text-xs">{index + 1}</span>
                              </div>
                            </td>

                            {/* 2. Ngày giao */}
                            <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-600">
                              {assignedDateStr}
                            </td>

                            {/* 3. Tên bài tập */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-slate-800 text-xs" title={hw.title}>
                                  {hw.title}
                                </span>
                                {hw.attachedFile && (
                                  <span className={`px-1.5 py-0.2 rounded font-mono font-bold text-[9px] uppercase shrink-0 ${
                                    isPdf ? 'bg-rose-100 text-rose-700' :
                                    isWord ? 'bg-blue-100 text-[#0072B5]' :
                                    isImage ? 'bg-emerald-100 text-emerald-700' :
                                    'bg-slate-100 text-slate-600'
                                  }`} title={hw.attachedFile}>
                                    {isPdf ? 'PDF' : isWord ? 'DOCX' : isImage ? 'ẢNH' : 'FILE'}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 4. Hạn nộp */}
                            <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-700">
                              {dueDateStr}
                            </td>

                            {/* 5. Bài nộp */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedHwForSubmissions(hw);
                                  setIsSubmissionsModalOpen(true);
                                }}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                                  submissionsCount > 0
                                    ? 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                                    : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                                }`}
                                title="Xem danh sách bài nộp của học sinh"
                              >
                                <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Bài nộp ({submissionsCount})</span>
                              </button>
                            </td>

                            {/* 6. Xem trước - CHỈ HIỂN THỊ BIỂU TƯỢNG MẮT */}
                            <td className="py-2.5 px-2 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenPreviewForHw(hw)}
                                className={`p-1.5 rounded-lg transition-all shadow-2xs cursor-pointer inline-flex items-center justify-center ${
                                  isImage
                                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                                    : isPdf
                                    ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                                    : isWord
                                    ? 'text-[#0072B5] bg-blue-50 hover:bg-blue-100 border border-blue-200'
                                    : 'text-[#0072B5] bg-blue-50 hover:bg-blue-100 border border-blue-200'
                                }`}
                                title={`Xem trước: ${hw.title}`}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>

                            {/* 7. Thao tác (Giao lại, Chỉnh sửa, Xóa) */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1 justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleOpenReassignSingle(hw)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#0072B5] hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all cursor-pointer"
                                  title="Giao lại bài tập này cho học sinh"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(hw)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#0072B5] hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all cursor-pointer"
                                  title="Chỉnh sửa bài tập"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDeleteSingle(hw)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                                  title="Xóa bài tập này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CHẤM ĐIỂM & NHẬN XÉT (Chỉ tải bài tập và học sinh thuộc selectedClass) */}
      {/* ========================================================================= */}
      {!isClassLoading && activeTab === 'grading' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 animate-fade-in">
          {/* Header Bar */}
          <div className="pb-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-[#0B486B] flex items-center gap-2">
                <Award className="w-4 h-4 text-[#F39C12]" />
                Bảng Chấm Điểm &amp; Nhận Xét Bài Tập Trực Tiếp
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhập điểm số và lời phê chi tiết cho từng học sinh thuộc lớp <strong>{currentClass?.name}</strong>
              </p>
            </div>

            {/* Assignment Dropdown Selector */}
            {assignedHomeworks.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Chọn bài tập:</span>
                <select
                  value={selectedHomeworkId}
                  onChange={(e) => setSelectedHomeworkId(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs focus:bg-white focus:outline-hidden cursor-pointer"
                >
                  {assignedHomeworks.map((hw) => (
                    <option key={hw.id} value={hw.id}>
                      {hw.title} (Hạn: {hw.dueDate})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Student Grading Table */}
          {assignedStudents.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">Chưa có danh sách học sinh để chấm điểm</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Lớp {currentClass?.name} chưa có học sinh nào.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold">
                    <th className="py-2.5 px-3">Học Sinh</th>
                    <th className="py-2.5 px-2 text-center">Tình Trạng</th>
                    <th className="py-2.5 px-2 text-center w-28">Điểm Số (10)</th>
                    <th className="py-2.5 px-3">Lời Phê Của Giáo Viên</th>
                    <th className="py-2.5 px-3 text-right">Lưu Điểm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {assignedStudents.map((st) => {
                    if (!st) return null;
                    const scoreVal = gradingScores[st.id] ?? 8.0;
                    const commentVal = gradingComments[st.id] ?? '';

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <AccountAvatar
                              name={st?.name || 'Học sinh'}
                              role="student"
                              size="sm"
                              className="ring-1 ring-slate-200 shrink-0"
                            />
                            <div>
                              <div className="font-extrabold text-slate-800">{st?.name || 'Học sinh'}</div>
                              <div className="text-[10px] text-slate-400">{st?.className || 'Lớp'}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-2 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#00A86B] border border-emerald-200">
                            Đã nộp bài
                          </span>
                        </td>

                        <td className="py-3 px-2 text-center">
                          <div className="inline-flex items-center justify-center gap-1">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="10"
                              value={scoreVal}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setGradingScores((prev) => ({ ...prev, [st.id]: val }));
                              }}
                              className="w-14 rounded-lg border border-slate-300 p-1 text-center font-black text-[#00A86B] focus:border-[#0072B5] focus:outline-hidden"
                            />
                            <span className="text-[11px] text-slate-400 font-bold">/10</span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={commentVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGradingComments((prev) => ({ ...prev, [st.id]: val }));
                            }}
                            placeholder="Nhập lời phê chi tiết..."
                            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-1.5 text-xs text-slate-700 focus:bg-white focus:outline-hidden"
                          />
                        </td>

                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            disabled={gradingLoadingId === st.id}
                            onClick={() => handleSaveGradeSingle(st.id, st.name)}
                            className="rounded-lg bg-[#0072B5] hover:bg-[#0B486B] text-white px-3 py-1.5 text-xs font-bold transition-all shadow-2xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                          >
                            {gradingLoadingId === st.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Lưu</span>}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Số lượng học sinh chấm điểm: <strong>{assignedStudents.length}</strong> học sinh
            </span>
            <button
              type="button"
              onClick={() => {
                assignedStudents.forEach((st) => {
                  if (st?.id) handleSaveGradeSingle(st.id, st.name);
                });
              }}
              className="flex items-center gap-1.5 rounded-xl bg-[#00A86B] hover:bg-emerald-700 text-white px-4 py-2 font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Lưu Sổ Điểm &amp; Gửi Về App Phụ Huynh</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL CHỤP ẢNH BÀI TẬP TRỰC TIẾP TỪ CAMERA */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 animate-fade-in">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-extrabold">Chụp Ảnh Bài Tập Trực Tiếp</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseCameraModal}
                className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 flex flex-col items-center justify-center min-h-[320px] relative">
              {cameraError ? (
                <div className="text-center p-6 space-y-3 max-w-md">
                  <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">{cameraError}</p>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all">
                    <ImageIcon className="w-4 h-4" />
                    <span>Chọn Ảnh Chụp Từ Thiết Bị</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload(e.target.files[0]);
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
                  className="w-full max-h-[60vh] object-contain rounded-2xl border border-slate-800 bg-black"
                />
              )}
            </div>

            <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
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

                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Chọn ảnh có sẵn</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                        handleCloseCameraModal();
                      }
                    }}
                  />
                </label>
              </div>

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
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
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

      {/* MODAL XEM DANH SÁCH BÀI NỘP CỦA HỌC SINH */}
      {isSubmissionsModalOpen && selectedHwForSubmissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-5 animate-fade-in overflow-hidden">
          <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold flex items-center gap-2">
                    Bài Nộp Của Học Sinh
                    <span className="text-xs font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-600/40">
                      {selectedHwForSubmissions.submissions?.length || 0} bài nộp
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Bài tập: <strong className="text-white">{selectedHwForSubmissions.title}</strong> &bull; Lớp: {selectedHwForSubmissions.className} &bull; Hạn nộp: {selectedHwForSubmissions.dueDate}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSubmissionsModalOpen(false);
                  setSelectedHwForSubmissions(null);
                }}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Submissions List Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/70 space-y-3">
              {(!selectedHwForSubmissions.submissions || selectedHwForSubmissions.submissions.length === 0) ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-2">
                  <BookMarked className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-700">Chưa có học sinh nào nộp bài</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Khi phụ huynh chụp ảnh bài làm hoặc gửi file PDF qua ứng dụng Phụ huynh, bài nộp sẽ tự động xuất hiện tại đây theo thời gian thực.
                  </p>
                </div>
              ) : (
                selectedHwForSubmissions.submissions.map((sub, index) => {
                  const isImg = sub.fileType === 'image' || /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(sub.fileName) || (sub.fileUrl && sub.fileUrl.startsWith('data:image/'));
                  const isPdf = sub.fileType === 'pdf' || sub.fileName.toLowerCase().endsWith('.pdf');
                  const currentScore = submissionScores[sub.studentId] ?? sub.score ?? 8.5;
                  const currentFeedback = submissionFeedbacks[sub.studentId] ?? sub.feedback ?? 'Bài làm tốt, trình bày sạch sẽ!';
                  const isSaving = savingSubStudentId === sub.studentId;

                  return (
                    <div
                      key={sub.id || index}
                      className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-[#0072B5] hover:shadow-md transition-all space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          {/* Thumbnail if image */}
                          {isImg && sub.fileUrl ? (
                            <div
                              onClick={() => {
                                setPreviewDoc({
                                  fileName: sub.fileName,
                                  fileUrl: sub.fileUrl,
                                  fileType: 'image',
                                  assignmentTitle: selectedHwForSubmissions.title,
                                  className: selectedHwForSubmissions.className,
                                  teacherName: teacherDisplayName,
                                  dueDate: selectedHwForSubmissions.dueDate,
                                  assignmentContent: sub.note || '',
                                });
                                setIsPreviewOpen(true);
                              }}
                              className="w-16 h-16 rounded-xl border border-emerald-200 bg-slate-100 p-0.5 shrink-0 overflow-hidden shadow-2xs cursor-pointer hover:opacity-90"
                              title="Nhấn để xem phóng to ảnh bài nộp"
                            >
                              <img src={sub.fileUrl} alt={sub.studentName} className="w-full h-full object-cover rounded-lg" />
                            </div>
                          ) : (
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                              isPdf ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-[#0072B5]'
                            }`}>
                              <FileText className="w-6 h-6" />
                            </div>
                          )}

                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-black text-slate-800">{sub.studentName}</h4>
                              <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                ✓ Đã nộp bài
                              </span>
                              {sub.score !== undefined && (
                                <span className="text-[10px] font-black text-[#00A86B] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-300">
                                  Điểm: {sub.score}/10
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span>Thời gian nộp: <strong className="text-slate-700">{sub.submittedAt}</strong></span>
                              {sub.parentName && <span>Phụ huynh: <strong className="text-slate-700">{sub.parentName}</strong> {sub.parentPhone ? `(${sub.parentPhone})` : ''}</span>}
                            </div>

                            {sub.note && (
                              <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 italic mt-1">
                                Lời nhắn từ PH: &ldquo;{sub.note}&rdquo;
                              </p>
                            )}

                            <div className="text-[11px] font-medium text-slate-500 truncate pt-0.5">
                              File nộp: <span className="font-semibold text-slate-700">{sub.fileName}</span>
                            </div>

                            {(sub.score !== undefined || sub.feedback) && (
                              <div className="mt-1.5 p-2 rounded-xl bg-emerald-50/90 border border-emerald-200 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>Đã phản hồi</span>
                                  </span>
                                  {sub.score !== undefined && (
                                    <span className="text-[11px] font-black text-[#00A86B]">
                                      Điểm: {sub.score}/10
                                    </span>
                                  )}
                                </div>
                                {sub.feedback && (
                                  <p className="text-xs text-slate-700 font-medium italic">
                                    Nhận xét: &ldquo;{sub.feedback}&rdquo;
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewDoc({
                                fileName: sub.fileName,
                                fileUrl: sub.fileUrl,
                                fileType: isImg ? 'image' : isPdf ? 'pdf' : 'word',
                                assignmentTitle: `${selectedHwForSubmissions.title} - Bài nộp: ${sub.studentName}`,
                                className: selectedHwForSubmissions.className,
                                teacherName: teacherDisplayName,
                                dueDate: selectedHwForSubmissions.dueDate,
                                assignmentContent: sub.note ? `Lời nhắn từ phụ huynh: ${sub.note}` : '',
                              });
                              setIsPreviewOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-[#0072B5] hover:bg-[#0B486B] transition-all shadow-xs cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem bài nộp</span>
                          </button>

                          <a
                            href={sub.fileUrl}
                            download={sub.fileName}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Tải về</span>
                          </a>
                        </div>
                      </div>

                      {/* Teacher Grading & Feedback Panel (Chấm điểm, Nhận xét, Sửa bài) */}
                      <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/90 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-[#0B486B] text-xs flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-[#F39C12]" />
                            Chấm điểm &amp; Lời phê của giáo viên:
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Đồng bộ thời gian thực đến tài khoản Phụ huynh
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                          <div className="sm:col-span-1">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Điểm số (Thang 10)</label>
                            <input
                              type="number"
                              min={0}
                              max={10}
                              step={0.5}
                              value={currentScore}
                              onChange={(e) => setSubmissionScores({ ...submissionScores, [sub.studentId]: Number(e.target.value) })}
                              className="w-full rounded-xl border border-amber-300 bg-white px-3 py-1.5 font-black text-sm text-[#00A86B] focus:outline-hidden focus:ring-2 focus:ring-amber-200"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Lời phê / Nhận xét chi tiết</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={currentFeedback}
                                onChange={(e) => setSubmissionFeedbacks({ ...submissionFeedbacks, [sub.studentId]: e.target.value })}
                                placeholder="VD: Bài làm rất tốt, trình bày cẩn thận..."
                                className="flex-1 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-200"
                              />
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => handleSaveSubmissionGrade(selectedHwForSubmissions.id, sub.studentId)}
                                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#00A86B] hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                              >
                                {isSaving ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Đang lưu...</span>
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-3.5 h-3.5" />
                                    <span>Lưu &amp; Đồng bộ</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Đồng bộ tự động từ Firebase Storage &amp; Firestore subcollection</span>
              <button
                type="button"
                onClick={() => {
                  setIsSubmissionsModalOpen(false);
                  setSelectedHwForSubmissions(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CHỈNH SỬA BÀI TẬP (FIREBASE & STORAGE SYNC) */}
      {isEditModalOpen && editingHw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#0B486B] to-[#0072B5] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Pencil className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Chỉnh Sửa Bài Tập</h3>
                  <p className="text-xs text-blue-100 font-medium">
                    Lớp: {currentClass?.name} &bull; Tự động đồng bộ Firestore &amp; Storage
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingHw(null);
                }}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tiêu đề bài tập *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="VD: Phiếu bài tập tuần 6..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hạn nộp bài *</label>
                  <input
                    type="date"
                    required
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Môn học</label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Thang điểm tối đa</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={editMaxScore}
                    onChange={(e) => setEditMaxScore(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nội dung hướng dẫn &amp; dặn dò</label>
                <textarea
                  rows={3}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Mô tả yêu cầu bài tập..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Tệp / Ảnh đính kèm */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <label className="block font-bold text-slate-700">Tệp đính kèm bài tập</label>

                {/* Tệp hiện tại (nếu chưa gỡ) */}
                {editAttachedFile && !editRemoveExistingFile ? (
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {editAttachedFileType === 'image' && editAttachedFileUrl && (
                        <img
                          src={editAttachedFileUrl}
                          alt={editAttachedFile}
                          className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                            editAttachedFileType === 'pdf' ? 'bg-rose-100 text-rose-800' :
                            editAttachedFileType === 'word' ? 'bg-blue-100 text-[#0072B5]' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            {editAttachedFileType === 'pdf' ? 'PDF' : editAttachedFileType === 'word' ? 'WORD' : 'ẢNH CHỤP'}
                          </span>
                          <span className="font-semibold text-xs text-slate-800 truncate" title={editAttachedFile}>
                            {editAttachedFile}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Tệp đang được gắn với bài tập này</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewDoc({
                            fileName: editAttachedFile,
                            fileUrl: editAttachedFileUrl,
                            fileData: editAttachedFileData,
                            fileType: editAttachedFileType,
                            htmlContent: editAttachedFileHtml,
                            assignmentTitle: editTitle,
                            subject: editSubject,
                            className: currentClass?.name || 'Lớp học',
                            teacherName: teacherDisplayName,
                            dueDate: editDueDate,
                            assignmentContent: editContent,
                          });
                          setIsPreviewOpen(true);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#0072B5] bg-blue-50 hover:bg-blue-100 border border-blue-200 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditRemoveExistingFile(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                        title="Gỡ bỏ tệp này khỏi bài tập"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Gỡ tệp</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Khung chọn tệp mới khi chưa có tệp hoặc đã gỡ tệp */
                  <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-3.5 space-y-2.5 text-center">
                    <p className="text-xs text-slate-600 font-medium">
                      {editRemoveExistingFile 
                        ? 'Đã chọn gỡ tệp cũ. Bạn có thể lưu ngay để xóa tệp hoặc tải lên tệp thay thế bên dưới:'
                        : 'Chưa có tệp đính kèm. Tải ảnh chụp hoặc tài liệu mới:'}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-xs cursor-pointer transition-all">
                        <ImageIcon className="w-4 h-4 text-emerald-600" />
                        <span>Tải ảnh chụp từ máy</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleEditFileUpload(e.target.files[0]);
                            }
                          }}
                        />
                      </label>

                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[#0072B5] hover:bg-blue-100 border border-blue-200 font-bold text-xs cursor-pointer transition-all">
                        <Paperclip className="w-4 h-4 text-[#0072B5]" />
                        <span>Tải file Word / PDF</span>
                        <input
                          type="file"
                          accept=".pdf,.docx,.doc"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleEditFileUpload(e.target.files[0]);
                            }
                          }}
                        />
                      </label>

                      {editRemoveExistingFile && (
                        <button
                          type="button"
                          onClick={() => setEditRemoveExistingFile(false)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-xs cursor-pointer transition-all"
                        >
                          Khôi phục tệp ban đầu
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingHw(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || isReadingEditFile}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang lưu &amp; đồng bộ...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Lưu Thay Đổi &amp; Đồng Bộ</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: GIAO LẠI BÀI TẬP CHO HỌC SINH (REASSIGN HOMEWORK) */}
      {isReassignModalOpen && reassigningHws.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#0072B5] to-[#0B486B] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Giao Lại Bài Tập</h3>
                  <p className="text-xs text-blue-100 font-medium">
                    Giao lại cho lớp {currentClass?.name} ({reassigningHws.length} bài tập)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsReassignModalOpen(false);
                  setReassigningHws([]);
                }}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleConfirmReassign} className="p-6 space-y-4 text-xs">
              {/* Danh sách các bài tập sẽ giao lại */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Bài tập được giao lại ({reassigningHws.length}):
                </label>
                <div className="max-h-32 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {reassigningHws.map((h) => (
                    <div key={h.id} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white border border-slate-100">
                      <span className="font-bold text-slate-800 truncate pr-2">{h.title}</span>
                      <span className="text-[10px] text-slate-500 font-medium shrink-0">Hạn cũ: {h.dueDate}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hạn nộp mới */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Hạn nộp bài mới *</label>
                <input
                  type="date"
                  required
                  value={reassignDueDate}
                  onChange={(e) => setReassignDueDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Lời dặn bổ sung */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Dặn dò bổ sung khi giao lại</label>
                <textarea
                  rows={2}
                  value={reassignNote}
                  onChange={(e) => setReassignNote(e.target.value)}
                  placeholder="VD: Cô giao lại bài để các bạn làm lại các câu bị sai, nộp trước thứ 6..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Tùy chọn đặt lại bài nộp */}
              <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reassignResetSubmissions}
                    onChange={(e) => setReassignResetSubmissions(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0072B5] focus:ring-[#0072B5] mt-0.5 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    <strong>Yêu cầu học sinh nộp lại bài mới</strong> (làm mới danh sách bài nộp để học sinh có thể tải lên bài làm mới nhất)
                  </span>
                </label>
              </div>

              <div className="text-[11px] text-slate-500 italic">
                * Sau khi giao lại, trạng thái bài tập sẽ chuyển về <strong>Đang làm bài</strong> và phụ huynh/học sinh sẽ nhận được thông báo hạn nộp mới.
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsReassignModalOpen(false);
                    setReassigningHws([]);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isReassigning || !reassignDueDate}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isReassigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang giao lại...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Xác Nhận Giao Lại</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: XÁC NHẬN XÓA BÀI TẬP (FIREBASE & STORAGE SYNC) */}
      {isDeleteModalOpen && hwsToDelete.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="font-extrabold text-base text-slate-800">
                Xác nhận xóa {hwsToDelete.length} bài tập?
              </h3>

              <p className="text-xs text-slate-600 leading-relaxed">
                Thao tác này sẽ xóa vĩnh viễn dữ liệu bài tập trên <strong>Cloud Firestore</strong> và xóa toàn bộ các tệp đề bài, ảnh chụp cùng bài nộp của học sinh trên <strong>Firebase Storage</strong>.
              </p>

              <div className="max-h-28 overflow-y-auto text-left bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                {hwsToDelete.map((h) => (
                  <div key={h.id} className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span className="truncate">{h.title}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isDeletingHw}
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setHwsToDelete([]);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isDeletingHw}
                  onClick={handleConfirmDelete}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isDeletingHw ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang xóa...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Xác Nhận Xóa</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTION TOAST NOTIFICATION */}
      {actionToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold text-white animate-fade-in ${
            actionToast.type === 'success'
              ? 'bg-emerald-600'
              : actionToast.type === 'error'
              ? 'bg-rose-600'
              : 'bg-[#0072B5]'
          }`}
        >
          {actionToast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : actionToast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{actionToast.message}</span>
        </div>
      )}


      <DocumentPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        document={previewDoc}
      />
    </div>
  );
};
