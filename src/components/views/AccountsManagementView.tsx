import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  Search, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  GraduationCap, 
  X,
  Plus,
  Trash2,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { 
  UserAccount, 
  getRealtimeAccounts, 
  resetAccountPassword, 
  deleteTeacherAccount,
  deleteParentAccount,
  getStoredSession,
  createUserAccount,
  areSameAccount
} from '../../services/authService';
import { normalizeUsername, generateCenterEmailDomain, resolveValidCenterId } from '../../services/firebaseService';
import { ConfirmDeleteModal } from '../admin/ConfirmDeleteModal';
import { AccountAvatar } from '../common/AccountAvatar';

interface AccountsManagementViewProps {
  currentUser?: UserAccount | null;
  activeCenterId?: string;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const AccountsManagementView: React.FC<AccountsManagementViewProps> = ({ 
  currentUser: propUser,
  activeCenterId: propCenterId,
  onShowToast 
}) => {
  const session = propUser || getStoredSession();
  const isCenterAdmin = session?.role === 'center_admin' || ((session?.role as string) === 'admin' && session?.username !== 'admin');
  const currentCenterId = (
    (isCenterAdmin && session?.centerId)
      ? session.centerId
      : (propCenterId || session?.centerId || '')
  ).trim();
  const currentCenterName = session?.centerName || session?.name || 'Cơ sở của bạn';
  const centerDomain = generateCenterEmailDomain(currentCenterName || currentCenterId);

  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'teacher' | 'parent'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Reset password modal
  const [selectedAccount, setSelectedAccount] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Delete modal
  const [deletingAccount, setDeletingAccount] = useState<UserAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create account modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRole, setNewRole] = useState<'teacher' | 'parent'>('teacher');
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPasswordVal, setNewPasswordVal] = useState('123456');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Tự động gợi ý username và email khi nhập họ tên
  const handleNameChange = (val: string) => {
    setNewName(val);
    const clean = normalizeUsername(val);
    const cleanCenter = (currentCenterId || 'center').toLowerCase().replace(/[^a-z0-9]/g, '') || 'center';
    if (clean && (!newUsername || newUsername.startsWith('gv_') || newUsername.startsWith('ph_'))) {
      const prefix = newRole === 'teacher' ? 'gv_' : 'ph_';
      const autoUser = `${prefix}${clean.slice(-10)}`;
      setNewUsername(autoUser);
      const isAutoEmail = !newEmail || (newEmail.includes('@') && (newEmail.endsWith('.com') || newEmail.endsWith('.system.local') || newEmail.endsWith('.hocgioi.edu.vn')));
      if (isAutoEmail) {
        setNewEmail(`${autoUser}@${cleanCenter}.hocgioi.edu.vn`);
      }
    }
  };

  const handleUsernameChange = (val: string) => {
    setNewUsername(val);
    const clean = normalizeUsername(val);
    const cleanCenter = (currentCenterId || 'center').toLowerCase().replace(/[^a-z0-9]/g, '') || 'center';
    const isAutoEmail = !newEmail || (newEmail.includes('@') && (newEmail.endsWith('.com') || newEmail.endsWith('.system.local') || newEmail.endsWith('.hocgioi.edu.vn')));
    if (clean && isAutoEmail) {
      setNewEmail(`${clean}@${cleanCenter}.hocgioi.edu.vn`);
    }
  };

  useEffect(() => {
    if (isCenterAdmin && !currentCenterId) {
      setIsLoading(true);
      return;
    }
    const unsub = getRealtimeAccounts(currentCenterId, (list: UserAccount[]) => {
      setAccounts(list);
      setIsLoading(false);
    });
    return () => unsub();
  }, [currentCenterId, isCenterAdmin]);

  const toggleShowPassword = (accountId: string) => {
    setShowPasswordMap((prev) => ({
      ...prev,
      [accountId]: !prev[accountId],
    }));
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    if (!newPassword || newPassword.length < 3) {
      onShowToast('Mật khẩu mới phải có ít nhất 3 ký tự.', 'error');
      return;
    }

    setIsResetting(true);
    try {
      const res = await resetAccountPassword(
        selectedAccount.uid || selectedAccount.id || selectedAccount.username, 
        newPassword,
        currentCenterId || selectedAccount.centerId
      );
      if (res.success) {
        onShowToast(`✓ Đã đổi mật khẩu cho tài khoản "${selectedAccount.name}" thành công!`, 'success');
        setSelectedAccount(null);
        setNewPassword('');
      } else {
        onShowToast(`Lỗi: ${res.message}`, 'error');
      }
    } catch (err: any) {
      onShowToast(`Lỗi: ${err.message}`, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAccount) return;
    setIsDeleting(true);
    try {
      if (deletingAccount.role === 'teacher') {
        await deleteTeacherAccount(deletingAccount.uid || deletingAccount.id, currentCenterId || deletingAccount.centerId);
      } else {
        await deleteParentAccount(deletingAccount.uid || deletingAccount.id, currentCenterId || deletingAccount.centerId);
      }
      onShowToast(`✓ Đã xóa tài khoản "${deletingAccount.name}" (${deletingAccount.username}) khỏi trường!`, 'success');
      setDeletingAccount(null);
    } catch (err: any) {
      onShowToast(`Lỗi khi xóa tài khoản: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);

    try {
      const validCenterId = await resolveValidCenterId(currentCenterId);
      if (!newUsername.trim()) {
        throw new Error('Tên đăng nhập (username) là BẮT BUỘC, không được để trống!');
      }
      if (!newName.trim()) {
        throw new Error('Họ và tên hiển thị là BẮT BUỘC, không được để trống!');
      }

      const cleanUser = normalizeUsername(newUsername);
      const createdAccount = await createUserAccount(session, {
        centerId: validCenterId,
        role: newRole,
        name: newName.trim(),
        fullName: newName.trim(),
        username: cleanUser,
        password: newPasswordVal.trim() || '123456',
        email: newEmail.trim(),
        phone: newPhone.trim(),
      });

      // Cập nhật ngay lập tức vào state accounts để tài khoản mới hiển thị tức thì trên giao diện
      if (createdAccount) {
        setAccounts((prev) => {
          const filtered = prev.filter((a) => !areSameAccount(a, createdAccount));
          return [createdAccount, ...filtered];
        });
      }

      // Xóa cache localStorage để tất cả các màn hình khác lập tức đồng bộ dữ liệu mới nhất từ Firebase
      try {
        if (validCenterId) {
          localStorage.removeItem('tt_hocgioi_teachers_' + validCenterId);
          localStorage.removeItem('tt_hocgioi_students_' + validCenterId);
        }
      } catch {}

      onShowToast(`✓ Đã tạo thành công tài khoản [${cleanUser}] thuộc trường của bạn!`, 'success');
      setIsCreateModalOpen(false);
      setNewName('');
      setNewUsername('');
      setNewPasswordVal('123456');
      setNewEmail('');
      setNewPhone('');
    } catch (err: any) {
      setCreateError(err.message || 'Lỗi khi tạo tài khoản');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRefreshSync = () => {
    setIsSyncing(true);
    setIsLoading(true);
    try {
      // Dọn sạch toàn bộ cache cục bộ để đảm bảo 100% dữ liệu thực từ Firestore
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('tt_hocgioi_teachers_') || k.startsWith('tt_hocgioi_students_') || k.startsWith('tt_hocgioi_classes_')) {
          localStorage.removeItem(k);
        }
      });
    } catch {}
    const unsub = getRealtimeAccounts(currentCenterId, (list: UserAccount[]) => {
      setAccounts(list);
      setIsLoading(false);
      setIsSyncing(false);
      const actualCount = list.filter(a => 
        (a.role === 'teacher' || (a.role as string) === 'teachers' || a.role === 'parent' || (a.role as string) === 'parents') &&
        (!currentCenterId || a.centerId === currentCenterId) &&
        (a.status as string) !== 'deleted' && !(a as any)._deleted
      ).length;
      onShowToast(`✓ Đã đồng bộ trực tiếp từ Firebase: Có ${actualCount} tài khoản thực trong cơ sở!`, 'success');
    });
    return () => unsub();
  };

  // LOGIC LỌC CHUẨN XÁC: Center Admin CHỈ xem tài khoản Giáo viên & Phụ huynh thực thuộc đúng trường của mình
  const centerAccounts = accounts.filter((acc, idx, arr) => {
    if (!acc) return false;
    if ((acc.status as string) === 'deleted' || (acc as any)._deleted || (acc.role as string) === 'deleted') {
      return false;
    }

    const isTeacher = acc.role === 'teacher' || (acc.role as string) === 'teachers';
    const isParent = acc.role === 'parent' || (acc.role as string) === 'parents' || (acc.role as string) === 'student';

    // 1. Loại bỏ tuyệt đối: super_admin, center_admin, admin
    if (!isTeacher && !isParent) {
      return false;
    }

    // 2. Center Admin CHỈ xem các tài khoản thuộc đúng cơ sở của mình (acc.centerId BẮT BUỘC phải khớp chính xác)
    if (isCenterAdmin) {
      if (!currentCenterId) return false;
      if (!acc.centerId || acc.centerId.trim() !== currentCenterId) {
        return false;
      }
    } else if (currentCenterId && acc.centerId && acc.centerId.trim() !== currentCenterId) {
      return false;
    }

    // 3. Khử trùng lặp tuyệt đối bằng areSameAccount để không bao giờ hiển thị 2 tài khoản giáo viên/phụ huynh giống nhau
    return arr.findIndex(a => areSameAccount(a, acc)) === idx;
  });

  const filteredAccounts = centerAccounts.filter((acc) => {
    const sTerm = searchTerm.toLowerCase();
    const matchesSearch =
      (acc.username || '').toLowerCase().includes(sTerm) ||
      (acc.name || acc.fullName || '').toLowerCase().includes(sTerm) ||
      (acc.phone && acc.phone.includes(searchTerm));
    const isTeacher = acc.role === 'teacher' || (acc.role as string) === 'teachers';
    const isParent = acc.role === 'parent' || (acc.role as string) === 'parents';
    const matchesRole = roleFilter === 'all' 
      ? true 
      : roleFilter === 'teacher' 
      ? isTeacher 
      : isParent;
    return matchesSearch && matchesRole;
  });

  const teacherCount = centerAccounts.filter((a) => a.role === 'teacher' || (a.role as string) === 'teachers').length;
  const parentCount = centerAccounts.filter((a) => a.role === 'parent' || (a.role as string) === 'parents').length;

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 pb-12">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0B486B] via-[#0072B5] to-[#0B486B] p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs">
              <KeyRound className="w-4 h-4 text-white" />
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-blue-200">
              Quản Trị Cơ Sở - {currentCenterName}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black mt-1">
            Quản Lý Tài Khoản Giáo Viên &amp; Phụ Huynh
          </h2>
          <p className="text-xs sm:text-sm text-blue-100/90 mt-1 max-w-2xl font-normal">
            Dữ liệu tài khoản Giáo viên và Phụ huynh thuộc cơ sở của bạn được đồng bộ tự động trên Firebase. 
            Center Admin có quyền cấp tài khoản, đổi mật khẩu và phân quyền lớp học.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md px-5 py-3.5 border border-white/20 text-center shrink-0">
            <span className="block text-2xl font-black">{centerAccounts.length}</span>
            <span className="text-[11px] text-blue-200 font-medium">Tài khoản GV &amp; PH</span>
          </div>
        </div>
      </div>

      {/* Role Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white p-5 border border-slate-200/90 shadow-2xs flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tài khoản Giáo Viên</div>
            <div className="text-2xl font-black text-slate-900">{teacherCount} tài khoản</div>
            <div className="text-[11px] text-slate-500">Điểm danh, giao bài tập, chấm điểm lớp học</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 border border-slate-200/90 shadow-2xs flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tài khoản Phụ Huynh</div>
            <div className="text-2xl font-black text-slate-900">{parentCount} tài khoản</div>
            <div className="text-[11px] text-slate-500">Xem sổ liên lạc điện tử, kết quả học tập</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl bg-white p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo username, tên, SĐT..."
            className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 focus:border-[#0072B5] focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'teacher', 'parent'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                roleFilter === r
                  ? 'bg-[#0072B5] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r === 'all'
                ? `Tất cả (${centerAccounts.length})`
                : r === 'teacher'
                ? `Giáo viên (${teacherCount})`
                : `Phụ huynh (${parentCount})`}
            </button>
          ))}

          <button
            type="button"
            onClick={handleRefreshSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 text-xs font-bold transition-all border border-slate-200 cursor-pointer shrink-0 ml-auto"
            title="Đồng bộ danh sách tài khoản thực trực tiếp từ Cloud Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#0072B5] ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Đồng bộ từ Firebase</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0B486B] to-[#0072B5] hover:from-[#083652] hover:to-[#005a91] text-white px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Tài Khoản</span>
          </button>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="rounded-3xl bg-white border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                <th className="p-4">Tài khoản &amp; Họ tên</th>
                <th className="p-4">Tên đăng nhập (Username)</th>
                <th className="p-4">Mật khẩu (Firebase)</th>
                <th className="p-4">Vai trò &amp; Quyền hạn</th>
                <th className="p-4">Liên kết Đơn vị / Lớp</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#0072B5]" />
                      <span>Đang tải danh sách tài khoản từ Firestore...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                    {centerAccounts.length === 0
                      ? 'Chưa có tài khoản Giáo viên hoặc Phụ huynh nào trong trường. Bấm "+ Thêm Tài Khoản" để cấp tài khoản mới.'
                      : 'Không tìm thấy tài khoản phù hợp với từ khóa tìm kiếm.'}
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => {
                  const isVisible = showPasswordMap[acc.id] || false;
                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <AccountAvatar
                            name={acc?.name || 'User'}
                            role={acc?.role}
                            size="md"
                            shape="rounded"
                            className="shrink-0"
                          />
                          <div>
                            <div className="font-extrabold text-slate-900 text-xs">{acc.name}</div>
                            <div className="text-[11px] text-slate-500">{acc.email || acc.phone || 'Chưa cập nhật SĐT'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          {acc.username}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-700 bg-amber-50/80 border border-amber-200 px-2 py-0.5 rounded-md">
                            {isVisible ? (acc.password || '123456') : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleShowPassword(acc.id)}
                            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                            title={isVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          >
                            {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="p-4">
                        {acc.role === 'teacher' || (acc.role as string) === 'teachers' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold border border-emerald-200">
                            <Users className="w-3 h-3 text-emerald-600" />
                            Giáo viên
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[10px] font-bold border border-amber-200">
                            <GraduationCap className="w-3 h-3 text-amber-600" />
                            Phụ huynh
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-600 font-medium">
                        {acc.entityName || 'Chưa phân lớp'}
                      </td>
                      <td className="p-4 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAccount(acc);
                            setNewPassword('');
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0072B5] bg-blue-50 border border-blue-200 hover:bg-blue-100 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Đổi MK</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingAccount(acc)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                          title="Xóa tài khoản khỏi trường"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ĐỔI MẬT KHẨU CHO TÀI KHOẢN */}
      {selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0072B5]">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Đặt Lại Mật Khẩu
                  </h3>
                  <p className="text-[11px] text-slate-500">Tài khoản: {selectedAccount.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAccount(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="mt-4 space-y-4 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800">Chủ tài khoản: {selectedAccount.name}</div>
                <div className="text-slate-500">
                  Vai trò: <strong>{selectedAccount.role === 'teacher' ? 'Giáo viên' : 'Phụ huynh'}</strong> &bull; Username: <strong>{selectedAccount.username}</strong>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mật khẩu mới *:
                </label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-[#0072B5] focus:outline-hidden"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedAccount(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-5 py-2 rounded-xl bg-[#0072B5] hover:bg-[#083652] text-white font-bold cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isResetting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Lưu Mật Khẩu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: XÁC NHẬN XÓA TÀI KHOẢN */}
      {deletingAccount && (
        <ConfirmDeleteModal
          isOpen={!!deletingAccount}
          title="Xác nhận xóa tài khoản"
          itemName={deletingAccount.name || deletingAccount.fullName || deletingAccount.username}
          itemType="tài khoản"
          itemCode={deletingAccount.role === 'teacher' ? 'Giáo viên' : 'Phụ huynh'}
          itemSubInfo={`Tên đăng nhập: @${deletingAccount.username} • Vai trò: ${deletingAccount.role === 'teacher' ? 'Giáo viên' : 'Phụ huynh'} • SĐT: ${deletingAccount.phone || 'Chưa cập nhật'}`}
          warningNote={`CẢNH BÁO QUAN TRỌNG: Thao tác này sẽ xóa vĩnh viễn tài khoản "${deletingAccount.name}" (@${deletingAccount.username}) khỏi hệ thống và Firestore. Người dùng sẽ không thể đăng nhập được nữa.`}
          isDeleting={isDeleting}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeletingAccount(null)}
        />
      )}

      {/* MODAL: THÊM TÀI KHOẢN MỚI */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0072B5]">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Cấp Tài Khoản Mới Cho Trường
                  </h3>
                  <p className="text-[11px] text-slate-500">Cơ sở: <strong>{currentCenterName}</strong></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAccount} className="space-y-3.5 text-xs">
              {/* Vai trò */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Vai trò tài khoản <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setNewRole('teacher')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl font-bold border transition-all cursor-pointer ${
                      newRole === 'teacher'
                        ? 'border-[#0072B5] bg-blue-50/70 text-[#0072B5] shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Giáo Viên</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole('parent')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl font-bold border transition-all cursor-pointer ${
                      newRole === 'parent'
                        ? 'border-amber-500 bg-amber-50/70 text-amber-800 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Phụ Huynh</span>
                  </button>
                </div>
              </div>

              {/* Họ tên */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Họ và tên hiển thị <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={newRole === 'teacher' ? 'Ví dụ: Cô Nguyễn Thị Lan' : 'Ví dụ: Phụ huynh em Nguyễn Văn An'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:border-[#0072B5] focus:outline-hidden"
                />
              </div>

              {/* Username & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tên đăng nhập (Username) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="lan_toan hoặc 0912345678"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:border-[#0072B5] focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mật khẩu ban đầu
                  </label>
                  <input
                    type="text"
                    value={newPasswordVal}
                    onChange={(e) => setNewPasswordVal(e.target.value)}
                    placeholder="Mặc định: 123456"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:border-[#0072B5] focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="0912.345.678"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:border-[#0072B5] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Email liên hệ <span className="text-[10px] text-[#0072B5] font-normal">(tự động @{centerDomain})</span>
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder={`VD: ${newUsername || 'username'}@${centerDomain}`}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:border-[#0072B5] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0B486B] to-[#0072B5] hover:from-[#083652] hover:to-[#005a91] text-white font-bold cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Tạo Tài Khoản</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
