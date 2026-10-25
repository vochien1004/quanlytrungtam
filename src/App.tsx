/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Header, UserRole } from './components/Header';
import { Sidebar, NavItemKey } from './components/Sidebar';
import { AdminSystemCard } from './components/AdminSystemCard';
import { LoginPage } from './components/LoginPage';
import type { EntityType } from './components/admin/EditEntityModal';

// Tối ưu hóa khởi động: Lazy loading các view và modal nặng để tải trang tức thì
const AdminManagementHub = lazy(() => import('./components/admin/AdminManagementHub').then(m => ({ default: m.AdminManagementHub })));
const CenterManagementView = lazy(() => import('./components/admin/CenterManagementView').then(m => ({ default: m.CenterManagementView })));
const PaymentSettingsView = lazy(() => import('./components/admin/PaymentSettingsView').then(m => ({ default: m.PaymentSettingsView })));
const SuperAdminPortalView = lazy(() => import('./components/admin/SuperAdminPortalView').then(m => ({ default: m.SuperAdminPortalView })));
const TeacherWorkstationHub = lazy(() => import('./components/teacher/TeacherWorkstationHub').then(m => ({ default: m.TeacherWorkstationHub })));
const ParentPortalView = lazy(() => import('./components/views/ParentPortalView').then(m => ({ default: m.ParentPortalView })));
const ReportsView = lazy(() => import('./components/views/ReportsView').then(m => ({ default: m.ReportsView })));
const SettingsView = lazy(() => import('./components/views/SettingsView').then(m => ({ default: m.SettingsView })));
const AccountsManagementView = lazy(() => import('./components/views/AccountsManagementView').then(m => ({ default: m.AccountsManagementView })));

const ClassModal = lazy(() => import('./components/ClassModal').then(m => ({ default: m.ClassModal })));
const TeacherModal = lazy(() => import('./components/TeacherModal').then(m => ({ default: m.TeacherModal })));
const StudentModal = lazy(() => import('./components/StudentModal').then(m => ({ default: m.StudentModal })));
const AssignmentModal = lazy(() => import('./components/AssignmentModal').then(m => ({ default: m.AssignmentModal })));
const HistoryModal = lazy(() => import('./components/HistoryModal').then(m => ({ default: m.HistoryModal })));
const NotificationModal = lazy(() => import('./components/NotificationModal').then(m => ({ default: m.NotificationModal })));
const EditEntityModal = lazy(() => import('./components/admin/EditEntityModal').then(m => ({ default: m.EditEntityModal })));
const ExcelImportModal = lazy(() => import('./components/admin/ExcelImportModal').then(m => ({ default: m.ExcelImportModal })));

const ViewLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[380px] w-full p-8 space-y-4">
    <div className="relative flex items-center justify-center">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0072B5] to-[#00A86B] animate-spin opacity-80 blur-xs" />
      <div className="absolute w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md border border-slate-100">
        <div className="w-5 h-5 rounded-lg border-2 border-[#0072B5] border-t-transparent animate-spin" />
      </div>
    </div>
    <div className="text-center space-y-1">
      <p className="text-xs font-bold text-slate-700">Đang chuẩn bị không gian làm việc...</p>
      <p className="text-[11px] text-slate-400 font-medium">Hệ thống đang tải dữ liệu và tối ưu hiển thị</p>
    </div>
  </div>
);

import {
  ClassItem,
  TeacherItem,
  StudentItem,
  AssignmentItem,
  AttendanceStatus,
} from './data/mockData';

import {
  CenterItem,
  DEFAULT_CENTER_ID,
  createCenter,
  updateCenter,
  getRealtimeCenters,
  createClass,
  updateClass,
  deleteClass,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  createStudent,
  updateStudent,
  deleteStudent,
  getRealtimeClasses,
  getRealtimeTeachers,
  getRealtimeStudents,
  getRealtimeAssignments,
  getRealtimeAttendance,
  saveDailyAttendance,
  createAssignment,
  submitGrade,
  ensureAuthSession,
  switchUserRole,
  SystemRole,
  resolveValidCenterId,
  areSameTeacher,
  getValidTeacherName,
  isTeacherRole,
  isParentRole,
} from './services/firebaseService';

import {
  UserAccount,
  getStoredSession,
  setStoredSession,
  clearStoredSession,
  ensureDefaultAccountsInFirestore,
  ensureSuperAdminInFirestore,
  cleanupDeprecatedCollections,
  listenToCurrentUserProfile,
  purgeLocalTestCache,
} from './services/authService';

import { 
  Menu, 
  CheckCircle2, 
  Info, 
  AlertTriangle,
  LayoutDashboard,
  School,
  Users,
  GraduationCap,
  ClipboardCheck,
  BookMarked,
  Award,
  Bell,
  HeartHandshake,
  CalendarCheck,
  MessageSquare,
  AlertCircle,
  Phone,
  Crown
} from 'lucide-react';
import { CenterRenewalModal } from './components/admin/CenterRenewalModal';

export default function App() {
  // Authentication & Session State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getStoredSession());
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const stored = getStoredSession();
    if (stored?.role === 'super_admin' || stored?.role === 'center_admin') return 'admin';
    if (isTeacherRole(stored?.role)) return 'teacher';
    if (isParentRole(stored?.role)) return 'parent';
    return stored ? (stored.role as UserRole) : 'admin';
  });
  const [activeNav, setActiveNav] = useState<NavItemKey>(() => {
    const stored = getStoredSession();
    if (stored?.role === 'super_admin') return 'super-admin-portal';
    if (isTeacherRole(stored?.role)) return 'teacher-attendance';
    if (isParentRole(stored?.role)) return 'parent-attendance';
    return 'dashboard';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Multi-Tenant Center State
  const [centers, setCenters] = useState<CenterItem[]>([]);
  const [activeCenterId, setActiveCenterId] = useState<string>(() => {
    const stored = getStoredSession();
    if (!stored) return '';
    return stored.centerId || (stored.role === 'super_admin' ? DEFAULT_CENTER_ID : '');
  });

  // Core Data backed by Realtime Firestore Sub-collections
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);

  // Firebase connection state
  const [isFirebaseSyncing, setIsFirebaseSyncing] = useState<boolean>(true);

  // Selected state for Teacher view
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [isRenewalModalOpen, setIsRenewalModalOpen] = useState<boolean>(false);
  const [openRenewalListTrigger, setOpenRenewalListTrigger] = useState<number>(0);

  // Modals
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentItem | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

  // Admin Specific Modals
  const [editingEntityType, setEditingEntityType] = useState<EntityType>('class');
  const [editingEntityData, setEditingEntityData] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [importingEntityType, setImportingEntityType] = useState<EntityType>('student');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // ============================================================================
  // FIREBASE FIRESTORE REALTIME SUBSCRIPTIONS (MULTI-TENANT SUB-COLLECTIONS)
  // ============================================================================

  // 0. Khởi động ứng dụng: Dọn sạch cache cục bộ tài khoản test và đồng bộ Firestore
  useEffect(() => {
    purgeLocalTestCache();
    ensureDefaultAccountsInFirestore().catch(() => {});
  }, []);

  // 1. Listen to Root Collection `/centers` & Ensure Super Admin / Center Admin access
  useEffect(() => {
    const unsubCenters = getRealtimeCenters((realtimeCenters) => {
      setCenters(realtimeCenters);
      if (currentUser?.centerId) {
        setActiveCenterId(currentUser.centerId);
      } else if (currentUser?.role === 'super_admin' && realtimeCenters.length > 0 && (!activeCenterId || !realtimeCenters.some((c) => c.id === activeCenterId))) {
        setActiveCenterId(realtimeCenters[0].id);
      }

      // Kiểm tra đối chiếu nếu tài khoản đang đăng nhập chính là Chủ cơ sở / Quản trị viên của trung tâm
      if (currentUser && currentUser.role !== 'super_admin') {
        const cleanU = String(currentUser.username || '').trim().toLowerCase().replace(/^@+/, '');
        const uUid = String(currentUser.uid || currentUser.id || '').trim();
        const ownedCenter = realtimeCenters.find(
          (c) =>
            (uUid && (c.adminUid === uUid || c.ownerUid === uUid)) ||
            (cleanU &&
              ((c.adminUsername && String(c.adminUsername).trim().toLowerCase().replace(/^@+/, '') === cleanU) ||
                (c.code && String(c.code).trim().toLowerCase() === cleanU)))
        );
        if (ownedCenter && currentUser.role !== 'center_admin') {
          const healedUser: UserAccount = {
            ...currentUser,
            role: 'center_admin',
            centerId: currentUser.centerId || ownedCenter.id,
            centerName: currentUser.centerName || ownedCenter.name,
          };
          setCurrentUser(healedUser);
          setStoredSession(healedUser);
          setCurrentRole('admin');
          setActiveNav('dashboard');
        }
      }
    });

    return () => {
      if (unsubCenters) unsubCenters();
    };
  }, [currentUser?.centerId, currentUser?.role, currentUser?.uid, currentUser?.username]);

  // 1.5. Lắng nghe Realtime hồ sơ chi tiết của người dùng đang đăng nhập tại `/users/{uid}`
  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsubProfile = listenToCurrentUserProfile(
      currentUser.centerId || '',
      currentUser.uid,
      (updatedProfile) => {
        if (!updatedProfile) return;

        // Nếu tài khoản bị tạm khóa từ phía quản trị viên, tự động đăng xuất
        if (updatedProfile.status !== 'active') {
          handleLogout();
          showToast('Tài khoản của bạn đã bị khóa bởi Quản trị viên!', 'error');
          return;
        }

        // Cập nhật thông tin mới nhất vào session state & đồng bộ tức thì currentRole
        setCurrentUser((prev) => {
          const merged = prev ? { ...prev, ...updatedProfile } : updatedProfile;
          setStoredSession(merged);
          return merged;
        });

        if (updatedProfile.role === 'super_admin' || updatedProfile.role === 'center_admin') {
          setCurrentRole('admin');
        } else if (isTeacherRole(updatedProfile.role)) {
          setCurrentRole('teacher');
        } else if (isParentRole(updatedProfile.role)) {
          setCurrentRole('parent');
        }
      }
    );

    return () => {
      if (unsubProfile) unsubProfile();
    };
  }, [currentUser?.uid, currentUser?.centerId]);

  // 2. Listen to Sub-collections `/centers/{effectiveCenterId}/*`
  // QUY TẮC BẮT BUỘC: Tuyệt đối không query dữ liệu lớp/học sinh nếu chưa lấy được centerId từ document /users/${uid}
  useEffect(() => {
    let isMounted = true;
    let unsubClasses: (() => void) | null = null;
    let unsubTeachers: (() => void) | null = null;
    let unsubStudents: (() => void) | null = null;
    let unsubAssignments: (() => void) | null = null;
    let unsubAttendance: (() => void) | null = null;

    // KIỂM TRA CHẶT CHẼ: Chưa đăng nhập hoặc chưa có centerId từ /users/{uid} -> KHÔNG QUERY
    if (!currentUser) {
      setClasses([]);
      setTeachers([]);
      setStudents([]);
      setAssignments([]);
      setAttendanceRecords([]);
      setIsFirebaseSyncing(false);
      return;
    }

    const effectiveCenterId = (currentUser.role === 'super_admin' ? (activeCenterId || currentUser.centerId) : currentUser.centerId)?.trim();
    if (!effectiveCenterId) {
      setClasses([]);
      setTeachers([]);
      setStudents([]);
      setAssignments([]);
      setAttendanceRecords([]);
      setIsFirebaseSyncing(false);
      return;
    }

    setIsFirebaseSyncing(true);

    const setupSubscriptions = () => {
      if (unsubClasses) unsubClasses();
      if (unsubTeachers) unsubTeachers();
      if (unsubStudents) unsubStudents();
      if (unsubAssignments) unsubAssignments();
      if (unsubAttendance) unsubAttendance();

      // Sub-collection 1: Classes (/centers/{centerId}/classes)
      unsubClasses = getRealtimeClasses(effectiveCenterId, (realtimeClasses) => {
        if (isMounted) {
          setClasses(realtimeClasses);
          if (realtimeClasses.length > 0 && (!selectedClassId || !realtimeClasses.some((c) => c.id === selectedClassId))) {
            setSelectedClassId(realtimeClasses[0].id);
          }
          setIsFirebaseSyncing(false);
        }
      });

      // Sub-collection 2: Teachers (/centers/{centerId}/teachers)
      unsubTeachers = getRealtimeTeachers(effectiveCenterId, (realtimeTeachers) => {
        if (isMounted) {
          const unique = (realtimeTeachers || []).filter((tc, idx, arr) => {
            if (!tc) return false;
            return arr.findIndex((x) => areSameTeacher(x, tc)) === idx;
          });
          setTeachers(unique);
        }
      });

      // Sub-collection 3: Students (/centers/{centerId}/students)
      unsubStudents = getRealtimeStudents(effectiveCenterId, (realtimeStudents) => {
        if (isMounted) setStudents(realtimeStudents);
      });

      // Sub-collection 4: Assignments (/centers/{centerId}/assignments)
      unsubAssignments = getRealtimeAssignments(effectiveCenterId, (realtimeAssignments) => {
        if (isMounted) setAssignments(realtimeAssignments);
      });

      // Sub-collection 5: Attendance (/centers/{centerId}/attendance)
      unsubAttendance = getRealtimeAttendance(effectiveCenterId, (realtimeAttendance) => {
        if (isMounted) setAttendanceRecords(realtimeAttendance);
      });
    };

    setupSubscriptions();

    return () => {
      isMounted = false;
      if (unsubClasses) unsubClasses();
      if (unsubTeachers) unsubTeachers();
      if (unsubStudents) unsubStudents();
      if (unsubAssignments) unsubAssignments();
      if (unsubAttendance) unsubAttendance();
    };
  }, [currentUser?.uid, currentUser?.centerId, activeCenterId, currentUser?.role]);

  // ============================================================================
  // EVENT HANDLERS & FIRESTORE SUB-COLLECTION ACTIONS
  // ============================================================================

  const handleRoleChange = async (role: UserRole) => {
    setCurrentRole(role);
    if (role === 'admin') {
      setActiveNav('dashboard');
    } else if (role === 'teacher') {
      setActiveNav('teacher-attendance');
    } else {
      setActiveNav('parent-attendance');
    }

    try {
      await switchUserRole(role as SystemRole);
    } catch (err: any) {
      console.warn('Lỗi switchUserRole:', err.message);
    }
  };

  const handleUpdateAttendance = async (studentId: string, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, attendanceStatus: status } : s))
    );
    const targetStudent = students.find((s) => s.id === studentId);
    showToast(`Đang cập nhật em ${targetStudent?.name || ''}: ${status === 'present' ? 'Có mặt' : 'Vắng'}`);

    if (currentRole === 'admin') {
      try {
        await updateStudent(activeCenterId, studentId, { attendanceStatus: status });
      } catch (err: any) {
        console.error('Lỗi cập nhật student:', err);
      }
    }
  };

  const getTargetCenterId = () => {
    return (activeCenterId || currentUser?.centerId || (centers.length > 0 ? centers[0].id : '')).trim();
  };

  const handleSaveClass = async (newClassData: Omit<ClassItem, 'id'>) => {
    try {
      const targetCenterId = getTargetCenterId();
      const docId = await createClass(targetCenterId, newClassData);
      
      // Đồng bộ tức thì vào state classes để hiển thị ngay trên giao diện
      const newClassItem: ClassItem = {
        id: docId,
        centerId: targetCenterId,
        classCode: newClassData.classCode || `LH-${docId.slice(0, 4).toUpperCase()}`,
        name: newClassData.name,
        subject: newClassData.subject,
        teacherId: newClassData.teacherId || '',
        teacherName: newClassData.teacherName || 'Chưa phân công',
        room: newClassData.room || 'Phòng học',
        schedule: newClassData.schedule || 'Lịch linh hoạt',
        studentCount: Number(newClassData.studentCount) || 0,
        maxCapacity: Number(newClassData.maxCapacity) || 25,
        pricePerSession: newClassData.pricePerSession !== undefined ? Number(newClassData.pricePerSession) : 40000,
        status: newClassData.status || 'active',
      };
      setClasses((prev) => {
        const exists = prev.some((c) => c.id === docId);
        return exists ? prev : [newClassItem, ...prev];
      });
      if (!selectedClassId) {
        setSelectedClassId(docId);
      }

      showToast(`✓ Đã thêm lớp "${newClassData.name}" vào trung tâm thành công!`, 'success');

      // Đồng bộ liên kết 2 chiều với giáo viên nếu có chỉ định giáo viên phụ trách
      if (newClassData.teacherId) {
        setTeachers((prev) =>
          prev.map((t) =>
            t.id === newClassData.teacherId
              ? { ...t, mainClassId: docId, mainClassName: newClassData.name }
              : t
          )
        );
      }

      return docId;
    } catch (err: any) {
      showToast(`Lỗi khi tạo lớp: ${err.message}`, 'error');
      throw err;
    }
  };

  // Cập nhật đơn giá/buổi học và đồng bộ trực tiếp lên Firebase Firestore
  const handleUpdateClassPrice = async (classId: string, newPrice: number) => {
    try {
      const targetCenterId = getTargetCenterId();
      await updateClass(targetCenterId, classId, { pricePerSession: newPrice });
      setClasses((prev) =>
        prev.map((c) => (c.id === classId ? { ...c, pricePerSession: newPrice } : c))
      );
      showToast(`✓ Đã cập nhật đơn giá ${newPrice.toLocaleString('vi-VN')} đ/buổi và đồng bộ Firebase!`, 'success');
    } catch (err: any) {
      showToast(`Lỗi khi cập nhật đơn giá lớp học: ${err.message}`, 'error');
      throw err;
    }
  };

  const handleAddTeacher = async (newTeacherData: Omit<TeacherItem, 'id'> & { centerId?: string }) => {
    try {
      const targetCenterId = (newTeacherData.centerId || getTargetCenterId()).trim();
      const createdTeacher = await createTeacher(targetCenterId, newTeacherData);
      
      // Đồng bộ tức thời vào state teachers để hiển thị ngay trên bảng và cập nhật số lượng
      const newTeacherItem: TeacherItem = {
        ...newTeacherData,
        id: createdTeacher?.id || createdTeacher?.uid || `teacher_${Date.now()}`,
        centerId: targetCenterId,
        teacherCode: createdTeacher?.teacherCode || newTeacherData.teacherCode || `GV-${Date.now().toString().slice(-3)}`,
        name: newTeacherData.name || 'Giáo viên mới',
        fullName: newTeacherData.fullName || newTeacherData.name || 'Giáo viên mới',
        username: newTeacherData.username || `gv_${Date.now().toString().slice(-4)}`,
        password: newTeacherData.password || '123',
        subject: newTeacherData.subject || 'Toán học',
        phone: newTeacherData.phone || '',
        email: newTeacherData.email || '',
        mainClassId: newTeacherData.mainClassId || '',
        mainClassName: newTeacherData.mainClassName || '',
        bio: newTeacherData.bio || 'Giáo viên tận tâm, vững chuyên môn nghiệp vụ sư phạm.',
        avatar: newTeacherData.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
        status: newTeacherData.status || 'active',
      };
      setTeachers((prev) => {
        const filtered = prev.filter((t) => !areSameTeacher(t, newTeacherItem));
        return [newTeacherItem, ...filtered];
      });

      // Đồng bộ liên kết 2 chiều vào state classes cho tất cả các lớp đảm nhận
      const assignedIds = Array.isArray(newTeacherData.assignedClassIds) && newTeacherData.assignedClassIds.length > 0
        ? newTeacherData.assignedClassIds
        : newTeacherData.mainClassId ? [newTeacherData.mainClassId] : [];

      if (assignedIds.length > 0) {
        setClasses((prev) =>
          prev.map((c) =>
            assignedIds.includes(c.id)
              ? {
                  ...c,
                  teacherId: createdTeacher?.id || newTeacherItem.id,
                  teacherName: newTeacherData.name || 'Giáo viên',
                  teacherPhone: newTeacherData.phone || c.teacherPhone,
                }
              : c
          )
        );
      }

      showToast(`✓ Đã thêm giáo viên ${newTeacherData.name} và đồng bộ ${assignedIds.length} lớp đảm nhận!`, 'success');
      return createdTeacher?.id || createdTeacher?.uid || createdTeacher;
    } catch (err: any) {
      showToast(`Lỗi khi thêm giáo viên: ${err.message}`, 'error');
      throw err;
    }
  };

  const handleAddStudent = async (newStudentData: Omit<StudentItem, 'id'> & { centerId?: string }) => {
    try {
      const targetCenterId = (newStudentData.centerId || getTargetCenterId()).trim();
      const docId = await createStudent(targetCenterId, newStudentData);

      // Đồng bộ tức thời vào state students để hiển thị ngay trên bảng và cập nhật sĩ số
      const newStudentItem: StudentItem = {
        ...newStudentData,
        id: docId,
        centerId: targetCenterId,
        studentCode: newStudentData.studentCode || `HS-${docId.slice(0, 4).toUpperCase()}`,
        name: newStudentData.name || 'Học sinh mới',
        classId: newStudentData.classId || '',
        className: newStudentData.className || 'Lớp học',
        avatar: newStudentData.avatar || (newStudentData.gender === 'Nữ'
          ? 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80'),
        attendanceStatus: newStudentData.attendanceStatus || 'present',
        note: newStudentData.note || 'Học sinh mới tiếp nhận',
        parentName: newStudentData.parentName || `Phụ huynh em ${newStudentData.name}`,
        parentPhone: newStudentData.parentPhone || '',
        parentEmail: newStudentData.parentEmail || '',
        username: newStudentData.username || '',
        gender: newStudentData.gender || 'Nam',
        dob: newStudentData.dob || '',
        gpa: Number(newStudentData.gpa) || 8.0,
        recentGrade: newStudentData.recentGrade || `${Number(newStudentData.gpa) || 8.0} / 10`,
        status: newStudentData.status || 'active',
      };

      setStudents((prev) => {
        const exists = prev.some((s) => s.id === docId);
        return exists ? prev : [newStudentItem, ...prev];
      });

      // Tự động cập nhật tăng sĩ số lớp nếu học sinh đã được xếp lớp
      if (newStudentData.classId) {
        setClasses((prev) =>
          prev.map((c) =>
            c.id === newStudentData.classId
              ? { ...c, studentCount: (Number(c.studentCount) || 0) + 1 }
              : c
          )
        );
      }

      setActiveNav('admin-students');
      showToast(`✓ Đã tiếp nhận học sinh ${newStudentData.name} vào trung tâm!`, 'success');
      return docId;
    } catch (err: any) {
      showToast(`Lỗi khi thêm học sinh: ${err.message}`, 'error');
      throw err;
    }
  };

  const handleOpenEdit = (type: EntityType, entity: any) => {
    setEditingEntityType(type);
    setEditingEntityData(entity);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedEntity = async (updatedData: any) => {
    try {
      const targetCenterId = getTargetCenterId();
      if (editingEntityType === 'class') {
        const oldTeacherId = editingEntityData?.teacherId;
        const newTeacherId = updatedData.teacherId;

        await updateClass(targetCenterId, updatedData.id, updatedData);
        setClasses((prev) =>
          prev.map((c) => (c.id === updatedData.id ? { ...c, ...updatedData } : c))
        );

        // Đồng bộ liên kết 2 chiều với giáo viên
        if (newTeacherId) {
          setTeachers((prev) =>
            prev.map((tc) => {
              if (tc.id === newTeacherId) {
                return { ...tc, mainClassId: updatedData.id, mainClassName: updatedData.name };
              }
              if (oldTeacherId && oldTeacherId !== newTeacherId && tc.id === oldTeacherId) {
                return { ...tc, mainClassId: '', mainClassName: '' };
              }
              return tc;
            })
          );
        } else if (oldTeacherId) {
          setTeachers((prev) =>
            prev.map((tc) =>
              tc.id === oldTeacherId ? { ...tc, mainClassId: '', mainClassName: '' } : tc
            )
          );
        }

        showToast(`✓ Đã cập nhật lớp "${updatedData.name}"!`);
      } else if (editingEntityType === 'teacher') {
        const oldClassIds: string[] = Array.isArray(editingEntityData?.assignedClassIds) && editingEntityData.assignedClassIds.length > 0
          ? editingEntityData.assignedClassIds
          : editingEntityData?.mainClassId ? [editingEntityData.mainClassId] : [];
        const newClassIds: string[] = Array.isArray(updatedData.assignedClassIds)
          ? updatedData.assignedClassIds
          : updatedData.mainClassId ? [updatedData.mainClassId] : [];

        await updateTeacher(targetCenterId, updatedData.id, updatedData);
        setTeachers((prev) =>
          prev.map((t) => (t.id === updatedData.id ? { ...t, ...updatedData } : t))
        );

        // Đồng bộ liên kết 2 chiều với TẤT CẢ các lớp học đảm nhận
        setClasses((prev) =>
          prev.map((cls) => {
            if (newClassIds.includes(cls.id)) {
              return {
                ...cls,
                teacherId: updatedData.id,
                teacherName: updatedData.name || 'Giáo viên',
                teacherPhone: updatedData.phone || cls.teacherPhone,
              };
            }
            if (oldClassIds.includes(cls.id) && !newClassIds.includes(cls.id) && cls.teacherId === updatedData.id) {
              return {
                ...cls,
                teacherId: '',
                teacherName: 'Chưa phân công',
              };
            }
            return cls;
          })
        );

        showToast(`✓ Đã cập nhật giáo viên "${updatedData.name}" và đồng bộ ${newClassIds.length} lớp đảm nhận!`, 'success');
      } else if (editingEntityType === 'student') {
        await updateStudent(targetCenterId, updatedData.id, updatedData);
        setStudents((prev) =>
          prev.map((s) => (s.id === updatedData.id ? { ...s, ...updatedData } : s))
        );
        showToast(`✓ Đã cập nhật học sinh "${updatedData.name}"!`);
      }
    } catch (err: any) {
      showToast(`Lỗi cập nhật: ${err.message}`, 'error');
    }
  };

  const handleDeleteEntity = async (type: EntityType, id: string) => {
    try {
      const targetCenterId = getTargetCenterId();
      if (type === 'class') {
        await deleteClass(targetCenterId, id);
        setClasses((prev) => prev.filter((c) => c.id !== id));
        showToast('✓ Đã xóa lớp học!');
      } else if (type === 'teacher') {
        await deleteTeacher(targetCenterId, id);
        setTeachers((prev) => prev.filter((t) => t.id !== id && (t as any).uid !== id && !areSameTeacher(t, { id, uid: id })));
        setClasses((prev) =>
          prev.map((c) => (c.teacherId === id ? { ...c, teacherId: '', teacherName: 'Chưa phân công' } : c))
        );
        showToast('✓ Đã xóa giáo viên!');
      } else if (type === 'student') {
        const deletedStudent = students.find((s) => s.id === id);
        await deleteStudent(targetCenterId, id);
        setStudents((prev) => prev.filter((s) => s.id !== id));
        if (deletedStudent?.classId) {
          setClasses((prev) =>
            prev.map((c) =>
              c.id === deletedStudent.classId
                ? { ...c, studentCount: Math.max(0, (Number(c.studentCount) || 1) - 1) }
                : c
            )
          );
        }
        showToast('✓ Đã xóa học sinh!');
      }
    } catch (err: any) {
      showToast(`Lỗi khi xóa: ${err.message}`, 'error');
    }
  };

  const handleOpenImportModal = (type: EntityType) => {
    setImportingEntityType(type);
    setIsImportModalOpen(true);
  };

  const handleBatchImport = async (items: any[]) => {
    try {
      const targetCenterId = getTargetCenterId();
      showToast(`Đang nạp ${items.length} bản ghi vào sub-collection trung tâm...`, 'info');

      if (importingEntityType === 'class') {
        const addedClasses: ClassItem[] = [];
        for (const item of items) {
          const docId = await createClass(targetCenterId, item);
          addedClasses.push({
            ...item,
            id: docId,
            centerId: targetCenterId,
            classCode: item.classCode || `LH-${docId.slice(0, 4).toUpperCase()}`,
            name: item.name || 'Lớp mới',
            subject: item.subject || 'Môn học',
            teacherId: item.teacherId || '',
            teacherName: item.teacherName || 'Chưa phân công',
            room: item.room || 'Phòng học',
            schedule: item.schedule || 'Lịch linh hoạt',
            studentCount: Number(item.studentCount) || 0,
            maxCapacity: Number(item.maxCapacity) || 25,
            pricePerSession: item.pricePerSession !== undefined ? Number(item.pricePerSession) : 40000,
            status: item.status || 'active',
          });
        }
        setClasses((prev) => [...addedClasses, ...prev]);
      } else if (importingEntityType === 'teacher') {
        const addedTeachers: TeacherItem[] = [];
        for (const item of items) {
          const created = await createTeacher(targetCenterId, item);
          const tId = created?.id || created?.uid || `teacher_${Date.now()}`;
          addedTeachers.push({
            ...item,
            id: tId,
            centerId: targetCenterId,
            teacherCode: created?.teacherCode || item.teacherCode || `GV-${Date.now().toString().slice(-3)}`,
            name: item.name || 'Giáo viên mới',
            fullName: item.fullName || item.name || 'Giáo viên mới',
            username: item.username || `gv_${Date.now().toString().slice(-4)}`,
            password: item.password || '123',
            subject: item.subject || 'Toán học',
            phone: item.phone || '',
            email: item.email || '',
            mainClassId: item.mainClassId || '',
            mainClassName: item.mainClassName || '',
            bio: item.bio || 'Giáo viên giảng dạy.',
            avatar: item.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
            status: item.status || 'active',
          });
        }
        setTeachers((prev) => [...addedTeachers, ...prev]);
      } else if (importingEntityType === 'student') {
        const addedStudents: StudentItem[] = [];
        for (const item of items) {
          const docId = await createStudent(targetCenterId, item);
          addedStudents.push({
            ...item,
            id: docId,
            centerId: targetCenterId,
            studentCode: item.studentCode || `HS-${docId.slice(0, 4).toUpperCase()}`,
            name: item.name || 'Học sinh mới',
            classId: item.classId || '',
            className: item.className || 'Lớp học',
            avatar: item.avatar || (item.gender === 'Nữ'
              ? 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80'
              : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80'),
            attendanceStatus: item.attendanceStatus || 'present',
            note: item.note || 'Nhập từ file Excel',
            parentName: item.parentName || `Phụ huynh em ${item.name}`,
            parentPhone: item.parentPhone || '',
            parentEmail: item.parentEmail || '',
            username: item.username || '',
            gender: item.gender || 'Nam',
            gpa: Number(item.gpa) || 8.0,
            recentGrade: item.recentGrade || `${Number(item.gpa) || 8.0} / 10`,
            status: item.status || 'active',
          });
        }
        setStudents((prev) => [...addedStudents, ...prev]);
        setActiveNav('admin-students');
      } else if (importingEntityType === 'teacher') {
        setActiveNav('admin-teachers');
      } else if (importingEntityType === 'class') {
        setActiveNav('admin-classes');
      }

      showToast(`✓ Đã nạp và đồng bộ thành công ${items.length} bản ghi vào hệ thống!`, 'success');
    } catch (err: any) {
      showToast(`Lỗi khi nạp dữ liệu: ${err.message}`, 'error');
    }
  };

  const handleLogout = () => {
    clearStoredSession();
    setCurrentUser(null);
    setActiveCenterId('');
    setClasses([]);
    setTeachers([]);
    setStudents([]);
    setAssignments([]);
    showToast('Đã đăng xuất khỏi hệ thống.', 'info');
  };

  const handleTeacherSyncToAdmin = async (sessionData: any) => {
    try {
      const targetCenterId = (sessionData.centerId || getTargetCenterId()).trim();
      if (!targetCenterId) {
        console.warn('handleTeacherSyncToAdmin: Không tìm thấy targetCenterId hợp lệ');
        return;
      }
      const todayStr = sessionData.sessionDate || sessionData.date || new Date().toISOString().split('T')[0];
      
      const attendanceData = {
        classId: sessionData.classId || selectedClassId,
        className: sessionData.className,
        date: todayStr,
        sessionMonth: sessionData.sessionMonth,
        teacherName: sessionData.teacherName,
        teacherId: sessionData.teacherId,
        records: sessionData.records || students
          .filter((s) => s.classId === (sessionData.classId || selectedClassId))
          .map((s) => ({
            studentId: s.id,
            studentName: s.name,
            status: s.attendanceStatus,
            note: sessionData.remarks ? sessionData.remarks[s.id] || s.note : s.note,
          })),
        totalCount: sessionData.totalCount,
        presentCount: sessionData.presentCount,
        excusedCount: sessionData.excusedCount,
        unexcusedCount: sessionData.unexcusedCount,
        generalNote: sessionData.generalNote || `Tổng số: ${sessionData.totalCount}, Có mặt: ${sessionData.presentCount}`,
      };

      const effectiveRole = isTeacherRole(currentRole) || isTeacherRole(currentUser?.role) ? 'teacher' : (currentRole as SystemRole);
      const recordId = sessionData.id || await saveDailyAttendance(targetCenterId, attendanceData, effectiveRole);

      // Optimistically update attendanceRecords in state
      setAttendanceRecords((prev) => {
        const itemWithId = { ...attendanceData, id: recordId, centerId: targetCenterId };
        const idx = prev.findIndex(
          (a) => a && (a.id === recordId || (a.classId === attendanceData.classId && a.date === attendanceData.date))
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = itemWithId;
          return next;
        }
        return [itemWithId, ...prev];
      });

      // Đồng bộ trạng thái học sinh trong lớp
      if (Array.isArray(attendanceData.records) && attendanceData.records.length > 0) {
        setStudents((prev) =>
          prev.map((s) => {
            const rec = attendanceData.records.find((r: any) => r.studentId === s.id);
            if (rec) {
              return {
                ...s,
                attendanceStatus: rec.status || s.attendanceStatus,
                note: rec.note !== undefined ? rec.note : s.note,
              };
            }
            return s;
          })
        );
      }

      showToast(`✓ Đã lưu điểm danh lớp ${sessionData.className} vào Firebase thành công!`, 'success');
    } catch (err: any) {
      showToast(`Lỗi đồng bộ: ${err.message}`, 'error');
      throw err;
    }
  };

  const handleTeacherAssignHomework = async (newAssignment: any) => {
    try {
      const asgId = await createAssignment(activeCenterId, newAssignment, currentRole as SystemRole);
      setAssignments((prev) => [...prev.filter((a) => a.id !== asgId), { ...newAssignment, id: asgId }]);
      showToast(`✓ Đã giao bài tập "${newAssignment.title}" cho lớp ${newAssignment.className || ''}!`, 'success');
    } catch (err: any) {
      showToast(`Lỗi giao bài tập: ${err.message}`, 'error');
      throw err;
    }
  };

  const handleTeacherGradeStudent = async (
    assignmentId: string,
    studentName: string,
    score: number,
    comment: string
  ) => {
    try {
      await submitGrade(activeCenterId, assignmentId, 'student-1', score, comment, currentRole as SystemRole);
      showToast(`✓ Đã cập nhật điểm ${score} điểm cho ${studentName}!`, 'success');
    } catch (err: any) {
      showToast(`Lỗi khi chấm điểm: ${err.message}`, 'error');
      throw err;
    }
  };

  const handleOpenAssignmentDetail = (asg: AssignmentItem) => {
    setSelectedAssignment(asg);
    setIsAssignmentModalOpen(true);
  };

  /**
   * Đồng bộ State và điều hướng khi Super Admin xóa toàn diện trung tâm
   */
  const handleDeleteCenterSuccess = (deletedCenterId: string) => {
    // 1. Lập tức lọc và loại bỏ trung tâm đó ra khỏi State danh sách trung tâm của app
    setCenters((prev) => prev.filter((c) => c.id !== deletedCenterId));

    // Dọn dẹp cache localStorage của trung tâm đã xóa
    try {
      localStorage.removeItem('tt_hocgioi_teachers_' + deletedCenterId);
      localStorage.removeItem('tt_hocgioi_students_' + deletedCenterId);
      localStorage.removeItem('tt_hocgioi_classes_' + deletedCenterId);
    } catch {}

    // 2. Nếu super_admin đang đứng ở trang chi tiết của trung tâm vừa bị xóa
    const remaining = centers.filter((c) => c.id !== deletedCenterId);
    if (activeCenterId === deletedCenterId) {
      setClasses([]);
      setTeachers([]);
      setStudents([]);
      if (remaining.length > 0) {
        setActiveCenterId(remaining[0].id);
      } else {
        setActiveCenterId('');
      }

      // Tự động điều hướng về trang danh sách trung tâm / Dashboard tổng quan
      if (currentUser?.role === 'super_admin' || currentUser?.username === 'admin') {
        setActiveNav('super-admin-portal');
      } else {
        setActiveNav('dashboard');
      }
    } else if (activeNav === 'admin-centers') {
      if (currentUser?.role === 'super_admin' || currentUser?.username === 'admin') {
        setActiveNav('super-admin-portal');
      } else {
        setActiveNav('dashboard');
      }
    }

    // 3. Hiển thị thông báo thành công
    showToast('Đã xóa hoàn toàn trung tâm và toàn bộ dữ liệu liên quan', 'success');
  };

  useEffect(() => {
    if (currentUser?.role === 'super_admin') {
      setActiveNav('super-admin-portal');
    } else {
      const isParent = isParentRole(currentUser?.role) || (!currentUser?.role && isParentRole(currentRole)) || (currentRole === 'parent' && currentUser?.role !== 'center_admin' && !isTeacherRole(currentUser?.role));
      const isTeacher = !isParent && (isTeacherRole(currentUser?.role) || (!currentUser?.role && isTeacherRole(currentRole)) || (currentRole === 'teacher' && currentUser?.role !== 'center_admin'));
      const isCenterAdmin = currentUser?.role === 'center_admin' || (!isTeacher && !isParent);
      if (activeNav === 'super-admin-portal') {
        setActiveNav(isParent ? 'parent-attendance' : isTeacher ? 'teacher-attendance' : 'dashboard');
      } else if (isParent) {
        // Phụ huynh đăng nhập: chỉ cho phép các menu con: Điểm danh, Bài tập, Nhận xét
        if (
          activeNav !== 'parent-attendance' &&
          activeNav !== 'parent-homework' &&
          activeNav !== 'parent-remarks' &&
          activeNav !== 'parent-portal'
        ) {
          setActiveNav('parent-attendance');
        }
      } else if (isTeacher) {
        if (
          activeNav !== 'teacher-attendance' &&
          activeNav !== 'teacher-assignments' &&
          activeNav !== 'teacher-grading'
        ) {
          setActiveNav('teacher-attendance');
        }
      } else if (isCenterAdmin) {
        // Center admin ẩn menu làm việc của Giáo viên và Phụ huynh
        if (
          activeNav === 'teacher-attendance' ||
          activeNav === 'teacher-assignments' ||
          activeNav === 'teacher-grading' ||
          activeNav === 'parent-portal' ||
          activeNav === 'parent-attendance' ||
          activeNav === 'parent-homework' ||
          activeNav === 'parent-remarks'
        ) {
          setActiveNav('dashboard');
        }
      }
    }
  }, [currentUser?.role, currentRole, activeNav]);

  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setStoredSession(user);
          if (user.centerId) {
            setActiveCenterId(user.centerId);
          }
          const isTeacher = isTeacherRole(user.role);
          const isParent = isParentRole(user.role);
          const roleMapping: UserRole = user.role === 'super_admin' || user.role === 'center_admin' ? 'admin' : isTeacher ? 'teacher' : isParent ? 'parent' : 'admin';
          setCurrentRole(roleMapping);

          // Điều hướng người dùng vào giao diện làm việc tương ứng với role và nạp dữ liệu từ `/centers/${centerId}/...`
          if (user.role === 'super_admin') {
            setActiveNav('super-admin-portal');
          } else if (isTeacher) {
            setActiveNav('teacher-attendance');
          } else if (isParent) {
            setActiveNav('parent-attendance');
          } else {
            setActiveNav('dashboard');
          }
          showToast(`Chào mừng ${user.displayName || user.name} quay trở lại!`, 'success');
        }}
      />
    );
  }

  const cleanCurrentUserName = getValidTeacherName(
    currentUser?.fullName,
    currentUser?.name,
    currentUser?.displayName
  );

  const matchedTeacher = teachers.find(
    (t) => (currentUser && areSameTeacher(t, currentUser)) ||
           (currentUser?.entityId && t.id === currentUser.entityId) ||
           (currentUser?.id && (t.id === currentUser.id || (t as any).uid === currentUser.id)) ||
           (currentUser?.uid && (t.id === currentUser.uid || (t as any).uid === currentUser.uid)) ||
           (currentUser?.username && t.username && t.username.toLowerCase().replace(/^@+/, '') === currentUser.username.toLowerCase().replace(/^@+/, '')) ||
           (currentUser?.phone && t.phone && t.phone.replace(/[^0-9]/g, '') === currentUser.phone.replace(/[^0-9]/g, '') && (!currentUser?.username || !t.username || t.username.toLowerCase().replace(/^@+/, '') === currentUser.username.toLowerCase().replace(/^@+/, ''))) ||
           (cleanCurrentUserName && t.name && t.name.toLowerCase().trim() === cleanCurrentUserName.toLowerCase().trim()) ||
           (cleanCurrentUserName && t.fullName && t.fullName.toLowerCase().trim() === cleanCurrentUserName.toLowerCase().trim())
  );

  const finalActiveTeacherName = cleanCurrentUserName || getValidTeacherName(matchedTeacher?.fullName, matchedTeacher?.name) || 'Giáo viên';

  const isCurrentAUserParent = isParentRole(currentUser?.role) || (!currentUser?.role && isParentRole(currentRole)) || (currentRole === 'parent' && currentUser?.role !== 'super_admin' && currentUser?.role !== 'center_admin' && !isTeacherRole(currentUser?.role));
  const isCurrentAUserTeacher = !isCurrentAUserParent && (isTeacherRole(currentUser?.role) || (!currentUser?.role && isTeacherRole(currentRole)) || (currentRole === 'teacher' && currentUser?.role !== 'super_admin' && currentUser?.role !== 'center_admin'));

  const activeTeacher: TeacherItem = matchedTeacher
    ? {
        ...matchedTeacher,
        name: finalActiveTeacherName,
        fullName: finalActiveTeacherName,
        subject: matchedTeacher.subject || currentUser?.subject || 'Bộ môn Văn hóa',
        phone: matchedTeacher.phone || currentUser?.phone || '',
        avatar: matchedTeacher.avatar || currentUser?.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
      }
    : (isCurrentAUserTeacher
        ? {
            id: currentUser?.entityId || currentUser?.uid || currentUser?.id || 'teacher-current',
            centerId: currentUser?.centerId || activeCenterId,
            name: finalActiveTeacherName,
            fullName: finalActiveTeacherName,
            username: currentUser?.username || '',
            subject: currentUser?.subject || currentUser?.entityName || 'Bộ môn Văn hóa',
            avatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
            phone: currentUser?.phone || '',
            email: currentUser?.email || '',
            mainClassId: currentUser?.mainClassId || '',
            mainClassName: currentUser?.mainClassName || '',
            bio: currentUser?.bio || 'Giáo viên phụ trách bộ môn.',
          }
        : teachers[0] || {
            id: 'teacher-default',
            name: 'Giáo viên',
            fullName: 'Giáo viên phụ trách',
            subject: 'Bộ môn',
            avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
            phone: '',
            email: '',
            mainClassId: '',
            mainClassName: 'Chưa phân lớp',
          });

  const selectedParentStudent: StudentItem | null =
    students.find(
      (s) =>
        Boolean(currentUser?.entityId && s.id === currentUser.entityId) ||
        Boolean((currentUser as any)?.studentId && s.id === (currentUser as any).studentId)
    ) ||
    students.find(
      (s) =>
        Boolean(
          currentUser?.username &&
            s.username &&
            s.username.trim().toLowerCase() === currentUser.username.trim().toLowerCase()
        ) || Boolean(currentUser?.id && s.id === currentUser.id.replace('ph-', ''))
    ) ||
    students.find((s) =>
      Boolean(currentUser?.phone && s.parentPhone && s.parentPhone.trim() === currentUser.phone.trim())
    ) ||
    students[0] ||
    null;

  const activeCenterName =
    centers.find((c) => c.id === (activeCenterId || currentUser?.centerId))?.name ||
    currentUser?.centerName ||
    'Trung Tâm Đào Tạo';

  const targetCenterObj =
    centers.find((c) => c.id === (currentUser?.centerId || activeCenterId)) ||
    centers.find((c) => c.id === activeCenterId) ||
    centers[0];

  const centerExpiryRaw = targetCenterObj?.expiryDate;
  let centerDaysRemaining: number | null = null;
  let isCenterExpiringSoon = false;
  let isCenterExpired = false;

  if (centerExpiryRaw) {
    const parts = centerExpiryRaw.split('-');
    let expiryDate: Date;
    if (parts.length === 3) {
      expiryDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      expiryDate = new Date(centerExpiryRaw);
    }

    if (!isNaN(expiryDate.getTime())) {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const expiryStartOfDay = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate()).getTime();
      const diffMs = expiryStartOfDay - startOfToday;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      centerDaysRemaining = diffDays;
      isCenterExpired = diffDays < 0;
      isCenterExpiringSoon = diffDays >= 0 && diffDays <= 7;
    }
  }

  return (
    <div className="flex h-screen bg-slate-100/70 font-sans overflow-hidden text-slate-800">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-2xl p-4 text-xs font-bold text-white shadow-xl animate-fade-in ${
            toast.type === 'success'
              ? 'bg-[#00A86B]'
              : toast.type === 'error'
              ? 'bg-[#E74C3C]'
              : 'bg-[#0072B5]'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : toast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <Info className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        currentRole={currentRole}
        currentUser={currentUser}
        onRoleChange={handleRoleChange}
        activeNav={activeNav}
        onNavSelect={setActiveNav}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Unified Responsive Header Bar */}
        <Header
          currentRole={currentRole}
          currentUser={currentUser}
          activeTeacher={activeTeacher}
          teachers={teachers}
          centers={centers}
          activeCenterId={activeCenterId}
          onSelectCenter={(id) => {
            setActiveCenterId(id);
            const target = centers.find((c) => c.id === id);
            showToast(`✓ Đã chuyển sang không gian: ${target?.name || id}`, 'success');
          }}
          onRoleChange={handleRoleChange}
          unreadCount={2}
          onOpenNotifications={() => setIsNotificationModalOpen(true)}
          onLogout={handleLogout}
          onToggleMobileMenu={() => setIsMobileSidebarOpen(true)}
        />

        {/* Scrollable Main Workspace */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8 space-y-5 pb-24 lg:pb-8">
          <Suspense fallback={<ViewLoadingFallback />}>
            {/* TRƯỜNG HỢP 1: GIÁO VIÊN ĐĂNG NHẬP -> CHỈ HIỂN THỊ WORKSTATION GIÁO VIÊN VÀ CÁC MỤC CON */}
          {isCurrentAUserTeacher ? (
            <TeacherWorkstationHub
              teacher={activeTeacher}
              currentUser={currentUser}
              classes={classes}
              students={students}
              assignments={assignments}
              attendanceRecords={attendanceRecords}
              activeCenterId={activeCenterId || currentUser?.centerId}
              activeTabKey={activeNav === 'teacher-assignments' ? 'homework' : activeNav === 'teacher-grading' ? 'grading' : 'attendance'}
              onUpdateAttendance={handleUpdateAttendance}
              onUpdateStudentRemark={(id, remark) => {
                setStudents((prev) =>
                  prev.map((s) => (s.id === id ? { ...s, note: remark } : s))
                );
              }}
              onSyncToAdmin={handleTeacherSyncToAdmin}
              onAssignHomework={handleTeacherAssignHomework}
              onGradeStudentHomework={handleTeacherGradeStudent}
            />
          ) : isCurrentAUserParent ? (
            /* TRƯỜNG HỢP 2: PHỤ HUYNH ĐĂNG NHẬP -> CHỈ HIỂN THỊ DUY NHẤT SỔ LIÊN LẠC PHỤ HUYNH, ẨN CÁC GIAO DIỆN KHÁC */
            <ParentPortalView
              student={selectedParentStudent}
              assignments={assignments}
              allStudents={students}
              classes={classes}
              teachers={teachers}
              activeCenterId={activeCenterId || currentUser?.centerId}
              centerName={activeCenterName}
              attendanceRecords={attendanceRecords}
              activeTab={
                activeNav === 'parent-homework'
                  ? 'homework'
                  : activeNav === 'parent-remarks'
                  ? 'remarks'
                  : 'attendance'
              }
              onTabChange={(tab) => {
                if (tab === 'attendance') setActiveNav('parent-attendance');
                else if (tab === 'homework') setActiveNav('parent-homework');
                else if (tab === 'remarks') setActiveNav('parent-remarks');
              }}
              onRequestLeaveSuccess={async (studentName, date, reason) => {
                const target = students.find((s) => s.name === studentName);
                if (target) {
                  await handleUpdateAttendance(target.id, 'excused');
                }
              }}
            />
          ) : (
            /* TRƯỜNG HỢP 3: ADMIN VÀ CÁC VAI TRÒ KHÁC */
            <>
              {/* DEDICATED SUPER ADMIN PORTAL VIEW (CHỈ DÀNH RIÊNG CHO SUPER ADMIN) */}
              {activeNav === 'super-admin-portal' && currentUser?.role === 'super_admin' && (
                <SuperAdminPortalView
                  centers={centers}
                  activeCenterId={activeCenterId}
                  currentUser={currentUser}
                  onSelectCenter={(id) => {
                    setActiveCenterId(id);
                    const target = centers.find((c) => c.id === id);
                    showToast(`✓ Đã chọn trung tâm quản lý: ${target?.name || id}`, 'success');
                  }}
                  onDeleteCenterSuccess={handleDeleteCenterSuccess}
                  onShowToast={showToast}
                />
              )}

              {/* CENTER PROFILE & SCHOOL INFO VIEW (DÀNH CHO CENTER ADMIN QUẢN TRỊ TRƯỜNG CỦA MÌNH) */}
              {activeNav === 'admin-centers' && (
                <CenterManagementView
                  centers={centers}
                  activeCenterId={activeCenterId}
                  currentUser={currentUser}
                  classesCount={classes.length}
                  teachersCount={teachers.length}
                  studentsCount={students.length}
                  openRenewalListTrigger={openRenewalListTrigger}
                  onDeleteCenterSuccess={handleDeleteCenterSuccess}
                  onShowToast={showToast}
                />
              )}

              {/* PAYMENT SETTINGS VIEW (THIẾT LẬP THANH TOÁN CHO CENTER ADMIN) */}
              {activeNav === 'admin-payment-settings' && (
                <PaymentSettingsView
                  centers={centers}
                  activeCenterId={activeCenterId}
                  currentUser={currentUser}
                  onShowToast={showToast}
                />
              )}

              {/* DASHBOARD SUMMARY VIEW (TỔNG QUAN TRUNG TÂM CHO CENTER ADMIN - ĐÃ XÓA PHẦN BÀI TẬP VÀ CHẤM ĐIỂM) */}
              {activeNav === 'dashboard' && currentRole === 'admin' && (
                <div className="space-y-6">
                  {/* CẢNH BÁO NỔI BẬT ĐẦU TRANG TỔNG QUAN TRUNG TÂM NẾU SẮP HẾT HẠN HOẶC ĐÃ HẾT HẠN */}
                  {isCenterExpired ? (
                    <div className="rounded-3xl bg-rose-50 border-2 border-rose-400 p-5 md:p-6 shadow-md flex flex-wrap items-center justify-between gap-4 animate-fade-in">
                      <div className="flex items-start gap-4 max-w-3xl">
                        <div className="p-3 bg-rose-600 rounded-2xl text-white shadow-sm shrink-0">
                          <AlertCircle className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-200 text-rose-900 text-[11px] font-black uppercase tracking-wider">
                              ✕ Dịch Vụ Đã Quá Hạn
                            </span>
                            <span className="text-xs font-black text-rose-700">
                              Quá hạn {Math.abs(centerDaysRemaining ?? 0)} ngày
                            </span>
                          </div>
                          <h3 className="text-base md:text-lg font-black text-rose-950">
                            Gói bản quyền của trường đã hết hạn sử dụng!
                          </h3>
                          <p className="text-xs md:text-sm text-rose-800 leading-relaxed font-medium">
                            Hạn dịch vụ đã kết thúc vào ngày <strong>{targetCenterObj?.expiryDate}</strong>. Vui lòng liên hệ ngay Quản Trị Viên Hệ Thống (Super Admin) để thanh toán gia hạn, tránh bị tạm ngừng truy cập các tính năng quản lý và điểm danh.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsRenewalModalOpen(true)}
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition-all cursor-pointer shrink-0"
                      >
                        <Crown className="w-4 h-4" />
                        <span>Gia hạn ngay</span>
                      </button>
                    </div>
                  ) : isCenterExpiringSoon ? (
                    <div className="rounded-3xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/10 border-2 border-amber-400 p-5 md:p-6 shadow-md flex flex-wrap items-center justify-between gap-4 animate-fade-in">
                      <div className="flex items-start gap-4 max-w-3xl">
                        <div className="p-3 bg-amber-500 rounded-2xl text-white shadow-sm shrink-0 animate-bounce">
                          <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-black uppercase tracking-wider shadow-xs">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Cảnh Báo Hết Hạn
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-xs font-black">
                              {centerDaysRemaining === 0 ? 'Hôm nay là ngày cuối cùng' : `Chỉ còn ${centerDaysRemaining} ngày nữa`}
                            </span>
                          </div>
                          <h3 className="text-base md:text-lg font-black text-amber-950">
                            Gói dịch vụ của trường sắp hết hạn sử dụng!
                          </h3>
                          <p className="text-xs md:text-sm text-amber-900 leading-relaxed font-medium">
                            Thời hạn bản quyền hệ thống của trung tâm sẽ kết thúc vào ngày <strong>{targetCenterObj?.expiryDate}</strong> ({centerDaysRemaining === 0 ? 'hôm nay' : `còn ${centerDaysRemaining} ngày`}). Quản trị viên vui lòng liên hệ Super Admin gia hạn sớm để dịch vụ hoạt động liên tục, không làm gián đoạn việc giảng dạy và tương tác phụ huynh.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsRenewalModalOpen(true)}
                          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md transition-all cursor-pointer"
                        >
                          <Crown className="w-4 h-4" />
                          <span>Gia hạn ngay</span>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Hệ Thống Quản Trị Center */}
                  <AdminSystemCard
                    classes={classes}
                    teachers={teachers}
                    students={students}
                    onAddClassClick={() => setIsClassModalOpen(true)}
                    onImportStudentsClick={() => handleOpenImportModal('student')}
                    onManageClassesClick={() => setActiveNav('admin-classes')}
                    onManageTeachersClick={() => setActiveNav('admin-teachers')}
                    onManageStudentsClick={() => setActiveNav('admin-students')}
                    onExportMonthlyExcelClick={() => setActiveNav('reports')}
                  />

                  {/* Danh Sách Lớp Học Đang Hoạt Động (Tổng Quan Nhanh) */}
                  <div className="rounded-2xl border-2 border-blue-100 bg-white p-5 shadow-xs transition-all hover:shadow-md">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-5 rounded-full bg-[#0072B5]"></span>
                        <h3 className="text-base font-extrabold text-[#0B486B] tracking-tight">
                          Danh Sách Lớp Học Đang Hoạt Động
                        </h3>
                        <span className="text-xs font-bold text-[#0072B5] bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-full ml-1">
                          {classes.length} lớp học
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveNav('admin-classes')}
                        className="text-xs font-bold text-[#0072B5] hover:text-[#0B486B] flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <span>Quản lý chi tiết lớp học &rarr;</span>
                      </button>
                    </div>

                    {classes.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-xs">
                        Chưa có lớp học nào. Nhấn nút <strong>[+] Thêm Lớp Mới</strong> ở trên để tạo lớp học đầu tiên cho trung tâm.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                        {classes.map((cls) => (
                          <div
                            key={cls.id}
                            onClick={() => setActiveNav('admin-classes')}
                            className="p-4 rounded-xl border border-slate-200 hover:border-[#0072B5] bg-gradient-to-br from-slate-50/70 to-white transition-all hover:shadow-xs cursor-pointer group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-[#0072B5] mb-1">
                                  {cls.subject || 'Chưa phân môn'}
                                </span>
                                <h4 className="text-sm font-extrabold text-slate-800 group-hover:text-[#0072B5] transition-colors truncate">
                                  {cls.name}
                                </h4>
                              </div>
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60 shrink-0">
                                {cls.studentCount || 0} Học sinh
                              </span>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                              <span className="truncate max-w-[160px]">
                                GV: <strong className="text-slate-800">{cls.teacherName || 'Chưa phân công'}</strong>
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {cls.schedule || cls.room || 'Lịch linh hoạt'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ADMIN MANAGEMENT HUB */}
              {(activeNav === 'admin-classes' || activeNav === 'admin-teachers' || activeNav === 'admin-students') && (
                <AdminManagementHub
                  initialTab={activeNav === 'admin-teachers' ? 'teacher' : activeNav === 'admin-students' ? 'student' : 'class'}
                  classes={classes}
                  teachers={teachers}
                  students={students}
                  onOpenAddClass={() => setIsClassModalOpen(true)}
                  onOpenAddTeacher={() => setIsTeacherModalOpen(true)}
                  onOpenAddStudent={() => setIsStudentModalOpen(true)}
                  onOpenImport={handleOpenImportModal}
                  onEditEntity={handleOpenEdit}
                  onDeleteEntity={handleDeleteEntity}
                  onUpdateAttendance={handleUpdateAttendance}
                  onUpdateClassPrice={handleUpdateClassPrice}
                />
              )}

              {/* ACCOUNTS MANAGEMENT VIEW */}
              {activeNav === 'admin-accounts' && (
                <AccountsManagementView
                  currentUser={currentUser}
                  activeCenterId={activeCenterId}
                  onShowToast={showToast}
                />
              )}

              {/* REPORTS VIEW - ĐỒNG BỘ ĐIỂM DANH THEO THÁNG CỦA TẤT CẢ CÁC LỚP TRONG TRUNG TÂM */}
              {activeNav === 'reports' && (
                <ReportsView
                  classes={classes}
                  teachers={teachers}
                  students={students}
                  attendanceRecords={attendanceRecords}
                  activeCenterId={activeCenterId || currentUser?.centerId || ''}
                  currentUser={currentUser}
                  centers={centers}
                  onUpdateClassPrice={handleUpdateClassPrice}
                />
              )}

              {/* SETTINGS VIEW */}
              {activeNav === 'settings' && <SettingsView />}
            </>
          )}
          </Suspense>
        </main>

      {/* Global Modals - Phân quyền hiển thị: Chỉ Admin mới mở các modal tạo/sửa dữ liệu tổng thể */}
      <Suspense fallback={null}>
        <ClassModal
          isOpen={!isCurrentAUserTeacher && !isCurrentAUserParent && isClassModalOpen}
          onClose={() => setIsClassModalOpen(false)}
          teachers={teachers}
          onSaveClass={handleSaveClass}
        />

        <TeacherModal
          isOpen={!isCurrentAUserTeacher && !isCurrentAUserParent && isTeacherModalOpen}
          onClose={() => setIsTeacherModalOpen(false)}
          classes={classes}
          centers={centers}
          activeCenterId={activeCenterId || currentUser?.centerId || ''}
          onAddTeacher={handleAddTeacher}
        />

        <StudentModal
          isOpen={!isCurrentAUserTeacher && !isCurrentAUserParent && isStudentModalOpen}
          classes={classes}
          centers={centers}
          activeCenterId={activeCenterId || currentUser?.centerId || ''}
          onClose={() => setIsStudentModalOpen(false)}
          onAddStudent={handleAddStudent}
        />

        <AssignmentModal
          isOpen={isAssignmentModalOpen}
          assignment={selectedAssignment}
          onClose={() => setIsAssignmentModalOpen(false)}
          onUpdateScore={(id, score, comment) => handleTeacherGradeStudent(id, 'Học sinh', score, comment)}
        />

        {selectedParentStudent && (
          <HistoryModal
            isOpen={isHistoryModalOpen}
            onClose={() => setIsHistoryModalOpen(false)}
            student={selectedParentStudent}
          />
        )}

        <NotificationModal
          isOpen={isNotificationModalOpen}
          onClose={() => setIsNotificationModalOpen(false)}
          onClearAll={() => showToast('Đã xóa tất cả thông báo.')}
        />

        <EditEntityModal
          isOpen={!isCurrentAUserTeacher && !isCurrentAUserParent && isEditModalOpen}
          type={editingEntityType}
          entity={editingEntityData}
          classes={classes}
          teachers={teachers}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveEditedEntity}
          onDelete={(id) => handleDeleteEntity(editingEntityType, id)}
        />

        <ExcelImportModal
          isOpen={!isCurrentAUserTeacher && !isCurrentAUserParent && isImportModalOpen}
          type={importingEntityType}
          onClose={() => setIsImportModalOpen(false)}
          onImportBatch={handleBatchImport}
        />
      </Suspense>

        {/* Mobile Quick Bottom Navigation Dock (Chỉ hiển thị trên điện thoại / màn hình nhỏ lg:hidden) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-2 py-1.5 flex items-center justify-around">
          {isCurrentAUserTeacher ? (
            <>
              <button
                type="button"
                onClick={() => setActiveNav('teacher-attendance')}
                className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
                  activeNav === 'teacher-attendance' ? 'text-[#00A86B] font-black' : 'text-slate-500 font-semibold'
                }`}
              >
                <ClipboardCheck className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Điểm danh</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('teacher-assignments')}
                className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
                  activeNav === 'teacher-assignments' ? 'text-[#0072B5] font-black' : 'text-slate-500 font-semibold'
                }`}
              >
                <BookMarked className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Giao bài</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('teacher-grading')}
                className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
                  activeNav === 'teacher-grading' ? 'text-amber-600 font-black' : 'text-slate-500 font-semibold'
                }`}
              >
                <Award className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Chấm điểm</span>
              </button>
              <button
                type="button"
                onClick={() => setIsNotificationModalOpen(true)}
                className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 font-semibold rounded-xl transition-all cursor-pointer"
              >
                <Bell className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Thông báo</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 font-semibold rounded-xl transition-all cursor-pointer"
              >
                <Menu className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Menu</span>
              </button>
            </>
          ) : isCurrentAUserParent ? (
            <>
              <button
                type="button"
                onClick={() => setActiveNav('parent-attendance')}
                className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
                  activeNav === 'parent-attendance' || activeNav === 'parent-portal' ? 'text-[#00A86B] font-black' : 'text-slate-500 font-semibold'
                }`}
              >
                <CalendarCheck className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Điểm danh</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('parent-homework')}
                className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
                  activeNav === 'parent-homework' ? 'text-[#F39C12] font-black' : 'text-slate-500 font-semibold'
                }`}
              >
                <Award className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Bài tập</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('parent-remarks')}
                className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
                  activeNav === 'parent-remarks' ? 'text-[#0072B5] font-black' : 'text-slate-500 font-semibold'
                }`}
              >
                <MessageSquare className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Nhận xét</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 font-semibold rounded-xl transition-all cursor-pointer"
              >
                <Menu className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Menu</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveNav(currentUser?.role === 'super_admin' ? 'super-admin-portal' : 'dashboard')}
                className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
                  activeNav === 'dashboard' || activeNav === 'super-admin-portal' ? 'text-[#0072B5] font-black' : 'text-slate-500 font-semibold'
                }`}
              >
                <LayoutDashboard className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Tổng quan</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('admin-classes')}
                className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
                  activeNav === 'admin-classes' ? 'text-[#0072B5] font-black' : 'text-slate-500 font-semibold'
                }`}
              >
                <School className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Lớp học</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('admin-teachers')}
                className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
                  activeNav === 'admin-teachers' ? 'text-amber-600 font-black' : 'text-slate-500 font-semibold'
                }`}
              >
                <Users className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Giáo viên</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('admin-students')}
                className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
                  activeNav === 'admin-students' ? 'text-emerald-600 font-black' : 'text-slate-500 font-semibold'
                }`}
              >
                <GraduationCap className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Học sinh</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 font-semibold rounded-xl transition-all cursor-pointer"
              >
                <Menu className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Menu</span>
              </button>
            </>
          )}
        </nav>

        {/* MODAL: FORM ĐĂNG KÝ GIA HẠN BẢN QUYỀN TRUNG TÂM */}
        <CenterRenewalModal
          isOpen={isRenewalModalOpen}
          onClose={() => setIsRenewalModalOpen(false)}
          center={
            targetCenterObj || {
              id: currentUser?.centerId || activeCenterId || 'center_01',
              name: activeCenterName,
              code: currentUser?.centerId || activeCenterId || 'HG01',
              phone: currentUser?.phone || '',
              email: currentUser?.email || '',
              packagePlan: 'Premium',
              expiryDate: '2026-12-31',
              status: 'active',
            }
          }
          currentUser={currentUser}
          onShowToast={showToast}
          onSuccess={() => {
            setIsRenewalModalOpen(false);
            setActiveNav('admin-centers');
            setOpenRenewalListTrigger((prev) => prev + 1);
          }}
        />
      </div>
    </div>
  );
}
