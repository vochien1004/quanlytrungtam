import React, { useState, useEffect, useMemo } from 'react';
import { 
  Crown, 
  Building2, 
  Users, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  Plus, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  KeyRound, 
  BarChart3, 
  Edit3, 
  Trash2,
  Eye,
  EyeOff,
  Loader2, 
  ShieldAlert, 
  Mail, 
  Phone, 
  X, 
  Sparkles, 
  ArrowUpRight 
} from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { 
  CenterItem, 
  createCenter, 
  updateCenter, 
  renewCenterSubscription,
  deleteCenter,
  deleteCenterAdminAccount,
  toggleAccountLock,
  createSystemUser,
  normalizeUsername,
  migrateLegacyCenterArrays
} from '../../services/firebaseService';
import { 
  UserAccount, 
  resetAccountPassword,
  getStoredSession
} from '../../services/authService';
import { DeleteCenterModal } from './DeleteCenterModal';

interface SuperAdminPortalViewProps {
  centers: CenterItem[];
  activeCenterId: string;
  currentUser?: UserAccount | null;
  onSelectCenter: (centerId: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onDeleteCenterSuccess?: (centerId: string) => void;
}

export const SuperAdminPortalView: React.FC<SuperAdminPortalViewProps> = ({
  centers: propCenters,
  activeCenterId,
  currentUser: propCurrentUser,
  onSelectCenter,
  onShowToast,
  onDeleteCenterSuccess,
}) => {
  const currentUser = propCurrentUser || getStoredSession();
  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.username === 'admin';

  const [activeTab, setActiveTab] = useState<'centers' | 'accounts' | 'analytics'>('centers');

  // 1. Centers Realtime State from collection(db, "centers")
  const [centers, setCenters] = useState<any[]>(propCenters || []);
  const [isLoadingCenters, setIsLoadingCenters] = useState<boolean>(true);

  // 2. Users Realtime State from collection(db, "users")
  const [globalUsers, setGlobalUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);

  // Lắng nghe collection root `centers` bằng onSnapshot thời gian thực
  useEffect(() => {
    setIsLoadingCenters(true);
    const centersRef = collection(db, 'centers');
    const unsubscribeCenters = onSnapshot(
      centersRef,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => {
          const rawData = docSnap.data() as any;
          if (
            Array.isArray(rawData?.students) ||
            Array.isArray(rawData?.teachers) ||
            Array.isArray(rawData?.classes) ||
            Array.isArray(rawData?.assignments) ||
            Array.isArray(rawData?.attendance)
          ) {
            migrateLegacyCenterArrays(docSnap.id).catch(() => {});
          }
          const {
            students: _std,
            teachers: _tch,
            classes: _cls,
            assignments: _asg,
            attendance: _att,
            ...cleanData
          } = rawData;
          return {
            id: docSnap.id,
            ...cleanData,
          };
        });
        setCenters(list);
        setIsLoadingCenters(false);
      },
      (error) => {
        console.warn('Lưu ý lắng nghe Firestore centers:', error?.message || error);
        setIsLoadingCenters(false);
      }
    );

    return () => unsubscribeCenters();
  }, []);

  // Lắng nghe collection root `users` bằng onSnapshot thời gian thực (nếu được cấp quyền)
  useEffect(() => {
    setIsLoadingUsers(true);
    let isCancelled = false;
    let unsubscribeUsers = () => {};

    try {
      const usersRef = collection(db, 'users');
      unsubscribeUsers = onSnapshot(
        usersRef,
        (snapshot) => {
          if (isCancelled) return;
          const list = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));
          setGlobalUsers(list);
          setIsLoadingUsers(false);
        },
        (_error) => {
          // Bỏ qua lỗi permission-denied và kết thúc loading để fallback sang dữ liệu centers
          if (!isCancelled) {
            setIsLoadingUsers(false);
          }
        }
      );
    } catch {
      setIsLoadingUsers(false);
    }

    return () => {
      isCancelled = true;
      unsubscribeUsers();
    };
  }, []);

  // Center search & filter
  const [centerSearch, setCenterSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'suspended'>('all');

  // Account search & filter
  const [accountSearch, setAccountSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'super_admin' | 'center_admin' | 'admin' | 'teacher' | 'parent'>('all');

  // Create / Edit Center Modal State
  const [isCenterModalOpen, setIsModalOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<any | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [packagePlan, setPackagePlan] = useState<'Basic' | 'Standard' | 'Premium' | 'Enterprise'>('Premium');
  const [expiryDate, setExpiryDate] = useState('2028-12-31');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('123456');
  const [isSubmittingCenter, setIsSubmittingCenter] = useState(false);

  // Renew Modal State
  const [renewingCenter, setRenewingCenter] = useState<any | null>(null);
  const [renewMonths, setRenewMonths] = useState<number>(12);
  const [isRenewing, setIsRenewing] = useState(false);

  // Reset Account Password Modal
  const [selectedAccForReset, setSelectedAccForReset] = useState<any | null>(null);
  const [newAccPassword, setNewAccPassword] = useState('');
  const [isResettingPass, setIsResettingPass] = useState(false);

  // Create Center Admin Modal State
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [newUserCenterId, setNewUserCenterId] = useState<string>('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('123456');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  // Delete Center Modal State
  const [deletingCenter, setDeletingCenter] = useState<any | null>(null);
  const [isDeletingCenter, setIsDeletingCenter] = useState(false);

  // Delete Center Admin Modal State
  const [deletingCenterAdmin, setDeletingCenterAdmin] = useState<any | null>(null);
  const [isDeletingCenterAdmin, setIsDeletingCenterAdmin] = useState(false);

  // Show Password Map for Center Admins
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  const toggleShowPassword = (accountId: string) => {
    setShowPasswordMap((prev) => ({
      ...prev,
      [accountId]: !prev[accountId],
    }));
  };

  // Đồng bộ propCenters nếu parent đã tải trước
  useEffect(() => {
    if (propCenters && propCenters.length > 0 && centers.length === 0) {
      setCenters(propCenters);
    }
  }, [propCenters]);

  // Helper: Chuyển đổi an toàn Firebase Timestamp / Date string sang JS Date
  const parseEndDate = (center: any): Date | null => {
    const raw = center?.endDate ?? center?.expiryDate;
    if (!raw) return null;
    if (typeof raw?.toDate === 'function') {
      const d = raw.toDate();
      return isNaN(d.getTime()) ? null : d;
    }
    if (raw?.seconds !== undefined) {
      const d = new Date(raw.seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
    if (raw instanceof Date) {
      return isNaN(raw.getTime()) ? null : raw;
    }
    if (typeof raw === 'number') {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      // Xử lý định dạng ngày VN DD/MM/YYYY
      if (trimmed.includes('/')) {
        const parts = trimmed.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          const d = new Date(year, month, day);
          if (!isNaN(d.getTime())) return d;
        }
      }
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  // Helper format ngày hiển thị dạng DD/MM/YYYY
  const formatEndDate = (center: any): string => {
    const end = parseEndDate(center);
    if (!end) return center?.endDate || center?.expiryDate || 'Chưa thiết lập';
    const day = String(end.getDate()).padStart(2, '0');
    const month = String(end.getMonth() + 1).padStart(2, '0');
    const year = end.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // 1. LOGIC TRUY VẤN VÀ TÍNH TOÁN CÁC THẺ THỐNG KÊ (STAT CARDS)
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const nowPlusThirtyDays = now + thirtyDaysMs;

  // Thẻ 1: "Tổng Số Trung Tâm" (totalCenters)
  // Giá trị = Tổng số document trả về từ collection centers (snapshot.size).
  const totalCenters = centers.length;

  // Thẻ 2: "Đang Hoạt Động Cực Tốt" (activeCenters)
  // Điều kiện: Trung tâm có status === "active" VÀ thời hạn endDate > (Thời gian hiện tại + 30 ngày).
  const activeCenters = centers.filter((center) => {
    const status = center?.status;
    const end = parseEndDate(center);
    if (!end) return false;
    return status === 'active' && end.getTime() > nowPlusThirtyDays;
  }).length;

  // Thẻ 3: "Cảnh Báo Sắp Hết Hạn" (warningCenters)
  // Điều kiện: Trung tâm có status === "active" VÀ endDate nằm trong khoảng từ (Hôm nay) đến (30 ngày tới) (now < endDate <= now + 30 days).
  const warningCenters = centers.filter((center) => {
    const status = center?.status;
    const end = parseEndDate(center);
    if (!end) return false;
    const endTime = end.getTime();
    return status === 'active' && endTime > now && endTime <= nowPlusThirtyDays;
  }).length;

  // Thẻ 4: "Hết Hạn / Tạm Khóa" (expiredOrSuspendedCenters)
  // Điều kiện: Trung tâm có status === "suspended" HOẶC status === "expired" HOẶC endDate < now (Thời gian hiện tại).
  const expiredOrSuspendedCenters = centers.filter((center) => {
    const status = center?.status;
    const end = parseEndDate(center);
    if (status === 'suspended' || status === 'expired') return true;
    if (end && end.getTime() < now) return true;
    return false;
  }).length;

  // 2. LOGIC TÍNH TOÁN CON SỐ TRÊN CÁC TAB MENU (TAB COUNTERS):
  // Tab 1: "1. Quản Lý Trường / Trung Tâm & Gia Hạn Bản Quyền ({totalCenters})"
  // Tab 2: "2. Quản Lý Tài Khoản Center Admin ({centerAdminCount})"
  // Tự động trích xuất đầy đủ tài khoản Center Admin từ `centers` và hợp nhất với `globalUsers`
  const centerAdminAccounts = useMemo(() => {
    const map = new Map<string, any>();

    // 1. Luôn trích xuất tài khoản quản trị từ từng trung tâm trong centers
    centers.forEach((c: any) => {
      if (!c) return;
      const adminUser = String(c.adminUsername || `admin_${String(c.code || c.id || 'center').toLowerCase()}`);
      const adminPass = String(c.adminPassword || '123456');
      const centerDisplayName = String(c.name || 'Trung tâm');
      const centerEmail = String(c.email || `${adminUser}@${String(c.code || 'center').toLowerCase()}.edu.vn`);
      const key = String(c.adminUid || c.id || adminUser);

      map.set(key, {
        id: c.adminUid || c.id || key,
        uid: c.adminUid || c.id || key,
        username: adminUser,
        password: adminPass,
        name: String(c.adminName || `Quản trị ${centerDisplayName}`),
        fullName: String(c.adminName || `Quản trị ${centerDisplayName}`),
        email: centerEmail,
        phone: String(c.phone || ''),
        centerId: String(c.id || ''),
        centerName: centerDisplayName,
        role: 'center_admin',
        status: c.status === 'suspended' ? 'locked' : 'active',
      });
    });

    // 2. Bổ sung các bản ghi từ globalUsers nếu có
    globalUsers.forEach((u: any) => {
      if (!u || u._deleted || u.status === 'deleted' || u.role === 'deleted') return;
      // Nếu tài khoản gắn với một trung tâm cụ thể mà trung tâm đó không còn tồn tại -> Loại bỏ
      if (u.centerId && !centers.some((c: any) => c.id === u.centerId || c.code === u.centerId)) {
        return;
      }
      if (u.role === 'center_admin' || u.role === 'admin') {
        const key = String(u.id || u.uid || u.username);
        const existing = map.get(key) || {};
        map.set(key, {
          ...existing,
          ...u,
          id: u.id || u.uid || key,
          uid: u.uid || u.id || key,
          username: String(u.username || existing.username || key),
          password: String(u.password || existing.password || '123456'),
          name: String(u.name || u.fullName || existing.name || 'Admin'),
          fullName: String(u.fullName || u.name || existing.fullName || 'Admin'),
          email: String(u.email || existing.email || ''),
          phone: String(u.phone || existing.phone || ''),
          centerId: String(u.centerId || existing.centerId || ''),
          centerName: String(u.centerName || existing.centerName || ''),
          role: 'center_admin',
          status: u.status === 'locked' ? 'locked' : (existing.status || 'active'),
        });
      }
    });

    return Array.from(map.values());
  }, [centers, globalUsers]);

  const centerAdminCount = centerAdminAccounts.length;
  // Tab 3: "3. Cảnh Báo Hết Hạn & Nhật Ký Bản Quyền ({warningCount})"
  // Đếm tổng số trung tâm thuộc nhóm "Sắp hết hạn" + "Đã hết hạn/Khóa" để làm Badge thông báo.
  const warningCount = warningCenters + expiredOrSuspendedCenters;

  // Helper kiểm tra trạng thái chi tiết cho từng trung tâm
  const checkExpiryStatus = (center: any) => {
    const status = center?.status;
    const end = parseEndDate(center);

    if (status === 'suspended') {
      return { label: 'Tạm khóa', color: 'rose', isExpired: true, daysLeft: 0 };
    }

    if (!end) {
      return {
        label: status === 'active' ? 'Đang hoạt động' : 'Chưa kích hoạt',
        color: status === 'active' ? 'emerald' : 'rose',
        isExpired: status !== 'active',
        daysLeft: 999,
      };
    }

    const endTime = end.getTime();
    const daysLeft = Math.ceil((endTime - now) / (1000 * 3600 * 24));

    if (status === 'expired' || endTime < now) {
      return { label: 'Đã hết hạn', color: 'rose', isExpired: true, daysLeft };
    }

    if (endTime <= nowPlusThirtyDays) {
      return { label: `Sắp hết hạn (${daysLeft} ngày)`, color: 'amber', isExpired: false, daysLeft };
    }

    return { label: 'Còn hạn', color: 'emerald', isExpired: false, daysLeft };
  };

  // Seed sample center directly on Firestore if list is empty
  const handleSeedSampleCenter = async () => {
    setIsSubmittingCenter(true);
    try {
      await createCenter({
        name: 'Trung tâm Học Giỏi - Cơ sở 1 (Cầu Giấy)',
        code: 'HG01',
        address: '123 Cầu Giấy, Q. Cầu Giấy, Hà Nội',
        phone: '0988.123.456',
        email: 'coso1@tthocgioi.edu.vn',
        packagePlan: 'Enterprise',
        endDate: '2028-12-31',
        expiryDate: '2028-12-31',
        adminUsername: 'coso1_admin',
        adminPassword: '123456',
        status: 'active',
      });
      onShowToast('✓ Đã đồng bộ Trung tâm mẫu "Trung tâm Học Giỏi - Cơ sở 1" lên Firebase Firestore thành công!', 'success');
    } catch (err: any) {
      onShowToast(`Lỗi đồng bộ: ${err.message}`, 'error');
    } finally {
      setIsSubmittingCenter(false);
    }
  };

  // Handlers
  const handleOpenCreateCenter = () => {
    setEditingCenter(null);
    setName('');
    setCode(`HG0${centers.length + 1}`);
    setAddress('');
    setPhone('');
    setEmail('');
    setPackagePlan('Premium');

    const defaultExp = new Date();
    defaultExp.setFullYear(defaultExp.getFullYear() + 1);
    setExpiryDate(defaultExp.toISOString().split('T')[0]);

    setAdminUsername(`center0${centers.length + 1}_admin`);
    setAdminPassword('123456');
    setIsModalOpen(true);
  };

  const handleOpenEditCenter = (center: any) => {
    setEditingCenter(center);
    setName(center?.name || '');
    setCode(center?.code || '');
    setAddress(center?.address || '');
    setPhone(center?.phone || '');
    setEmail(center?.email || '');
    setPackagePlan(center?.packagePlan || 'Standard');

    const end = parseEndDate(center);
    if (end) {
      setExpiryDate(end.toISOString().split('T')[0]);
    } else {
      setExpiryDate(center?.endDate || center?.expiryDate || '2028-12-31');
    }

    setAdminUsername(center?.adminUsername || `admin_${String(center?.code || '').toLowerCase()}`);
    setAdminPassword(center?.adminPassword || '123456');
    setIsModalOpen(true);
  };

  const handleSaveCenterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmittingCenter(true);
    try {
      if (editingCenter) {
        await updateCenter(editingCenter.id, {
          name,
          code,
          address,
          phone,
          email,
          packagePlan,
          expiryDate,
          endDate: expiryDate,
          adminUsername,
          adminPassword,
        });
        onShowToast(`✓ Đã cập nhật bản quyền và mật khẩu cho trung tâm "${name}"`);
      } else {
        await createCenter({
          name,
          code,
          address,
          phone,
          email,
          packagePlan,
          expiryDate,
          endDate: expiryDate,
          adminUsername,
          adminPassword,
          status: 'active',
        });
        onShowToast(`✓ Đã khởi tạo Trung tâm mới và cấp tài khoản ${adminUsername}`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      onShowToast(`Lỗi: ${err.message}`, 'error');
    } finally {
      setIsSubmittingCenter(false);
    }
  };

  const handleExecuteRenewal = async (centerId: string, months: number) => {
    setIsRenewing(true);
    try {
      const newDate = await renewCenterSubscription(centerId, months);
      onShowToast(`✓ Đã gia hạn thành công trung tâm thêm ${months} tháng. Hạn mới: ${newDate}`, 'success');
      setRenewingCenter(null);
    } catch (err: any) {
      onShowToast(`Lỗi gia hạn: ${err.message}`, 'error');
    } finally {
      setIsRenewing(false);
    }
  };

  const handleToggleCenterLock = async (center: any) => {
    const newStatus = center?.status === 'suspended' ? 'active' : 'suspended';
    try {
      await updateCenter(center.id, { status: newStatus });
      onShowToast(
        newStatus === 'active'
          ? `✓ Đã mở khóa trung tâm "${center?.name}"`
          : `⚠️ Đã khóa bản quyền trung tâm "${center?.name}"`,
        newStatus === 'active' ? 'success' : 'info'
      );
    } catch (err: any) {
      onShowToast(`Lỗi thay đổi trạng thái: ${err.message}`, 'error');
    }
  };

  const handleResetAccPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccForReset || !newAccPassword.trim()) return;

    setIsResettingPass(true);
    try {
      const target = selectedAccForReset.username || selectedAccForReset.email || selectedAccForReset.id;
      const res = await resetAccountPassword(target, newAccPassword.trim());
      if (res.success) {
        onShowToast(`✓ Đã đổi mật khẩu tài khoản ${selectedAccForReset.name || selectedAccForReset.username} thành công!`, 'success');
        setSelectedAccForReset(null);
        setNewAccPassword('');
      } else {
        onShowToast(res.message, 'error');
      }
    } catch (err: any) {
      onShowToast(`Lỗi reset mật khẩu: ${err.message}`, 'error');
    } finally {
      setIsResettingPass(false);
    }
  };

  const handleConfirmDeleteCenter = async () => {
    if (!deletingCenter) return;
    setIsDeletingCenter(true);
    try {
      await deleteCenter(deletingCenter.id, deletingCenter);
      setCenters((prev) => prev.filter((c) => c.id !== deletingCenter.id));
      setGlobalUsers((prev) => prev.filter((u) => u.centerId !== deletingCenter.id && u.centerId !== deletingCenter?.code));
      onShowToast(`✓ Đã xóa thành công trường / trung tâm "${deletingCenter.name}" trên Firebase và giải phóng toàn bộ username!`, 'success');
      setDeletingCenter(null);
    } catch (err: any) {
      onShowToast(`Lỗi khi xóa trung tâm: ${err.message}`, 'error');
    } finally {
      setIsDeletingCenter(false);
    }
  };

  const handleConfirmDeleteCenterAdmin = async () => {
    if (!deletingCenterAdmin) return;
    setIsDeletingCenterAdmin(true);
    try {
      const uid = deletingCenterAdmin.uid || deletingCenterAdmin.id;
      await deleteCenterAdminAccount(uid, deletingCenterAdmin.centerId);
      setGlobalUsers((prev) => prev.filter((u) => u.id !== uid && u.uid !== uid));
      onShowToast(`✓ Đã xóa thành công tài khoản Center Admin "${deletingCenterAdmin.name || deletingCenterAdmin.username}"!`, 'success');
      setDeletingCenterAdmin(null);
    } catch (err: any) {
      onShowToast(`Lỗi khi xóa tài khoản: ${err.message}`, 'error');
    } finally {
      setIsDeletingCenterAdmin(false);
    }
  };

  const handleToggleAccountLock = async (acc: any) => {
    try {
      const uid = acc.uid || acc.id;
      const newStatus = await toggleAccountLock(uid, acc.status || 'active', acc.centerId);
      onShowToast(
        newStatus === 'active'
          ? `✓ Đã mở khóa tài khoản Center Admin "${acc.name || acc.username}"`
          : `⚠️ Đã khóa tài khoản Center Admin "${acc.name || acc.username}"`,
        newStatus === 'active' ? 'success' : 'info'
      );
    } catch (err: any) {
      onShowToast(`Lỗi thay đổi trạng thái: ${err.message}`, 'error');
    }
  };

  const handleCreateCenterAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateUserError(null);
    setIsSubmittingUser(true);

    try {
      const finalCenterId = (newUserCenterId || (centers.length > 0 ? centers[0].id : '')).trim();
      if (!finalCenterId) {
        throw new Error('Mã Trường / Trung Tâm là BẮT BUỘC! Vui lòng chọn trường mà Center Admin phụ trách.');
      }
      if (!newUserUsername.trim()) {
        throw new Error('Tên đăng nhập (username) là BẮT BUỘC, không được để trống!');
      }
      if (!newUserName.trim()) {
        throw new Error('Họ và tên hiển thị là BẮT BUỘC, không được để trống!');
      }

      const cleanUser = normalizeUsername(newUserUsername);
      const selectedCenter = centers.find((c) => c.id === finalCenterId);

      const createdUser = await createSystemUser({
        centerId: finalCenterId,
        role: 'center_admin',
        name: newUserName.trim(),
        username: cleanUser,
        password: newUserPassword.trim() || '123456',
        email: newUserEmail.trim(),
        phone: newUserPhone.trim(),
      });

      // Gắn thông tin Center Admin vào document của Trung tâm
      try {
        await updateDoc(doc(db, 'centers', finalCenterId), {
          adminUsername: cleanUser,
          adminPassword: newUserPassword.trim() || '123456',
          adminUid: createdUser?.uid || cleanUser,
        });
      } catch (cErr) {
        console.warn('Lưu ý cập nhật center adminUid:', cErr);
      }

      onShowToast(
        `✓ Đã tạo thành công tài khoản Center Admin [${cleanUser}] phụ trách trường "${selectedCenter?.name || finalCenterId}"!`,
        'success'
      );

      setIsCreateUserModalOpen(false);
      setNewUserName('');
      setNewUserUsername('');
      setNewUserPassword('123456');
      setNewUserEmail('');
      setNewUserPhone('');
    } catch (err: any) {
      setCreateUserError(err.message || 'Lỗi khi tạo tài khoản');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Filtered lists calculated on centers
  const filteredCenters = centers.filter((c: any) => {
    if (!c) return false;
    const search = String(centerSearch || '').toLowerCase().trim();
    const nameMatch = String(c?.name || '').toLowerCase().includes(search);
    const codeMatch = String(c?.code || '').toLowerCase().includes(search);
    const matchSearch = nameMatch || codeMatch;
    if (statusFilter === 'active') return matchSearch && checkExpiryStatus(c).color === 'emerald';
    if (statusFilter === 'expired') return matchSearch && checkExpiryStatus(c).isExpired;
    return matchSearch;
  });

  const filteredCenterAdmins = centerAdminAccounts.filter((acc: any) => {
    if (!acc) return false;
    const targetCenter = centers.find((c) => c && c.id === acc.centerId);
    const centerName = String(targetCenter?.name || acc?.centerName || '');
    const search = String(accountSearch || '').toLowerCase().trim();
    const matchText = String(acc?.name || '').toLowerCase().includes(search) ||
                      String(acc?.fullName || '').toLowerCase().includes(search) ||
                      String(acc?.username || '').toLowerCase().includes(search) ||
                      String(acc?.email || '').toLowerCase().includes(search) ||
                      String(acc?.phone || '').toLowerCase().includes(search) ||
                      centerName.toLowerCase().includes(search);
    return matchText;
  });

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 pb-12">
      {/* Super Admin Top Banner Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B486B] via-[#0072B5] to-slate-900 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 border border-amber-300/40 px-3 py-1 text-xs font-black text-amber-300 backdrop-blur-md">
                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                <span>SUPER ADMIN SAAS MANAGEMENT PORTAL</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 text-[11px] font-extrabold text-emerald-300 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span>FIREBASE FIRESTORE REALTIME LIVE</span>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
              Bảng Điều Khiển Tối Cao &amp; Gia Hạn Bản Quyền Đa Trung Tâm
            </h1>
            <p className="text-xs md:text-sm text-blue-100 font-medium leading-relaxed">
              Quản lý toàn bộ danh sách Trung tâm, cấp tài khoản Center Admin, theo dõi thời hạn hợp đồng dịch vụ và gia hạn bản quyền hệ thống trực tiếp trên Cloud Firestore.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {centers.length === 0 && (
              <button
                type="button"
                onClick={handleSeedSampleCenter}
                disabled={isSubmittingCenter}
                className="flex items-center gap-2 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-black px-4 py-3.5 text-xs shadow-lg transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Đồng Bộ Trung Tâm Mẫu Tùy Chọn</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenCreateCenter}
              className="flex items-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-3.5 text-xs shadow-lg transition-all cursor-pointer"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Tạo Trung Tâm &amp; Cấp Bản Quyền</span>
            </button>
          </div>
        </div>
      </div>

      {/* SaaS Global Metrics Summary - CÁC THẺ THỐNG KÊ (STAT CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Thẻ 1: Tổng Số Trung Tâm */}
        <div className="rounded-3xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-blue-50 text-[#0072B5] shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-[#0B486B]">
              {isLoadingCenters ? <Loader2 className="w-5 h-5 animate-spin" /> : totalCenters}
            </div>
            <div className="text-xs font-bold text-slate-500">Tổng Số Trung Tâm</div>
          </div>
        </div>

        {/* Thẻ 2: Đang Hoạt Động Cực Tốt */}
        <div className="rounded-3xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-600 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-700">
              {isLoadingCenters ? <Loader2 className="w-5 h-5 animate-spin" /> : activeCenters}
            </div>
            <div className="text-xs font-bold text-slate-500">Đang Hoạt Động Cực Tốt</div>
          </div>
        </div>

        {/* Thẻ 3: Cảnh Báo Sắp Hết Hạn */}
        <div className="rounded-3xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-600 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-amber-700">
              {isLoadingCenters ? <Loader2 className="w-5 h-5 animate-spin" /> : warningCenters}
            </div>
            <div className="text-xs font-bold text-slate-500">Cảnh Báo Sắp Hết Hạn</div>
          </div>
        </div>

        {/* Thẻ 4: Hết Hạn / Tạm Khóa */}
        <div className="rounded-3xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-600 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-rose-700">
              {isLoadingCenters ? <Loader2 className="w-5 h-5 animate-spin" /> : expiredOrSuspendedCenters}
            </div>
            <div className="text-xs font-bold text-slate-500">Hết Hạn / Tạm Khóa</div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation - CÁC CON SỐ TRÊN TAB MENU */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('centers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-extrabold text-xs transition-all cursor-pointer ${
            activeTab === 'centers'
              ? 'bg-[#0072B5] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>1. Quản Lý Trung Tâm &amp; Gia Hạn Bản Quyền ({totalCenters})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-extrabold text-xs transition-all cursor-pointer ${
            activeTab === 'accounts'
              ? 'bg-[#0072B5] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>2. Quản Lý Tài Khoản Center Admin ({centerAdminCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-extrabold text-xs transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-[#0072B5] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>3. Cảnh Báo Hết Hạn &amp; Nhật Ký Bản Quyền ({warningCount})</span>
          {warningCount > 0 && (
            <span className={`ml-1 rounded-full text-[10px] font-black px-1.5 py-0.5 ${
              activeTab === 'analytics' ? 'bg-white text-rose-700' : 'bg-rose-500 text-white'
            }`}>
              {warningCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: CENTER MANAGEMENT & LICENSING */}
      {activeTab === 'centers' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={centerSearch}
                onChange={(e) => setCenterSearch(e.target.value)}
                placeholder="Tìm kiếm tên trung tâm, mã cơ sở..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">🟢 Đang hoạt động</option>
                <option value="expired">🔴 Hết hạn / Khóa</option>
              </select>
            </div>
          </div>

          {/* Centers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredCenters.map((center: CenterItem) => {
              const statusInfo = checkExpiryStatus(center);
              const isActiveCurrent = center.id === activeCenterId;

              return (
                <div
                  key={center.id}
                  className={`rounded-3xl p-5 border transition-all flex flex-col justify-between space-y-4 ${
                    statusInfo.isExpired
                      ? 'bg-rose-50/40 border-rose-300'
                      : isActiveCurrent
                      ? 'bg-gradient-to-br from-blue-50/80 via-white to-amber-50/40 border-[#0072B5] ring-2 ring-[#0072B5]/20 shadow-md'
                      : 'bg-white border-slate-200 hover:shadow-xs'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header Badges */}
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2.5 py-0.5">
                        <Crown className="w-3 h-3 text-amber-600" />
                        Gói: {center.packagePlan || 'Premium'}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full text-[10px] font-extrabold px-2.5 py-0.5 border ${
                          statusInfo.color === 'rose'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : statusInfo.color === 'amber'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {statusInfo.color === 'rose' ? (
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        )}
                        <span>{statusInfo.label}</span>
                      </span>
                    </div>

                    {/* Title */}
                    <div className="flex items-start gap-2.5">
                      <div className="p-2.5 rounded-2xl bg-[#0072B5] text-white shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-[#0072B5] bg-blue-50 px-2 py-0.5 rounded uppercase border border-blue-100">
                          Mã: {center.code || center.id || 'N/A'}
                        </span>
                        <h3 className="font-black text-sm text-slate-800 mt-1 leading-snug">{center.name || 'Trung tâm'}</h3>
                      </div>
                    </div>

                    {/* Admin Credentials Info */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1 text-xs">
                      <div className="font-extrabold text-[#0B486B] flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5 text-[#0072B5]" />
                        <span>Tài Khoản Center Admin Được Cấp:</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-700">
                        User: <strong className="text-slate-900">{center.adminUsername || `admin_${String(center.code || center.id || 'center').toLowerCase()}`}</strong> | Pass: <strong className="text-slate-900">{center.adminPassword || '123456'}</strong>
                      </div>
                    </div>

                    {/* Expiry Date */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <span className="text-slate-500 font-bold flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Thời hạn sử dụng:
                      </span>
                      <span className={`font-black ${statusInfo.isExpired ? 'text-rose-600' : 'text-slate-800'}`}>
                        {center.expiryDate || '2027-12-31'}
                      </span>
                    </div>
                  </div>

                  {/* Super Admin Actions */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase">Gia hạn nhanh:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setRenewingCenter(center)}
                          className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-black text-[10px] border border-amber-300 cursor-pointer flex items-center gap-1"
                        >
                          <Crown className="w-3 h-3 text-amber-600" />
                          <span>+ Gia Hạn Tùy Chỉnh</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleToggleCenterLock(center)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                          center.status === 'suspended'
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                        }`}
                        title={center.status === 'suspended' ? 'Mở khóa trung tâm' : 'Khóa trung tâm'}
                      >
                        {center.status === 'suspended' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        <span>{center.status === 'suspended' ? 'Mở Khóa' : 'Khóa'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditCenter(center)}
                        className="flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 text-xs font-bold cursor-pointer"
                        title="Chỉnh sửa thông tin trường"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Sửa</span>
                      </button>

                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => setDeletingCenter(center)}
                          className="flex items-center gap-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 text-xs font-bold cursor-pointer border border-rose-200 transition-all hover:border-rose-300"
                          title="Xóa toàn diện trung tâm (Cascade Delete)"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Xóa Trường</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredCenters.length === 0 && (
              <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0072B5] mx-auto flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-800">Chưa có dữ liệu Trung tâm phù hợp</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Nhấn nút <strong>"Tạo Trung Tâm &amp; Cấp Bản Quyền"</strong> ở trên để khởi tạo trung tâm đầu tiên và cấp tài khoản Center Admin trực tiếp lên Cloud Firestore.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreateCenter}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2 text-xs shadow-xs transition-all cursor-pointer mt-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo Trung Tâm Mới Ngay</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DEDICATED CENTER ADMIN ACCOUNTS MANAGEMENT */}
      {activeTab === 'accounts' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-black text-[#0B486B] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0072B5]" />
                <span>Quản Lý Tài Khoản Center Admin (Chủ Cơ Sở / Trường Học)</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Super Admin quản lý toàn quyền danh sách tài khoản Center Admin gắn với từng trường: Cấp mới, đổi mật khẩu, khóa hoặc xóa tài khoản.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  placeholder="Tìm theo tên, username, trường..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewUserCenterId(centers[0]?.id || '');
                  setCreateUserError(null);
                  setIsCreateUserModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0B486B] to-[#0072B5] hover:from-[#083652] hover:to-[#005a91] text-white px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Cấp Tài Khoản Center Admin</span>
              </button>
            </div>
          </div>

          {/* Center Admins Table */}
          {isLoadingUsers ? (
            <div className="p-8 text-center text-slate-400 font-semibold flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#0072B5]" />
              <span>Đang tải danh sách tài khoản Center Admin từ Firestore...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider">
                    <th className="p-3 rounded-l-xl">Họ Tên / Username</th>
                    <th className="p-3">Trường / Cơ Sở Phụ Trách</th>
                    <th className="p-3">Email / SĐT</th>
                    <th className="p-3">Mật Khẩu</th>
                    <th className="p-3">Trạng Thái</th>
                    <th className="p-3 text-right rounded-r-xl">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredCenterAdmins.map((acc: any) => {
                    if (!acc) return null;
                    const targetCenter = centers.find((c) => c && c.id === acc.centerId);
                    const centerDisplayName = String(targetCenter?.name || acc?.centerName || 'Chưa gán trường');
                    const centerCode = String(targetCenter?.code || acc?.centerId || '');
                    const isPassShown = Boolean(showPasswordMap[acc?.id || acc?.uid]);

                    return (
                      <tr key={acc.id || acc.uid} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3">
                          <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#0072B5]" />
                            <span>{acc.name || acc.fullName || acc.username}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">User: <strong className="text-slate-700">{acc.username}</strong></div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-[#0B486B]">{centerDisplayName}</div>
                          {centerCode && (
                            <span className="inline-block text-[10px] bg-blue-50 text-[#0072B5] font-bold px-1.5 py-0.5 rounded border border-blue-100 mt-0.5">
                              Mã: {centerCode}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600">
                          <div>{acc.email || '-'}</div>
                          <div className="text-[10px] text-slate-400">{acc.phone || '-'}</div>
                        </td>
                        <td className="p-3">
                          <div className="inline-flex items-center gap-1 font-mono font-bold bg-slate-100 px-2 py-1 rounded-lg text-[11px] text-slate-700">
                            <span>{isPassShown ? (acc.password || '123456') : '••••••'}</span>
                            <button
                              type="button"
                              onClick={() => toggleShowPassword(acc.id || acc.uid)}
                              className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                              title={isPassShown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            >
                              {isPassShown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              acc.status === 'locked' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {acc.status === 'locked' ? 'Đã khóa' : 'Hoạt động'}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAccForReset(acc);
                              setNewAccPassword(acc.password || '123456');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#0072B5] font-extrabold text-[10px] cursor-pointer"
                            title="Đặt lại mật khẩu"
                          >
                            Đổi Pass
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleAccountLock(acc)}
                            className={`px-2.5 py-1 rounded-lg font-extrabold text-[10px] cursor-pointer ${
                              acc.status === 'locked'
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                            }`}
                            title={acc.status === 'locked' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                          >
                            {acc.status === 'locked' ? 'Mở Khóa' : 'Khóa'}
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingCenterAdmin(acc)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-[10px] cursor-pointer"
                            title="Xóa tài khoản Center Admin này"
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCenterAdmins.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                        Chưa có tài khoản Center Admin nào. Nhấn <strong>"Cấp Tài Khoản Center Admin"</strong> ở trên để tạo tài khoản quản trị cho các trường.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EXPIRY WARNINGS & LICENSING AUDIT LOG */}
      {activeTab === 'analytics' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-black text-[#0B486B] flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <span>Cảnh Báo Hợp Đồng &amp; Nhật Ký Bản Quyền Đa Trung Tâm</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Bảng theo dõi hạn sử dụng dịch vụ SaaS, gói cước bản quyền và tính năng gia hạn tức thì trên Cloud Firestore.
              </p>
            </div>
          </div>

          {/* Section 1: Cảnh báo cần chú ý */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Trung Tâm Cần Chú Ý Hạn Bản Quyền</h3>
            {centers
              .filter((c) => checkExpiryStatus(c).color !== 'emerald')
              .map((c) => {
                const info = checkExpiryStatus(c);
                return (
                  <div key={c.id} className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 font-bold shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900">{c.name} (Mã: {c.code})</h4>
                        <p className="text-xs text-slate-600 font-medium">
                          Gói dịch vụ: <strong>{c.packagePlan || 'Premium'}</strong> | Hạn sử dụng: <strong className="text-rose-600">{c.expiryDate || '2027-12-31'}</strong> ({info.label})
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setRenewingCenter(c)}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Crown className="w-4 h-4" />
                      <span>Gia Hạn Bản Quyền Ngay</span>
                    </button>
                  </div>
                );
              })}

            {centers.filter((c) => checkExpiryStatus(c).color !== 'emerald').length === 0 && (
              <div className="p-4 text-center text-emerald-800 bg-emerald-50 rounded-2xl border border-emerald-200/80 font-extrabold text-xs flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Tất cả các trung tâm trong hệ thống đều đang có thời hạn hợp đồng dịch vụ hoạt động rất tốt!</span>
              </div>
            )}
          </div>

          {/* Section 2: Toàn bộ danh sách hợp đồng & hạn bản quyền */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Sổ Nhật Ký Hợp Đồng &amp; Bản Quyền Toàn Hệ Thống</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider">
                    <th className="p-3 rounded-l-xl">Tên Trung Tâm / Mã</th>
                    <th className="p-3">Gói Dịch Vụ</th>
                    <th className="p-3">Ngày Hết Hạn</th>
                    <th className="p-3">Trạng Thái Hạn</th>
                    <th className="p-3 text-right rounded-r-xl">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {centers.map((c) => {
                    const info = checkExpiryStatus(c);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3">
                          <div className="font-extrabold text-slate-900">{c.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">Code: {c.code} | ID: {c.id}</div>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2.5 py-0.5">
                            <Crown className="w-3 h-3 text-amber-600" />
                            {c.packagePlan || 'Premium'}
                          </span>
                        </td>
                        <td className="p-3 font-extrabold text-slate-700">
                          {c.expiryDate || '2027-12-31'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full text-[10px] font-extrabold px-2.5 py-0.5 border ${
                              info.color === 'rose'
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : info.color === 'amber'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}
                          >
                            {info.label}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => setRenewingCenter(c)}
                            className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] cursor-pointer inline-flex items-center gap-1"
                          >
                            <Crown className="w-3 h-3" />
                            <span>Gia Hạn</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {centers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                        Chưa có dữ liệu hợp đồng trung tâm nào trên Cloud Firestore.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gia Hạn Bản Quyền Custom */}
      {renewingCenter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-fade-in border border-slate-100 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-[#0B486B] flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                <span>Gia Hạn Hợp Đồng Bản Quyền Trung Tâm</span>
              </h3>
              <button
                type="button"
                onClick={() => setRenewingCenter(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
                <div className="font-extrabold text-slate-900">{renewingCenter.name}</div>
                <div className="text-slate-600 text-[11px]">Hạn hiện tại: <strong>{renewingCenter.expiryDate || '2027-12-31'}</strong></div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Chọn thời gian gia hạn thêm:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[3, 6, 12, 24].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRenewMonths(m)}
                      className={`p-3 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                        renewMonths === m
                          ? 'bg-[#0072B5] text-white border-[#0072B5] shadow-xs'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      + {m} Tháng ({m >= 12 ? `${m / 12} Năm` : ''})
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenewingCenter(null)}
                  className="rounded-xl px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isRenewing}
                  onClick={() => handleExecuteRenewal(renewingCenter.id, renewMonths)}
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 px-5 py-2 font-black cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  {isRenewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                  <span>Xác Nhận Gia Hạn</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Create/Edit Center */}
      {isCenterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl animate-fade-in border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-[#0B486B] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#0072B5]" />
                <span>{editingCenter ? 'Cập Nhật Bản Quyền Trung Tâm' : 'Tạo Trung Tâm Mới & Cấp Tài Khoản Admin'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCenterSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên Trung tâm / Cơ sở *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Trung tâm Học Giỏi - Cơ sở 4 (Hà Đông)"
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-bold text-slate-800 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã cơ sở *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="VD: HG04"
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số điện thoại hotline</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0988.123.456"
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-blue-50/60 p-3 rounded-2xl border border-blue-100">
                <div>
                  <label className="block font-bold text-[#0B486B] mb-1 flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    Gói bản quyền
                  </label>
                  <select
                    value={packagePlan}
                    onChange={(e) => setPackagePlan(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 p-2 font-bold text-slate-800 bg-white"
                  >
                    <option value="Basic">Gói Basic (Cơ bản)</option>
                    <option value="Standard">Gói Standard (Tiêu chuẩn)</option>
                    <option value="Premium">Gói Premium (Cao cấp)</option>
                    <option value="Enterprise">Gói Enterprise (Doanh nghiệp)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#0B486B] mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#0072B5]" />
                    Thời hạn đến ngày
                  </label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 font-bold text-slate-800 bg-white"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                <span className="font-extrabold text-slate-700 flex items-center gap-1.5 text-[#0B486B]">
                  <KeyRound className="w-4 h-4 text-[#0072B5]" />
                  Cấp Tài Khoản Đăng Nhập cho Center Admin:
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Username Admin</label>
                    <input
                      type="text"
                      required
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="center04_admin"
                      className="w-full rounded-xl border border-slate-300 p-2 font-bold text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Mật khẩu Admin</label>
                    <input
                      type="text"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="123456"
                      className="w-full rounded-xl border border-slate-300 p-2 font-bold text-slate-800 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCenter}
                  className="flex items-center gap-1.5 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white px-5 py-2 font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCenter ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{editingCenter ? 'Lưu Thay Đổi' : 'Tạo Trung Tâm & Cấp Tài Khoản'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {selectedAccForReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 text-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-[#0B486B] flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#0072B5]" />
                <span>Đổi Mật Khẩu Tài Khoản</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedAccForReset(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetAccPasswordSubmit} className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-800">{selectedAccForReset.name || selectedAccForReset.username}</div>
                <div className="text-[11px] text-slate-500 font-mono">User: {selectedAccForReset.username}</div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mật khẩu mới *</label>
                <input
                  type="text"
                  required
                  value={newAccPassword}
                  onChange={(e) => setNewAccPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-bold text-slate-800"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAccForReset(null)}
                  className="rounded-xl px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isResettingPass}
                  className="rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white px-4 py-2 font-bold cursor-pointer shadow-xs"
                >
                  {isResettingPass ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lưu Mật Khẩu Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cấp Tài Khoản Center Admin Mới */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 text-xs space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-2xl bg-blue-50 text-[#0072B5]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#0B486B]">Cấp Tài Khoản Center Admin Mới</h3>
                  <p className="text-[11px] text-slate-500">Khởi tạo tài khoản quản trị trường và đồng bộ lên Firebase</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateUserModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createUserError && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs font-semibold text-rose-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createUserError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCenterAdminSubmit} className="space-y-3.5">
              {/* Chọn Trường / Trung Tâm Phụ Trách (BẮT BUỘC) */}
              <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200 space-y-1">
                <label className="block font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#0072B5]" />
                  <span>Trường / Trung Tâm Phụ Trách * <span className="text-rose-600 font-extrabold">(Bắt buộc)</span></span>
                </label>
                {centers.length > 0 ? (
                  <select
                    required
                    value={newUserCenterId}
                    onChange={(e) => setNewUserCenterId(e.target.value)}
                    className="w-full rounded-xl border border-blue-300 bg-white p-2.5 font-bold text-slate-800"
                  >
                    <option value="">-- Chọn Trường / Cơ Sở Đào Tạo --</option>
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code || c.id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={newUserCenterId}
                    onChange={(e) => setNewUserCenterId(e.target.value)}
                    placeholder="Nhập ID trường..."
                    className="w-full rounded-xl border border-blue-300 bg-white p-2.5 font-bold text-slate-800"
                  />
                )}
                <p className="text-[10px] text-slate-500">
                  Tài khoản Center Admin được cấp sẽ chỉ có toàn quyền quản lý dữ liệu trong phạm vi trường được gán này.
                </p>
              </div>

              {/* Họ và tên */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Họ Và Tên Người Quản Trị *</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => {
                    setNewUserName(e.target.value);
                    if (!newUserUsername && e.target.value.trim()) {
                      setNewUserUsername(normalizeUsername(e.target.value));
                    }
                  }}
                  placeholder="VD: Nguyễn Văn Thắng (Chủ trung tâm)"
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-800"
                />
              </div>

              {/* Thông tin tài khoản đăng nhập */}
              <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/90 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                  <span>Thông Tin Đăng Nhập Firebase Auth</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tên đăng nhập (Username) *</label>
                    <input
                      type="text"
                      required
                      value={newUserUsername}
                      onChange={(e) => setNewUserUsername(normalizeUsername(e.target.value))}
                      placeholder="admin_coso1"
                      className="w-full rounded-xl border border-amber-300 bg-white p-2.5 font-mono font-bold text-slate-800"
                    />
                    <span className="text-[10px] text-slate-500">Viết liền, không dấu, chữ thường</span>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Mật khẩu (Password) *</label>
                    <input
                      type="text"
                      required
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="123456"
                      className="w-full rounded-xl border border-amber-300 bg-white p-2.5 font-mono font-bold text-slate-800"
                    />
                    <span className="text-[10px] text-slate-500">Tối thiểu 6 ký tự</span>
                  </div>
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Liên Hệ</label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="admin@trungtam.edu.vn"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số Điện Thoại Hotline</label>
                  <input
                    type="tel"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    placeholder="0988.123.456"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateUserModalOpen(false)}
                  className="rounded-xl px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="flex items-center gap-1.5 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white px-5 py-2 font-bold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmittingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>Cấp Tài Khoản Center Admin</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Xóa Trường An Toàn & Đệ Quy (Cascade Delete Center) */}
      {deletingCenter && (
        <DeleteCenterModal
          isOpen={Boolean(deletingCenter)}
          center={deletingCenter}
          currentUser={currentUser}
          onClose={() => setDeletingCenter(null)}
          onSuccess={(deletedCenterId) => {
            setCenters((prev) => prev.filter((c) => c.id !== deletedCenterId));
            setGlobalUsers((prev) => prev.filter((u) => u.centerId !== deletedCenterId && u.centerId !== deletingCenter?.code));
            if (onDeleteCenterSuccess) {
              onDeleteCenterSuccess(deletedCenterId);
            }
            setDeletingCenter(null);
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* Modal Xác Nhận Xóa Tài Khoản Center Admin */}
      {deletingCenterAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-rose-100 text-xs space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Xác Nhận Xóa Tài Khoản Center Admin</h3>
                <p className="text-slate-500 font-medium">Hành động này sẽ xóa tài khoản quản trị viên khỏi hệ thống</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 space-y-1.5">
              <div className="font-black text-sm text-rose-950">{deletingCenterAdmin.name || deletingCenterAdmin.username}</div>
              <div className="text-rose-800 text-[11px]">Tên đăng nhập: <strong>{deletingCenterAdmin.username}</strong></div>
              <div className="text-rose-800 text-[11px]">Trường phụ trách: <strong>{deletingCenterAdmin.centerName || deletingCenterAdmin.centerId || 'Không rõ'}</strong></div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isDeletingCenterAdmin}
                onClick={() => setDeletingCenterAdmin(null)}
                className="rounded-xl px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={isDeletingCenterAdmin}
                onClick={handleConfirmDeleteCenterAdmin}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 font-bold cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDeletingCenterAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Xác Nhận Xóa Tài Khoản</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
