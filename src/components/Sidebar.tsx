import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  School, 
  Users, 
  GraduationCap, 
  ClipboardCheck, 
  BookMarked, 
  BookOpen,
  CheckSquare, 
  HeartHandshake, 
  BarChart3, 
  ChevronDown, 
  ChevronRight,
  ShieldAlert,
  Sparkles,
  PhoneCall,
  KeyRound,
  Building2,
  Crown
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { UserRole } from './Header';
import { getStoredSession, UserAccount } from '../services/authService';
import { isTeacherRole, isParentRole } from '../services/firebaseService';

export type NavItemKey = 
  | 'dashboard' 
  | 'super-admin-portal'
  | 'admin-centers'
  | 'admin-classes' 
  | 'admin-teachers' 
  | 'admin-students'
  | 'admin-accounts'
  | 'teacher-attendance' 
  | 'teacher-assignments' 
  | 'teacher-grading'
  | 'parent-portal'
  | 'reports'
  | 'settings';

interface SidebarProps {
  currentRole: UserRole;
  currentUser?: UserAccount | null;
  onRoleChange: (role: UserRole) => void;
  activeNav: NavItemKey;
  onNavSelect: (key: NavItemKey) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  currentUser: propUser,
  onRoleChange,
  activeNav,
  onNavSelect,
  isMobileOpen,
  onCloseMobile,
}) => {
  const currentUser = propUser || getStoredSession();
  const isSuperAdminUser = currentUser?.role === 'super_admin' || currentUser?.username === 'admin';
  const isParentUser = !isSuperAdminUser && (
    isParentRole(currentUser?.role) || 
    (!currentUser?.role && isParentRole(currentRole)) ||
    (currentRole === 'parent' && currentUser?.role !== 'super_admin' && currentUser?.role !== 'center_admin' && !isTeacherRole(currentUser?.role))
  );
  const isTeacherUser = !isSuperAdminUser && !isParentUser && (
    isTeacherRole(currentUser?.role) || 
    (!currentUser?.role && isTeacherRole(currentRole)) ||
    (currentRole === 'teacher' && currentUser?.role !== 'super_admin' && currentUser?.role !== 'center_admin')
  );

  // Collapsible sections
  const [isAdminOpen, setIsAdminOpen] = useState(true);
  const [isTeacherOpen, setIsTeacherOpen] = useState(true);

  const handleItemClick = (key: NavItemKey) => {
    onNavSelect(key);
    if (window.innerWidth < 1024) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-slate-200 transition-transform duration-300 lg:static lg:translate-x-0 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Brand Logo Header */}
        <div className="flex h-20 items-center justify-between px-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/50 to-white">
          <BrandLogo size="md" />
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 text-sm">
          {/* 1. TRƯỜNG HỢP: GIÁO VIÊN ĐĂNG NHẬP -> CHỈ HIỂN THỊ MENU GIÁO VIÊN VÀ CÁC MỤC CON NHƯ HÌNH, ẨN CÁC MENU KHÁC */}
          {isTeacherUser ? (
            <div className="space-y-2 pt-1">
              {/* Header: GIÁO VIÊN */}
              <button
                type="button"
                onClick={() => setIsTeacherOpen(!isTeacherOpen)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-800 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4.5 h-4.5 text-[#00A86B] shrink-0" />
                  <span className="text-[13px] font-black tracking-wide text-slate-800">GIÁO VIÊN</span>
                </span>
                {isTeacherOpen ? (
                  <ChevronDown className="w-4 h-4 text-slate-500 transition-transform" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500 transition-transform" />
                )}
              </button>

              {/* Các menu/mục con của Giáo viên */}
              {isTeacherOpen && (
                <div className="space-y-1.5 px-0.5 mt-1">
                  {/* Mục 1: Điểm danh & Sĩ số */}
                  <button
                    type="button"
                    onClick={() => handleItemClick('teacher-attendance')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] transition-all cursor-pointer ${
                      activeNav === 'teacher-attendance'
                        ? 'bg-[#E8F8F0] text-[#00A86B] font-bold shadow-2xs'
                        : 'text-slate-800 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <ClipboardCheck className="w-4.5 h-4.5 text-[#00A86B] shrink-0" />
                    <span>Điểm danh &amp; Sĩ số</span>
                  </button>

                  {/* Mục 2: Giao bài tập */}
                  <button
                    type="button"
                    onClick={() => handleItemClick('teacher-assignments')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] transition-all cursor-pointer ${
                      activeNav === 'teacher-assignments'
                        ? 'bg-[#E8F8F0] text-[#00A86B] font-bold shadow-2xs'
                        : 'text-slate-800 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <BookMarked className="w-4.5 h-4.5 text-[#00A86B] shrink-0" />
                    <span>Giao bài tập</span>
                  </button>

                  {/* Mục 3: Chấm điểm & Nhận xét */}
                  <button
                    type="button"
                    onClick={() => handleItemClick('teacher-grading')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] transition-all cursor-pointer ${
                      activeNav === 'teacher-grading'
                        ? 'bg-[#E8F8F0] text-[#00A86B] font-bold shadow-2xs'
                        : 'text-slate-800 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <CheckSquare className="w-4.5 h-4.5 text-[#00A86B] shrink-0" />
                    <span>Chấm điểm &amp; Nhận xét</span>
                  </button>
                </div>
              )}
            </div>
          ) : isSuperAdminUser ? (
            /* 2. DÀNH RIÊNG CHO SUPER ADMIN: CHỈ HIỂN THỊ CỔNG SUPER ADMIN */
            <div className="space-y-3 pt-2">
              <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 flex items-center gap-2 text-xs font-extrabold">
                <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                <span>CỔNG HỆ THỐNG SUPER ADMIN</span>
              </div>

              <button
                onClick={() => handleItemClick('super-admin-portal')}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-extrabold transition-all shadow-xs ${
                  activeNav === 'super-admin-portal'
                    ? 'bg-gradient-to-r from-[#0072B5] to-[#0B486B] text-white shadow-md ring-2 ring-blue-400/30'
                    : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Crown className="w-4.5 h-4.5 text-amber-400 shrink-0" />
                <div className="text-left">
                  <div className="font-bold">Cổng Super Admin</div>
                  <div className="text-[10px] opacity-80 font-normal">Quản lý Đa Trung Tâm &amp; Gói cước</div>
                </div>
              </button>

              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-slate-700 space-y-1.5 mt-6">
                <div className="font-extrabold text-[#0B486B] flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-[#0072B5]" />
                  <span>Phân quyền Super Admin</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Tài khoản Super Admin được phân quyền điều hành nền tảng: xem danh sách các trung tâm, duyệt/từ chối yêu cầu gia hạn gói cước, bật/tắt hoạt động của các trung tâm.
                </p>
                <p className="text-[10px] italic text-slate-500 border-t border-blue-200/60 pt-1.5">
                  * Các chức năng quản lý lớp học, giáo viên, học sinh, điểm danh thuộc về tài khoản <strong>Center Admin (Chủ Trung Tâm)</strong>.
                </p>
              </div>
            </div>
          ) : isParentUser ? (
            /* 3. DÀNH CHO PHỤ HUYNH: CHỈ HIỂN THỊ MENU PHỤ HUYNH (SỔ LIÊN LẠC), ẨN CÁC MENU KHÁC */
            <div className="space-y-3 pt-1">
              <div className="px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <HeartHandshake className="w-4.5 h-4.5 text-[#F39C12] shrink-0" />
                <span className="text-[13px] font-black tracking-wide text-slate-800">PHỤ HUYNH</span>
              </div>

              <button
                type="button"
                onClick={() => handleItemClick('parent-portal')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-[13px] transition-all cursor-pointer ${
                  activeNav === 'parent-portal'
                    ? 'bg-[#FFF8EE] text-[#D97706] border border-amber-200/90 font-bold shadow-2xs ring-1 ring-amber-400/20'
                    : 'text-slate-700 hover:bg-slate-50 font-medium'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-amber-100/90 flex items-center justify-center shrink-0 shadow-2xs">
                  <HeartHandshake className="w-4.5 h-4.5 text-[#D97706]" />
                </div>
                <div className="text-left min-w-0">
                  <div className="font-extrabold text-[13px] leading-tight truncate">Phụ huynh (Sổ liên lạc)</div>
                  <div className="text-[10px] text-amber-700 font-medium mt-0.5 truncate">Theo dõi học tập &amp; Điểm danh</div>
                </div>
              </button>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-xs text-slate-700 space-y-1.5 mt-4">
                <div className="font-extrabold text-amber-900 flex items-center gap-1.5 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-[#F39C12]" />
                  <span>Sổ liên lạc điện tử</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Phụ huynh có thể theo dõi chuyên cần, lịch học, kết quả bài tập, nhận xét từ giáo viên và gửi đơn xin nghỉ trực tuyến.
                </p>
              </div>
            </div>
          ) : (
            /* 4. DÀNH CHO CENTER ADMIN: CHỈ HIỂN THỊ MENU QUẢN TRỊ TRUNG TÂM, BÁO CÁO THỐNG KÊ VÀ CÀI ĐẶT HỆ THỐNG. ẨN MENU GIÁO VIÊN. */
            <div className="space-y-3 pt-1">
              {/* Section: Quản trị Trung tâm */}
              <div>
                <button
                  type="button"
                  onClick={() => setIsAdminOpen(!isAdminOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-800 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#0072B5] shrink-0" />
                    <span className="text-[13px] font-black tracking-wide text-slate-800">QUẢN TRỊ TRUNG TÂM</span>
                  </span>
                  {isAdminOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-500 transition-transform" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500 transition-transform" />
                  )}
                </button>

                {isAdminOpen && (
                  <div className="space-y-1 px-0.5 mt-1">
                    {/* Mục 1: Tổng quan Trung tâm */}
                    <button
                      type="button"
                      onClick={() => handleItemClick('dashboard')}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeNav === 'dashboard'
                          ? 'bg-[#0072B5] text-white shadow-xs font-bold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeNav === 'dashboard' ? 'text-white' : 'text-[#0072B5]'}`} />
                      <span>Tổng quan Trung tâm</span>
                    </button>

                    {/* Mục 2: Quản lý Lớp học */}
                    <button
                      type="button"
                      onClick={() => handleItemClick('admin-classes')}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        activeNav === 'admin-classes'
                          ? 'bg-blue-50 text-[#0072B5] font-bold shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <School className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>Quản lý Lớp học</span>
                    </button>

                    {/* Mục 3: Quản lý Giáo viên */}
                    <button
                      type="button"
                      onClick={() => handleItemClick('admin-teachers')}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        activeNav === 'admin-teachers'
                          ? 'bg-blue-50 text-[#0072B5] font-bold shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Users className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>Quản lý Giáo viên</span>
                    </button>

                    {/* Mục 4: Quản lý Học sinh */}
                    <button
                      type="button"
                      onClick={() => handleItemClick('admin-students')}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        activeNav === 'admin-students'
                          ? 'bg-blue-50 text-[#0072B5] font-bold shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>Quản lý Học sinh</span>
                    </button>

                    {/* Mục 5: Tài khoản GV & Phụ huynh */}
                    <button
                      type="button"
                      onClick={() => handleItemClick('admin-accounts')}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        activeNav === 'admin-accounts'
                          ? 'bg-blue-50 text-[#0072B5] font-bold shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <KeyRound className="w-4 h-4 text-[#0072B5] shrink-0" />
                      <span>Tài khoản GV &amp; Phụ huynh</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Section: Báo cáo thống kê, Thông tin trường & Cài đặt hệ thống */}
              <div className="pt-2 border-t border-slate-200/80 space-y-1">
                {/* Menu: Báo cáo thống kê */}
                <button
                  type="button"
                  onClick={() => handleItemClick('reports')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    activeNav === 'reports'
                      ? 'bg-blue-50 text-[#0072B5] font-bold shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-[#0072B5] shrink-0" />
                  <span>Báo cáo thống kê</span>
                </button>

                {/* Menu: Thông tin Trường của bạn */}
                <button
                  type="button"
                  onClick={() => handleItemClick('admin-centers')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    activeNav === 'admin-centers'
                      ? 'bg-blue-50 text-[#0072B5] font-bold shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-[#0072B5] shrink-0" />
                  <span>Thông tin Trường của bạn</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* School Info & Hotline in Sidebar footer */}
        {!isSuperAdminUser && (
          <div className="p-3 border-t border-slate-200 bg-slate-50/80 space-y-2">
            <div className="rounded-xl bg-white p-2.5 border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-[#0072B5]" />
                <span>Cơ sở hoạt động</span>
              </div>
              <div className="text-xs font-black text-[#0B486B] truncate mt-0.5">
                {currentUser?.centerName || 'Cơ sở của bạn'}
              </div>
              <div className="text-[10px] text-emerald-700 font-extrabold flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Trạng thái: Hoạt động</span>
              </div>
            </div>

            {/* Hotline info */}
            <div className="flex items-center gap-2 rounded-xl bg-white p-2 border border-slate-200/70 text-[11px] text-slate-600">
              <PhoneCall className="w-3.5 h-3.5 text-[#0072B5] shrink-0" />
              <span className="truncate">Hỗ trợ: <strong className="text-slate-800">0912.345.678</strong></span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
