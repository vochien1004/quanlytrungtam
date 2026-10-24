import React, { useState, useMemo, useEffect } from 'react';
import { 
  Table, 
  Calendar, 
  Users, 
  Download, 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  School, 
  GraduationCap, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  Filter, 
  RefreshCw, 
  Sparkles, 
  Building2,
  DollarSign,
  BookOpen,
  CalendarDays,
  FileSpreadsheet,
  Lock,
  Unlock,
  Send
} from 'lucide-react';
import { ClassItem, TeacherItem, StudentItem } from '../../data/mockData';
import { UserAccount } from '../../services/authService';
import {
  getRealtimeAttendance,
  isTeacherRole,
  updateClass,
  MonthlyTuitionLockItem,
  StudentTuitionSnapshot,
  calculateStudentMonthlyAttendedSessions,
  finalizeMonthlyTuition,
  unfinalizeMonthlyTuition,
  getRealtimeMonthlyTuitionLocks,
} from '../../services/firebaseService';
import { AccountAvatar } from '../common/AccountAvatar';
import { ExportMonthlyExcelModal } from './ExportMonthlyExcelModal';
import { exportSingleClassAttendanceWorkbook } from '../../services/excelExportService';

interface ReportsViewProps {
  classes?: ClassItem[];
  teachers?: TeacherItem[];
  students?: StudentItem[];
  attendanceRecords?: any[];
  activeCenterId?: string;
  currentUser?: UserAccount | null;
  centers?: any[];
  centerName?: string;
  onUpdateClassPrice?: (classId: string, price: number) => Promise<void> | void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  classes = [],
  teachers = [],
  students = [],
  attendanceRecords = [],
  activeCenterId = '',
  currentUser,
  centers = [],
  centerName: propCenterName,
  onUpdateClassPrice,
}) => {
  // Center ID thực tế
  const effectiveCenterId = activeCenterId || currentUser?.centerId || '';

  // Xác định Tên trung tâm thực tế đang xuất file (thay thế TÊN TRUNG TÂM theo yêu cầu)
  const effectiveCenter = (centers || []).find(
    (c: any) =>
      c.id === effectiveCenterId ||
      c.id === currentUser?.centerId ||
      c.adminUid === currentUser?.uid ||
      (currentUser?.username &&
        c.adminUsername &&
        c.adminUsername.toLowerCase() === currentUser.username.toLowerCase())
  );
  const currentCenterName =
    propCenterName ||
    effectiveCenter?.name ||
    currentUser?.centerName ||
    currentUser?.name ||
    'Trung Tâm Đào Tạo';

  // Phân quyền hiển thị: Đơn giá/buổi và phần Tổng tiền BỊ ẨN đối với tài khoản Giáo viên (role: teachers/teacher), CHỈ HIỂN THỊ đối với tài khoản center_admin
  const isTeacher = isTeacherRole(currentUser?.role);
  const isCenterAdmin = !isTeacher && (currentUser?.role === 'center_admin' || currentUser?.role === 'super_admin');
  const showFinancials = isCenterAdmin;

  // 1. Quản lý Tháng điểm danh (mặc định tháng 10/2026 hoặc tháng hiện tại)
  const initialDateIso = new Date().toISOString().split('T')[0];
  const initialMonthIso = initialDateIso.slice(0, 7); // '2026-10'
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonthIso);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // 2. Quản lý Lớp học được chọn (Dạng xổ xuống)
  // 'all' = Hiển thị tất cả các lớp của trung tâm (mỗi lớp 1 bảng)
  // hoặc chọn từng classId cụ thể
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  // Đơn giá mỗi buổi học theo từng lớp (đồng bộ từ thông tin lớp học và Firebase, mặc định 40,000 đ)
  const [pricesMap, setPricesMap] = useState<Record<string, number>>({});

  // Trạng thái chốt sổ học phí tháng (đồng bộ với tài khoản phụ huynh)
  const [tuitionLocks, setTuitionLocks] = useState<MonthlyTuitionLockItem[]>([]);
  const [lockingClassId, setLockingClassId] = useState<string | null>(null);
  const [tuitionToast, setTuitionToast] = useState<{ show: boolean; message: string; type: 'success' | 'info' }>({
    show: false,
    message: '',
    type: 'success',
  });

  const showTuitionNotice = (message: string, type: 'success' | 'info' = 'success') => {
    setTuitionToast({ show: true, message, type });
    setTimeout(() => {
      setTuitionToast((prev) => ({ ...prev, show: false }));
    }, 4000);
  };

  useEffect(() => {
    const unsub = getRealtimeMonthlyTuitionLocks(effectiveCenterId, (locks) => {
      setTuitionLocks(locks);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [effectiveCenterId]);

  const getPriceForClass = (classId: string) => {
    if (pricesMap[classId] !== undefined) return pricesMap[classId];
    const targetClass = (classes || []).find((c) => c.id === classId);
    if (targetClass?.pricePerSession !== undefined && !isNaN(Number(targetClass.pricePerSession))) {
      return Number(targetClass.pricePerSession);
    }
    const existingLock = tuitionLocks.find(
      (l) => l.month === selectedMonth && (l.classId === classId || l.classId === 'ALL')
    );
    if (existingLock?.pricePerSession !== undefined && !isNaN(Number(existingLock.pricePerSession))) {
      return Number(existingLock.pricePerSession);
    }
    return 40000;
  };

  // 3. Listener Realtime kết nối sub-collection `/centers/{centerId}/attendance`
  // Đảm bảo khi giáo viên vừa điểm danh ở tài khoản của mình xong, center_admin thấy ngay lập tức!
  const [realtimeAttendance, setRealtimeAttendance] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    if (!effectiveCenterId) return;
    setIsSyncing(true);
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = getRealtimeAttendance(effectiveCenterId, (records) => {
        setRealtimeAttendance(records);
        setIsSyncing(false);
      });
    } catch (err) {
      console.warn('Lỗi kết nối getRealtimeAttendance trong ReportsView:', err);
      setIsSyncing(false);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [effectiveCenterId]);

  // Hợp nhất dữ liệu điểm danh từ props và listener realtime
  const effectiveAttendanceRecords = useMemo(() => {
    const map = new Map<string, any>();
    (attendanceRecords || []).forEach((r) => {
      if (r) {
        const k = r.id || `${r.classId}_${r.date || r.sessionDate}`;
        map.set(k, r);
      }
    });
    (realtimeAttendance || []).forEach((r) => {
      if (r) {
        const k = r.id || `${r.classId}_${r.date || r.sessionDate}`;
        map.set(k, { ...(map.get(k) || {}), ...r });
      }
    });
    return Array.from(map.values());
  }, [attendanceRecords, realtimeAttendance]);

  // Danh sách các ngày trong tháng (1 đến 28/29/30/31)
  const daysInMonthList = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr || '2026', 10);
    const month = parseInt(monthStr || '10', 10);
    const totalDays = new Date(year, month, 0).getDate();
    return Array.from({ length: totalDays }, (_, i) => i + 1);
  }, [selectedMonth]);

  // Danh sách Tháng điểm danh (dạng xổ xuống)
  const monthOptions = useMemo(() => {
    const [yearStr] = selectedMonth.split('-');
    const year = parseInt(yearStr || '2026', 10);
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

  // Điều hướng chuyển tháng trước / sau
  const handlePrevMonth = () => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) - 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    setSelectedMonth(`${year}-${month.toString().padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) + 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    setSelectedMonth(`${year}-${month.toString().padStart(2, '0')}`);
  };

  // Danh sách các lớp hợp lệ của trung tâm hiện tại
  const centerClasses = useMemo(() => {
    if (classes.length === 0) return [];
    return classes;
  }, [classes]);

  // Các lớp sẽ được hiển thị bảng:
  // Nếu chọn 'all' -> hiển thị tất cả các lớp của trung tâm
  // Nếu chọn 1 lớp cụ thể -> chỉ hiển thị lớp đó
  const displayedClasses = useMemo(() => {
    if (selectedClassId === 'all') {
      return centerClasses;
    }
    return centerClasses.filter((c) => c.id === selectedClassId);
  }, [centerClasses, selectedClassId]);

  // Tìm thông tin giáo viên phụ trách cho lớp
  const getTeacherForClass = (cls: ClassItem) => {
    const matched = teachers.find(
      (t) =>
        (cls.teacherId && t.id === cls.teacherId) ||
        (cls.teacherName && (t.name === cls.teacherName || t.fullName === cls.teacherName)) ||
        (t.mainClassId && t.mainClassId === cls.id) ||
        (Array.isArray(t.assignedClassIds) && t.assignedClassIds.includes(cls.id))
    );
    return (
      matched || {
        id: cls.teacherId || 'teacher-default',
        name: cls.teacherName || 'Chưa phân công giáo viên',
        fullName: cls.teacherName || 'Chưa phân công giáo viên',
        subject: cls.subject || 'Bộ môn Văn hóa',
        phone: cls.teacherPhone || '',
        avatar: '',
      }
    );
  };

  // Tìm danh sách học sinh thuộc lớp
  const getStudentsForClass = (cls: ClassItem) => {
    return students.filter(
      (s) =>
        s &&
        (s.classId === cls.id ||
          s.className === cls.name ||
          (cls.classCode && s.classId === cls.classCode))
    );
  };

  // Tìm các bản ghi điểm danh trong tháng của lớp từ Firestore
  const getMonthlyRecordsForClass = (cls: ClassItem) => {
    return effectiveAttendanceRecords.filter((att) => {
      if (!att) return false;
      const isMatchClass =
        att.classId === cls.id ||
        (cls.classCode && att.classId === cls.classCode) ||
        (cls.name && att.className === cls.name);
      if (!isMatchClass) return false;
      const dateStr = att.date || att.sessionDate || '';
      return att.sessionMonth === selectedMonth || dateStr.startsWith(selectedMonth);
    });
  };

  // Kiểm tra lớp học đã được center_admin chốt sổ trong tháng đang chọn hay chưa
  const isClassMonthFinalized = (classId: string): boolean => {
    const classLock = tuitionLocks.find(
      (l) => l.month === selectedMonth && l.classId === classId
    );
    if (classLock !== undefined) return Boolean(classLock.isFinalized);
    const allLock = tuitionLocks.find(
      (l) => l.month === selectedMonth && l.classId === 'ALL'
    );
    return Boolean(allLock?.isFinalized);
  };

  const getClassLockDetails = (classId: string): MonthlyTuitionLockItem | undefined => {
    return (
      tuitionLocks.find((l) => l.month === selectedMonth && l.classId === classId) ||
      tuitionLocks.find((l) => l.month === selectedMonth && l.classId === 'ALL')
    );
  };

  // Tạo danh sách dữ liệu học phí của học sinh trong lớp đồng bộ 100% với bảng điểm danh của giáo viên
  const buildClassStudentTuitionSnapshots = (
    cls: ClassItem,
    overridePrice?: number
  ): StudentTuitionSnapshot[] => {
    const classStudents = getStudentsForClass(cls);
    const price = overridePrice !== undefined ? overridePrice : getPriceForClass(cls.id);
    return classStudents.map((st) => {
      const attendedSessions = calculateStudentMonthlyAttendedSessions({
        month: selectedMonth,
        student: st,
        attendanceRecords: effectiveAttendanceRecords,
        classInfo: cls,
      });
      return {
        studentId: st.id,
        studentCode: st.studentCode || st.id,
        studentName: st.name,
        parentPhone: st.parentPhone || '',
        classId: cls.id,
        className: cls.name,
        month: selectedMonth,
        attendedSessions,
        pricePerSession: price,
        totalTuition: attendedSessions * price,
      };
    });
  };

  // Chốt sổ học phí tháng cho 1 lớp cụ thể và truyền đến tài khoản Phụ huynh
  const handleFinalizeClassTuition = async (cls: ClassItem, overridePrice?: number, silent?: boolean) => {
    if (!effectiveCenterId) return;
    setLockingClassId(cls.id);
    try {
      const price = overridePrice !== undefined ? overridePrice : getPriceForClass(cls.id);
      const snapshots = buildClassStudentTuitionSnapshots(cls, price);
      await finalizeMonthlyTuition({
        centerId: effectiveCenterId,
        month: selectedMonth,
        classId: cls.id,
        className: cls.name,
        pricePerSession: price,
        studentsList: snapshots,
        finalizedBy: currentUser?.fullName || currentUser?.name || 'Quản trị trung tâm',
      });
      if (!silent) {
        const [y, m] = selectedMonth.split('-');
        showTuitionNotice(
          `✓ Đã chốt sổ & truyền học phí Tháng ${m}/${y} của lớp "${cls.name}" (${snapshots.length} học sinh) đến tài khoản Phụ huynh!`,
          'success'
        );
      }
    } catch (err) {
      console.warn('Lỗi chốt sổ học phí lớp:', err);
    } finally {
      setLockingClassId(null);
    }
  };

  // Mở khóa / Bỏ chốt sổ học phí tháng của 1 lớp
  const handleUnfinalizeClassTuition = async (cls: ClassItem) => {
    if (!effectiveCenterId) return;
    setLockingClassId(cls.id);
    try {
      await unfinalizeMonthlyTuition({
        centerId: effectiveCenterId,
        month: selectedMonth,
        classId: cls.id,
      });
      await unfinalizeMonthlyTuition({
        centerId: effectiveCenterId,
        month: selectedMonth,
        classId: 'ALL',
      });
      const [y, m] = selectedMonth.split('-');
      showTuitionNotice(
        `Đã mở khóa sổ học phí Tháng ${m}/${y} của lớp "${cls.name}". Phụ huynh sẽ thấy trạng thái đang cập nhật.`,
        'info'
      );
    } catch (err) {
      console.warn('Lỗi mở khóa sổ học phí lớp:', err);
    } finally {
      setLockingClassId(null);
    }
  };

  // Chốt sổ học phí tháng cho TẤT CẢ các lớp đang hiển thị
  const handleFinalizeAllDisplayedClasses = async () => {
    if (!effectiveCenterId || displayedClasses.length === 0) return;
    setLockingClassId('ALL');
    try {
      const allSnapshots: StudentTuitionSnapshot[] = [];
      for (const cls of displayedClasses) {
        const price = getPriceForClass(cls.id);
        const snapshots = buildClassStudentTuitionSnapshots(cls, price);
        allSnapshots.push(...snapshots);
        await finalizeMonthlyTuition({
          centerId: effectiveCenterId,
          month: selectedMonth,
          classId: cls.id,
          className: cls.name,
          pricePerSession: price,
          studentsList: snapshots,
          finalizedBy: currentUser?.fullName || currentUser?.name || 'Quản trị trung tâm',
        });
      }
      if (selectedClassId === 'all') {
        await finalizeMonthlyTuition({
          centerId: effectiveCenterId,
          month: selectedMonth,
          classId: 'ALL',
          className: 'Toàn trung tâm',
          pricePerSession: 40000,
          studentsList: allSnapshots,
          finalizedBy: currentUser?.fullName || currentUser?.name || 'Quản trị trung tâm',
        });
      }
      const [y, m] = selectedMonth.split('-');
      showTuitionNotice(
        `✓ Đã chốt sổ & truyền dữ liệu học phí Tháng ${m}/${y} (${displayedClasses.length} lớp) đến toàn bộ tài khoản Phụ huynh!`,
        'success'
      );
    } catch (err) {
      console.warn('Lỗi chốt sổ toàn bộ lớp:', err);
    } finally {
      setLockingClassId(null);
    }
  };

  // Mở khóa toàn bộ các lớp đang hiển thị trong tháng
  const handleUnfinalizeAllDisplayedClasses = async () => {
    if (!effectiveCenterId) return;
    setLockingClassId('ALL');
    try {
      for (const cls of displayedClasses) {
        await unfinalizeMonthlyTuition({
          centerId: effectiveCenterId,
          month: selectedMonth,
          classId: cls.id,
        });
      }
      await unfinalizeMonthlyTuition({
        centerId: effectiveCenterId,
        month: selectedMonth,
        classId: 'ALL',
      });
      const [y, m] = selectedMonth.split('-');
      showTuitionNotice(
        `Đã bỏ chốt sổ học phí Tháng ${m}/${y}. Phụ huynh sẽ thấy thông báo dữ liệu đang được cập nhật.`,
        'info'
      );
    } catch (err) {
      console.warn('Lỗi bỏ chốt sổ toàn bộ lớp:', err);
    } finally {
      setLockingClassId(null);
    }
  };

  const setPriceForClass = async (classId: string, val: number) => {
    const safeVal = Math.max(0, val);
    setPricesMap((prev) => ({
      ...prev,
      [classId]: safeVal,
    }));
    // Đồng bộ tức thời lên Firebase Firestore & danh sách lớp học
    try {
      if (onUpdateClassPrice) {
        await onUpdateClassPrice(classId, safeVal);
      } else if (effectiveCenterId) {
        await updateClass(effectiveCenterId, classId, { pricePerSession: safeVal });
      }
      // Nếu lớp đang ở trạng thái Đã chốt sổ, tự động cập nhật lại học phí đã chốt cho phụ huynh
      const targetCls = centerClasses.find((c) => c.id === classId);
      if (targetCls && isClassMonthFinalized(classId)) {
        await handleFinalizeClassTuition(targetCls, safeVal, true);
      }
    } catch (err) {
      console.warn('Lỗi khi đồng bộ đơn giá lên Firebase:', err);
    }
  };

  const areAllDisplayedClassesFinalized =
    displayedClasses.length > 0 && displayedClasses.every((cls) => isClassMonthFinalized(cls.id));

  // Xuất file Excel (.xlsx chuẩn SheetJS) cho bảng điểm danh tháng của 1 lớp
  const handleExportClassExcel = async (cls: ClassItem) => {
    try {
      const teacher = getTeacherForClass(cls);
      const classStudents = getStudentsForClass(cls);
      const monthlyRecords = getMonthlyRecordsForClass(cls);
      const pricePerSession = getPriceForClass(cls.id);

      await exportSingleClassAttendanceWorkbook({
        month: selectedMonth,
        cls,
        teacher,
        classStudents,
        monthlyRecords,
        pricePerSession,
        showFinancials,
        centerName: currentCenterName,
      });
    } catch (err) {
      console.warn('Lỗi xuất Excel .xlsx, chuyển sang CSV:', err);
      handleExportClassCsv(cls);
    }
  };

  // Xuất file CSV dự phòng cho bảng điểm danh tháng của 1 lớp
  const handleExportClassCsv = (cls: ClassItem) => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const dayCols = daysInMonthList;
    const teacher = getTeacherForClass(cls);
    const classStudents = getStudentsForClass(cls);
    const monthlyRecords = getMonthlyRecordsForClass(cls);
    const pricePerSession = getPriceForClass(cls.id);

    let csv = `\uFEFF${showFinancials ? 'BẢNG ĐIỂM DANH VÀ HỌC PHÍ' : 'BẢNG ĐIỂM DANH'} THÁNG ${monthStr}/${yearStr}\n`;
    csv += `Lớp học: ${cls.name} - Phòng: ${cls.room || ''} - Giáo viên phụ trách: ${teacher.fullName || teacher.name}\n\n`;
    csv += `TT,TÊN HỌC SINH,SĐT PH,${dayCols.join(',')},Tổng buổi${showFinancials ? ',Đơn giá (VNĐ),Tổng tiền (VNĐ)' : ''}\n`;

    classStudents.forEach((st, idx) => {
      let attended = 0;
      const dayCells = dayCols.map((d) => {
        const dStr = d.toString().padStart(2, '0');
        const iso = `${selectedMonth}-${dStr}`;
        const rec = monthlyRecords.find((r) => (r.date || r.sessionDate) === iso);
        const sRec =
          rec?.records?.find(
            (r: any) =>
              (r.studentId && String(r.studentId).trim() === String(st.id).trim()) ||
              (r.id && String(r.id).trim() === String(st.id).trim()) ||
              (r.studentName && st.name && String(r.studentName).trim().toLowerCase() === String(st.name).trim().toLowerCase())
          ) || (rec?.studentId === st.id ? rec : null);
        const statusStr = String(sRec?.status || '').toLowerCase();
        if (statusStr === 'present' || statusStr === 'late' || statusStr.includes('có mặt')) {
          attended++;
          return 'X';
        }
        if (statusStr === 'excused' || statusStr.includes('phép')) return 'P';
        if (statusStr === 'unexcused' || statusStr === 'absent' || statusStr.includes('không phép')) return 'K';
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
    link.setAttribute(
      'download',
      `DiemDanh_${(cls.name || 'Lop').replace(/\s+/g, '_')}_Thang_${monthStr}_${yearStr}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Tính toán số liệu tổng quan toàn trung tâm trong tháng
  const summaryKpi = useMemo(() => {
    let totalPresentInMonth = 0;
    let totalEstimatedFee = 0;
    let totalRecordedSessions = 0;

    centerClasses.forEach((cls) => {
      const classStudents = getStudentsForClass(cls);
      const monthlyRecords = getMonthlyRecordsForClass(cls);
      const price = getPriceForClass(cls.id);
      totalRecordedSessions += monthlyRecords.length;

      classStudents.forEach((st) => {
        const attended = calculateStudentMonthlyAttendedSessions({
          month: selectedMonth,
          student: st,
          attendanceRecords: monthlyRecords,
          classInfo: cls,
        });
        totalPresentInMonth += attended;
        totalEstimatedFee += attended * price;
      });
    });

    return {
      totalClasses: centerClasses.length,
      totalStudents: students.length,
      totalRecordedSessions,
      totalPresentInMonth,
      totalEstimatedFee,
    };
  }, [centerClasses, students, daysInMonthList, selectedMonth, effectiveAttendanceRecords, pricesMap, tuitionLocks]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* THÔNG BÁO KHI CHỐT SỔ / MỞ KHÓA SỔ HỌC PHÍ THÁNG */}
      {tuitionToast.show && (
        <div
          className={`rounded-2xl p-4 text-xs font-bold flex items-center justify-between shadow-lg animate-fade-in border-2 ${
            tuitionToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
              : 'bg-blue-50 border-blue-300 text-[#0B486B]'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-xs shrink-0 ${
                tuitionToast.type === 'success' ? 'bg-[#00A86B]' : 'bg-[#0072B5]'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <span>{tuitionToast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setTuitionToast((prev) => ({ ...prev, show: false }))}
            className="px-2 py-1 rounded-lg hover:bg-black/5 font-black cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* HEADER BÁO CÁO THỐNG KÊ */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-[#0072B5] shadow-2xs">
              <Table className="w-5 h-5 text-[#0072B5]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#0B486B] tracking-tight">
                Báo Cáo Điểm Danh &amp; Thống Kê Học Phí Toàn Trung Tâm
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Dữ liệu đồng bộ thời gian thực từ hoạt động điểm danh của giáo viên theo từng lớp học trên Firestore
              </p>
            </div>
          </div>
        </div>

        {/* Live Sync Status indicator & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Đồng bộ Firestore: Hoạt động</span>
          </div>

          {/* NÚT CHỐT SỔ HỌC PHÍ THÁNG TRUYỀN ĐẾN PHỤ HUYNH (DÀNH CHO CENTER ADMIN) */}
          {showFinancials && displayedClasses.length > 0 && (
            areAllDisplayedClassesFinalized ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={lockingClassId !== null}
                  onClick={handleFinalizeAllDisplayedClasses}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Cập nhật và gửi lại dữ liệu học phí mới nhất của tháng này sang tài khoản Phụ huynh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${lockingClassId === 'ALL' ? 'animate-spin' : ''}`} />
                  <span>Đã chốt sổ Tháng {selectedMonth.split('-')[1]}/{selectedMonth.split('-')[0]} (Đồng bộ lại)</span>
                </button>
                <button
                  type="button"
                  disabled={lockingClassId !== null}
                  onClick={handleUnfinalizeAllDisplayedClasses}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs transition-all cursor-pointer"
                  title="Bỏ chốt sổ để tạm ẩn dữ liệu học phí bên tài khoản Phụ huynh"
                >
                  <Unlock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Bỏ chốt sổ</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={lockingClassId !== null}
                onClick={handleFinalizeAllDisplayedClasses}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black bg-[#00A86B] hover:bg-emerald-700 text-white shadow-sm hover:shadow-md transition-all cursor-pointer ring-2 ring-emerald-400/30 active:scale-95 disabled:opacity-50"
                title="Chốt sổ học phí tháng này và truyền thông tin (Tên học sinh, Số buổi học, Học phí) sang menu Điểm danh của tài khoản Phụ huynh"
              >
                <Send className="w-4 h-4 text-white shrink-0" />
                <span>Chốt sổ &amp; Truyền học phí Tháng {selectedMonth.split('-')[1]}/{selectedMonth.split('-')[0]} cho PH</span>
              </button>
            )
          )}

          {/* NÚT XUẤT FILE EXCEL TỔNG HỢP: Toàn bộ bảng điểm danh của tất cả các lớp trên 1 file (chọn tháng để xuất), mỗi lớp trên 1 sheet */}
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-[#0072B5] hover:from-emerald-700 hover:to-[#0B486B] text-white shadow-sm hover:shadow-md transition-all cursor-pointer ring-2 ring-emerald-400/30 active:scale-95"
            title="Xuất file Excel tổng hợp toàn bộ các lớp (Chọn tháng để xuất, mỗi lớp trên 1 sheet)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100 shrink-0" />
            <span>Xuất file Excel tổng hợp</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-2xs transition-all cursor-pointer"
            title="In toàn bộ báo cáo"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>In Báo Cáo</span>
          </button>
        </div>
      </div>

      {/* THANH ĐIỀU HƯỚNG BỘ LỌC XỔ XUỐNG: CHỌN LỚP HỌC & CHỌN THÁNG */}
      <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* 1. DROPDOWN CHỌN LỚP HỌC (XỔ XUỐNG) */}
          <div className="md:col-span-6 space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <School className="w-4 h-4 text-[#0072B5]" />
              <span>CHỌN LỚP HỌC (DẠNG XỔ XUỐNG):</span>
            </label>
            <div className="relative">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full appearance-none rounded-2xl border-2 border-blue-200/90 bg-blue-50/40 hover:bg-blue-50/70 px-4 py-3 text-xs md:text-sm font-extrabold text-[#0B486B] shadow-2xs transition-all cursor-pointer focus:border-[#0072B5] focus:outline-hidden focus:ring-2 focus:ring-blue-100 pr-10"
              >
                <option value="all">
                  ⭐ Tất cả các lớp trong trung tâm ({centerClasses.length} lớp học - Hiển thị từng bảng)
                </option>
                {centerClasses.map((cls) => {
                  const teacher = getTeacherForClass(cls);
                  const stCount = getStudentsForClass(cls).length;
                  return (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} • {cls.subject || 'Bộ môn'} • GV: {teacher.fullName || teacher.name} ({stCount} HS)
                    </option>
                  );
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-[#0072B5]">
                <Filter className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* 2. DROPDOWN & NÚT ĐIỀU HƯỚNG CHỌN THÁNG (XỔ XUỐNG) */}
          <div className="md:col-span-6 space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#00A86B]" />
              <span>CHỌN THÁNG ĐIỂM DANH (XỔ XUỐNG):</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-2.5 rounded-2xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer shrink-0"
                title="Tháng trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="relative flex-1">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full appearance-none rounded-2xl border-2 border-emerald-200/90 bg-emerald-50/40 hover:bg-emerald-50/70 px-4 py-3 text-xs md:text-sm font-black text-emerald-900 shadow-2xs transition-all cursor-pointer focus:border-[#00A86B] focus:outline-hidden focus:ring-2 focus:ring-emerald-100 pr-10"
                >
                  {monthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-emerald-700">
                  <CalendarDays className="w-4 h-4" />
                </div>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2.5 rounded-2xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer shrink-0"
                title="Tháng sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setSelectedMonth(initialMonthIso)}
                className="px-3 py-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 shadow-2xs cursor-pointer shrink-0"
              >
                Hiện tại
              </button>

              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-3 rounded-2xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[11px] font-black text-emerald-900 shadow-2xs transition-colors cursor-pointer shrink-0"
                title="Mở bảng xuất file Excel tổng hợp tất cả các lớp"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Xuất Excel Tổng Hợp</span>
              </button>
            </div>
          </div>
        </div>

        {/* THÔNG TIN NHANH CỦA LỚP ĐƯỢC CHỌN */}
        {selectedClassId !== 'all' && (
          <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            {(() => {
              const currentCls = centerClasses.find((c) => c.id === selectedClassId);
              if (!currentCls) return null;
              const teacher = getTeacherForClass(currentCls);
              const classStudents = getStudentsForClass(currentCls);
              return (
                <>
                  <div className="flex items-center gap-3">
                    <AccountAvatar
                      name={teacher.fullName || teacher.name}
                      role="teacher"
                      size="md"
                      className="ring-2 ring-emerald-300 shadow-2xs"
                    />
                    <div>
                      <div className="font-black text-sm text-[#0B486B] flex items-center gap-2">
                        <span>Lớp: {currentCls.name}</span>
                        <span className="text-[10px] bg-blue-200/80 text-[#0072B5] px-2 py-0.5 rounded-full font-bold">
                          Phòng {currentCls.room || '1'}
                        </span>
                      </div>
                      <div className="text-slate-600 font-semibold mt-0.5 flex items-center gap-2">
                        <span>Giáo viên phụ trách: <strong className="text-emerald-800">{teacher.fullName || teacher.name}</strong></span>
                        {teacher.phone && (
                          <span className="text-[11px] text-slate-500 font-medium">({teacher.phone})</span>
                        )}
                        <span>&bull; Môn: <strong>{currentCls.subject}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500 font-bold">Sĩ số lớp</div>
                      <div className="text-base font-black text-[#0072B5]">{classStudents.length} Học sinh</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedClassId('all')}
                      className="px-3 py-1.5 rounded-xl border border-blue-300 bg-white hover:bg-blue-50 text-xs font-bold text-[#0072B5] shadow-2xs cursor-pointer"
                    >
                      Xem tất cả lớp
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* THẺ CHỈ SỐ KPI TỔNG HỢP CẢ TRUNG TÂM TRONG THÁNG */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 uppercase">
            <School className="w-3.5 h-3.5 text-[#0072B5]" />
            <span>Tổng số lớp</span>
          </div>
          <div className="text-2xl font-black text-[#0B486B] mt-1.5">
            {summaryKpi.totalClasses} <span className="text-xs font-bold text-slate-500">lớp</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Đang mở trong trung tâm</div>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 uppercase">
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tổng học sinh</span>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1.5">
            {summaryKpi.totalStudents} <span className="text-xs font-bold text-slate-500">HS</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">Toàn bộ các lớp học</div>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 uppercase">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Buổi đã điểm danh</span>
          </div>
          <div className="text-2xl font-black text-[#0072B5] mt-1.5">
            {summaryKpi.totalRecordedSessions} <span className="text-xs font-bold text-slate-500">buổi</span>
          </div>
          <div className="text-[11px] text-blue-600 font-semibold mt-1">Đã lưu lên Firebase</div>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 uppercase">
            <DollarSign className="w-3.5 h-3.5 text-amber-600" />
            <span>Dự thu học phí tháng</span>
          </div>
          <div className="text-xl md:text-2xl font-black text-amber-700 mt-1.5 truncate">
            {summaryKpi.totalEstimatedFee.toLocaleString('vi-VN')} <span className="text-xs font-bold text-slate-500">đ</span>
          </div>
          <div className="text-[11px] text-amber-600 font-semibold mt-1">
            {summaryKpi.totalPresentInMonth} lượt có mặt
          </div>
        </div>
      </div>

      {/* DANH SÁCH BẢNG ĐIỂM DANH & HỌC PHÍ THEO THÁNG: MỖI LỚP 1 BẢNG */}
      {displayedClasses.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
          <School className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Chưa có lớp học nào trong trung tâm</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Vui lòng tạo lớp học trong mục Quản trị trung tâm &gt; Lớp học để xem bảng điểm danh và học phí.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {displayedClasses.map((cls, classIndex) => {
            const teacher = getTeacherForClass(cls);
            const classStudents = getStudentsForClass(cls);
            const monthlyRecords = getMonthlyRecordsForClass(cls);
            const pricePerSession = getPriceForClass(cls.id);
            const [yearStr, monthStr] = selectedMonth.split('-');
            const isClassFinalized = isClassMonthFinalized(cls.id);
            const lockDetails = getClassLockDetails(cls.id);

            return (
              <div
                key={cls.id}
                className="rounded-3xl border border-slate-200/90 bg-white p-5 md:p-6 shadow-xs space-y-4 overflow-hidden"
              >
                {/* 1. Header Bảng: Đúng định dạng như ảnh mẫu */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
                  <div className="space-y-1">
                    <div className="text-base md:text-lg font-black text-[#0B486B] uppercase tracking-wide flex flex-wrap items-center gap-2.5">
                      <Table className="w-5 h-5 text-[#0072B5] shrink-0" />
                      <span>
                        {showFinancials ? 'BẢNG ĐIỂM DANH VÀ HỌC PHÍ' : 'BẢNG ĐIỂM DANH'} THÁNG {monthStr}/{yearStr}
                      </span>
                      {showFinancials && (
                        isClassFinalized ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 normal-case">
                            <Lock className="w-3 h-3 text-[#00A86B]" />
                            Đã chốt sổ &amp; gửi PH{lockDetails?.finalizedAtStr ? ` (${lockDetails.finalizedAtStr})` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 normal-case">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            Chưa chốt sổ học phí
                          </span>
                        )
                      )}
                    </div>

                    {/* Dòng thông tin Lớp, Phòng, Sĩ số, Đã lưu điểm danh trên Firebase */}
                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>
                        Lớp: <strong className="text-slate-900 font-extrabold">{cls.name}</strong>
                      </span>
                      <span>&bull;</span>
                      <span>
                        Phòng: <strong className="text-slate-900 font-extrabold">{cls.room || '1'}</strong>
                      </span>
                      <span>&bull;</span>
                      <span>
                        Sĩ số: <strong className="text-[#0072B5] font-black">{classStudents.length} HS</strong>
                      </span>
                      <span>&bull;</span>
                      <span>
                        Đã lưu điểm danh trên Firebase:{' '}
                        <strong className="text-emerald-700 font-black">{monthlyRecords.length} buổi</strong>
                      </span>
                    </div>

                    {/* HIỂN THỊ TÊN GIÁO VIÊN DẠY THEO YÊU CẦU NGƯỜI DÙNG */}
                    <div className="pt-1 flex items-center gap-2">
                      <AccountAvatar
                        name={teacher.fullName || teacher.name}
                        role="teacher"
                        size="sm"
                        className="ring-1 ring-emerald-300"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        Giáo viên dạy: <strong className="text-emerald-800">{teacher.fullName || teacher.name}</strong>
                      </span>
                      {teacher.phone && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          • SĐT: {teacher.phone}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500 font-medium">
                        • Bộ môn: {cls.subject}
                      </span>
                    </div>
                  </div>

                  {/* Cụm công cụ: Đơn giá/buổi + Chốt sổ gửi PH + Nút Xuất File Excel + In Bảng */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Cài đặt Đơn giá / buổi học để tính cột Tổng tiền - ẨN ĐỐI VỚI GIÁO VIÊN, CHỈ HIỂN THỊ VỚI CENTER_ADMIN */}
                    {showFinancials && (
                      <div
                        className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl text-xs font-bold text-slate-700 shadow-2xs hover:border-emerald-300 transition-colors"
                        title="Đơn giá/buổi học: Lưu và đồng bộ tự động lên Firebase & Danh sách lớp học"
                      >
                        <span className="text-slate-600">Đơn giá/buổi:</span>
                        <input
                          type="number"
                          step="5000"
                          min="0"
                          value={pricePerSession}
                          onChange={(e) =>
                            setPriceForClass(cls.id, parseInt(e.target.value, 10) || 0)
                          }
                          className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-xs font-black text-emerald-700 text-right focus:outline-hidden focus:ring-1 focus:ring-emerald-400"
                        />
                        <span className="text-[11px] text-slate-500 font-semibold">đ</span>
                      </div>
                    )}

                    {/* Nút Chốt sổ học phí lớp gửi Phụ huynh */}
                    {showFinancials && (
                      isClassFinalized ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={lockingClassId === cls.id}
                            onClick={() => handleFinalizeClassTuition(cls)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                            title="Cập nhật lại dữ liệu học phí mới nhất của lớp sang tài khoản Phụ huynh"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${lockingClassId === cls.id ? 'animate-spin' : ''}`} />
                            <span>Đồng bộ lại PH</span>
                          </button>
                          <button
                            type="button"
                            disabled={lockingClassId === cls.id}
                            onClick={() => handleUnfinalizeClassTuition(cls)}
                            className="flex items-center gap-1 px-2.5 py-2 rounded-2xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs transition-all cursor-pointer"
                            title="Mở khóa sổ học phí lớp này"
                          >
                            <Unlock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Mở khóa</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={lockingClassId === cls.id}
                          onClick={() => handleFinalizeClassTuition(cls)}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black bg-[#00A86B] hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                          title="Chốt sổ học phí lớp này và hiển thị bên tài khoản Phụ huynh"
                        >
                          <Send className="w-3.5 h-3.5 text-white" />
                          <span>Chốt sổ &amp; Gửi PH</span>
                        </button>
                      )
                    )}

                    {/* Nút Xuất File Excel (.xlsx) */}
                    <button
                      type="button"
                      onClick={() => handleExportClassExcel(cls)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-[#00A86B] border border-emerald-300 shadow-2xs transition-all cursor-pointer"
                      title="Xuất bảng điểm danh tháng này sang file Excel (.xlsx)"
                    >
                      <Download className="w-4 h-4 text-[#00A86B]" />
                      <span>Xuất File Excel</span>
                    </button>

                    {/* Nút In Bảng */}
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-2xs transition-all cursor-pointer"
                      title="In bảng điểm danh tháng"
                    >
                      <Printer className="w-4 h-4 text-slate-600" />
                      <span>In Bảng</span>
                    </button>
                  </div>
                </div>

                {/* 2. Ma trận Bảng Điểm danh theo Tháng (Chuẩn 100% theo ảnh đính kèm) */}
                {classStudents.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                    <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">
                      Chưa có học sinh nào được xếp vào lớp {cls.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Vui lòng xếp học sinh vào lớp để theo dõi và tính học phí tháng.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="sm:hidden flex items-center justify-between text-[11px] text-[#0072B5] bg-blue-50/80 px-3 py-1.5 rounded-lg border border-blue-200 mb-2">
                      <span>💡 <strong>Mẹo di động:</strong> Vuốt ngang để xem đủ 31 ngày</span>
                      <span>&rarr;</span>
                    </div>
                    <div className="overflow-x-auto border border-slate-300/90 rounded-2xl shadow-2xs">
                      <table className="w-full text-center text-xs border-collapse">
                        <thead>
                          {/* Tiêu đề THÁNG MM/YYYY căn giữa như hình ảnh mẫu */}
                          <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-black">
                            <th
                              colSpan={3 + daysInMonthList.length + (showFinancials ? 2 : 1)}
                              className="py-2.5 px-4 text-right text-sm font-black tracking-wider text-[#0B486B] uppercase pr-8"
                            >
                              THÁNG {monthStr}/{yearStr}
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
                              const isRecorded = monthlyRecords.some(
                                (r) => (r.date || r.sessionDate) === iso
                              );
                              return (
                                <th
                                  key={d}
                                  className={`py-2 px-1 w-8 min-w-[32px] text-center font-extrabold ${
                                    isRecorded ? 'bg-blue-50/80 text-[#0072B5]' : 'text-slate-700'
                                  }`}
                                  title={`Ngày ${dStr}/${monthStr}/${yearStr}${
                                    isRecorded ? ' - Đã lưu điểm danh trên Firebase' : ''
                                  }`}
                                >
                                  {d}
                                </th>
                              );
                            })}
                            <th className="py-2.5 px-2 min-w-[80px] text-center bg-blue-50/60 text-[#0072B5] font-black">
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
                          {classStudents.map((st, idx) => {
                            if (!st) return null;
                            let attendedCount = 0;

                            return (
                              <tr
                                key={st.id || idx}
                                className="hover:bg-slate-50/80 transition-colors divide-x divide-slate-300"
                              >
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
                                const rec = monthlyRecords.find(
                                  (r) => (r.date || r.sessionDate) === iso
                                );
                                const sRec =
                                  rec?.records?.find(
                                    (r: any) =>
                                      (r.studentId && String(r.studentId).trim() === String(st.id).trim()) ||
                                      (r.id && String(r.id).trim() === String(st.id).trim()) ||
                                      (r.studentName && st.name && String(r.studentName).trim().toLowerCase() === String(st.name).trim().toLowerCase())
                                  ) || (rec?.studentId === st.id ? rec : null);

                                let marker = '';
                                let markerClass = '';
                                let titleText = `Ngày ${dStr}: Chưa có dữ liệu`;

                                if (sRec) {
                                  const stStatus = String(sRec.status || '').toLowerCase();
                                  if (stStatus === 'present' || stStatus === 'late' || stStatus.includes('có mặt')) {
                                    attendedCount++;
                                    marker = 'X';
                                    markerClass = 'font-black text-[#0B486B] text-xs';
                                    titleText = `Ngày ${dStr}: Có mặt (tính tiền)`;
                                  } else if (stStatus === 'excused' || stStatus.includes('phép')) {
                                    marker = 'P';
                                    markerClass = 'font-bold text-[#F39C12] text-[11px]';
                                    titleText = `Ngày ${dStr}: Vắng có phép`;
                                  } else if (stStatus === 'unexcused' || stStatus === 'absent' || stStatus.includes('không phép')) {
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

                      {/* Hàng TỔNG CỘNG LỚP */}
                      <tfoot>
                        <tr className="bg-slate-100 font-extrabold text-slate-800 border-t-2 border-slate-300 divide-x divide-slate-300">
                          <td
                            colSpan={2}
                            className="py-2.5 px-3 text-left sticky left-0 bg-slate-100 z-20 font-black text-[#0B486B]"
                          >
                            TỔNG CỘNG LỚP
                          </td>
                          <td className="py-2.5 px-2 text-left sticky left-[210px] bg-slate-100 z-20 text-[11px] text-slate-600 font-bold">
                            {classStudents.length} HS
                          </td>
                          {daysInMonthList.map((d) => {
                            const dStr = d.toString().padStart(2, '0');
                            const iso = `${selectedMonth}-${dStr}`;
                            const rec = monthlyRecords.find(
                              (r) => (r.date || r.sessionDate) === iso
                            );
                            const presentCountForDay = (rec?.records || []).filter(
                              (r: any) => {
                                const stStatus = String(r.status || '').toLowerCase();
                                return stStatus === 'present' || stStatus === 'late' || stStatus.includes('có mặt');
                              }
                            ).length;
                            return (
                              <td
                                key={d}
                                className="py-2 px-1 text-center text-[11px] font-black text-[#0B486B]"
                              >
                                {presentCountForDay > 0 ? presentCountForDay : '—'}
                              </td>
                            );
                          })}
                          {/* Tổng số lượt có mặt cả lớp */}
                          <td className="py-2.5 px-2 text-center font-black text-[#0072B5] bg-blue-100/50">
                            {classStudents.reduce((acc, st) => {
                              return (
                                acc +
                                calculateStudentMonthlyAttendedSessions({
                                  month: selectedMonth,
                                  student: st,
                                  attendanceRecords: monthlyRecords,
                                  classInfo: cls,
                                })
                              );
                            }, 0)}
                          </td>
                          {/* Tổng tiền học phí cả lớp trong tháng - Ẩn đối với giáo viên, chỉ hiển thị đối với center_admin */}
                          {showFinancials && (
                            <td className="py-2.5 px-3 text-right font-black text-emerald-900 bg-emerald-100/60 text-xs">
                              {classStudents
                                .reduce((acc, st) => {
                                  const attended = calculateStudentMonthlyAttendedSessions({
                                    month: selectedMonth,
                                    student: st,
                                    attendanceRecords: monthlyRecords,
                                    classInfo: cls,
                                  });
                                  return acc + attended * pricePerSession;
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

                {/* 3. Phần Chú thích ký hiệu & Công thức tính (Đúng như ảnh mẫu) */}
                <div className="pt-2 text-xs text-slate-600 space-y-1.5 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="font-bold text-slate-700">Ký hiệu:</span>
                    <span className="inline-flex items-center gap-1.5 font-bold">
                      <span className="w-5 h-5 rounded-md bg-blue-100 text-[#0B486B] font-black inline-flex items-center justify-center text-xs">
                        X
                      </span>
                      <span>Có mặt (tính tiền)</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-bold">
                      <span className="w-5 h-5 rounded-md bg-amber-100 text-[#F39C12] font-black inline-flex items-center justify-center text-xs">
                        P
                      </span>
                      <span>Vắng có phép</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-bold">
                      <span className="w-5 h-5 rounded-md bg-rose-100 text-[#E74C3C] font-black inline-flex items-center justify-center text-xs">
                        K
                      </span>
                      <span>Vắng không phép</span>
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 italic">
                    * Ô trống: Ngày không có buổi học hoặc chưa ghi nhận điểm danh trên Firebase
                  </p>
                  {/* Công thức tính Tổng tiền - Ẩn đối với giáo viên, chỉ hiển thị đối với center_admin */}
                  {showFinancials && (
                    <p className="text-[11px] font-semibold text-slate-700">
                      Công thức: Tổng tiền = Tổng buổi có mặt &times; Đơn giá (
                      {pricePerSession.toLocaleString('vi-VN')} đ/buổi)
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL XUẤT FILE EXCEL TỔNG HỢP (TẤT CẢ CÁC LỚP, MỖI LỚP 1 SHEET) */}
      <ExportMonthlyExcelModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        classes={centerClasses}
        teachers={teachers}
        students={students}
        attendanceRecords={effectiveAttendanceRecords}
        pricesMap={pricesMap}
        showFinancials={showFinancials}
        initialMonth={selectedMonth}
        centerName={currentCenterName}
      />
    </div>
  );
};
