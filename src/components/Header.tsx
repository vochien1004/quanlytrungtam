import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  LogOut, 
  Clock, 
  UserCheck, 
  BookOpen, 
  ShieldCheck,
  Building2,
  ChevronDown,
  Crown
} from 'lucide-react';

import { UserAccount } from '../services/authService';
import { CenterItem, getValidTeacherName, isTeacherRole, isParentRole } from '../services/firebaseService';
import { TeacherItem } from '../data/mockData';
import { AccountAvatar } from './common/AccountAvatar';

export type UserRole = 'admin' | 'teacher' | 'parent';

interface HeaderProps {
  currentRole: UserRole;
  currentUser?: UserAccount | null;
  activeTeacher?: TeacherItem;
  teachers?: TeacherItem[];
  centers?: CenterItem[];
  activeCenterId?: string;
  onSelectCenter?: (centerId: string) => void;
  onRoleChange: (role: UserRole) => void;
  unreadCount?: number;
  onOpenNotifications: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  currentUser,
  activeTeacher,
  centers = [],
  activeCenterId = 'center_01',
  onSelectCenter,
  onRoleChange,
  unreadCount = 3,
  onOpenNotifications,
  onLogout,
}) => {
  const [timeString, setTimeString] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const datePart = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
      const timePart = now.toTimeString().split(' ')[0];
      setTimeString(`Current ${datePart} ${timePart} - GMT+7`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getAvatarUrl = (avatarUrl?: string | null, name?: string) => {
    if (avatarUrl && avatarUrl.trim() !== '') return avatarUrl;
    const displayName = name || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0072B5&color=fff&bold=true`;
  };

  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.username === 'admin';

  const getRoleInfo = () => {
    const role = currentUser?.role || currentRole;
    if (role === 'super_admin' || currentUser?.username === 'admin') {
      return { label: 'Super Admin', color: 'text-amber-600 font-black' };
    }
    if (role === 'center_admin' || role === 'admin') {
      return { label: 'Center Admin', color: 'text-[#0072B5] font-extrabold' };
    }
    if (isTeacherRole(role)) {
      return { label: 'Giáo viên', color: 'text-emerald-600 font-extrabold' };
    }
    if (isParentRole(role)) {
      return { label: 'Phụ huynh', color: 'text-amber-600 font-extrabold' };
    }
    return { label: 'Center Admin', color: 'text-[#0072B5] font-extrabold' };
  };

  const roleInfo = getRoleInfo();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/90 bg-white/95 px-4 md:px-6 backdrop-blur-md shadow-xs">
      {/* Left section: Center Info Badge or Super Admin Banner */}
      <div className="flex items-center gap-3">
        {isSuperAdmin ? (
          <div className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-extrabold text-amber-900 shadow-2xs">
            <Crown className="w-4 h-4 text-amber-500 shrink-0" />
            <span>CỔNG SUPER ADMIN - QUẢN LÝ HỆ THỐNG &amp; TRƯỜNG HỌC</span>
          </div>
        ) : (
          (() => {
            const currentCenter = centers.find(
              (c) =>
                c.id === activeCenterId ||
                c.id === currentUser?.centerId ||
                c.code === activeCenterId ||
                c.code === currentUser?.centerId ||
                (currentUser?.uid && c.adminUid === currentUser.uid) ||
                (currentUser?.username && c.adminUsername && c.adminUsername.toLowerCase() === currentUser.username.toLowerCase())
            ) || {
              name: currentUser?.centerName && currentUser.centerName !== 'Cơ sở Đào tạo' ? currentUser.centerName : 'Cơ sở Đào tạo',
              code: activeCenterId || currentUser?.centerId || '',
            };
            return (
              <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50/60 border border-blue-200/90 rounded-2xl px-3 py-1.5 text-xs shadow-2xs">
                <Building2 className="w-4 h-4 text-[#0072B5] shrink-0" />
                <span className="hidden sm:inline font-bold text-slate-500">Cơ sở:</span>
                <span className="font-black text-[#0B486B] max-w-[200px] sm:max-w-[300px] truncate">
                  {currentCenter.name}
                </span>
                {currentCenter.code && (
                  <span className="text-[10px] bg-blue-100/90 text-[#0072B5] font-black px-1.5 py-0.5 rounded border border-blue-200 uppercase">
                    {currentCenter.code}
                  </span>
                )}
              </div>
            );
          })()
        )}
      </div>

      {/* Right section: System Time, Notifications, User Profile & Logout */}
      <div className="flex items-center gap-3 md:gap-4">
        <div className="hidden xl:flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200/60 rounded-full px-3 py-1">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{timeString || 'Current 7/1/2024 16:00:00 - GMT+7'}</span>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            title="Thông báo mới"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#E74C3C] px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* User Profile Badge */}
        <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
          <AccountAvatar
            name={
              currentUser?.role === 'super_admin' || currentUser?.username === 'admin'
                ? (currentUser?.fullName || currentUser?.name || 'Super Admin')
                : currentUser?.role === 'center_admin'
                ? (centers.find((c) => c.id === currentUser?.centerId || c.id === activeCenterId || c.adminUid === currentUser?.uid || (currentUser?.username && c.adminUsername && c.adminUsername.toLowerCase() === currentUser.username.toLowerCase()))?.name || currentUser?.centerName || currentUser?.fullName || currentUser?.name || 'Trung Tâm Đào Tạo')
                : (isParentRole(currentUser?.role) || currentRole === 'parent')
                ? (currentUser?.fullName || currentUser?.name || currentUser?.displayName || 'Phụ huynh')
                : (isTeacherRole(currentUser?.role) || currentRole === 'teacher')
                ? (getValidTeacherName(currentUser?.fullName, currentUser?.name, currentUser?.displayName, activeTeacher?.fullName, activeTeacher?.name) || 'Giáo Viên')
                : (currentUser?.fullName || currentUser?.name || 'Admin')
            }
            role={currentUser?.role || currentRole}
            size="md"
            className="ring-2 ring-slate-200 shadow-2xs"
          />
          <div className="hidden md:block text-left">
            {/* Hiển thị Tên trung tâm của tài khoản center_admin, tên giáo viên, hoặc tên phụ huynh */}
            <div className="text-xs font-extrabold text-slate-800 leading-tight">
              {currentUser?.role === 'super_admin' || currentUser?.username === 'admin'
                ? (currentUser?.fullName || currentUser?.name || 'Super Admin')
                : currentUser?.role === 'center_admin'
                ? (centers.find((c) => c.id === currentUser?.centerId || c.id === activeCenterId || c.adminUid === currentUser?.uid || (currentUser?.username && c.adminUsername && c.adminUsername.toLowerCase() === currentUser.username.toLowerCase()))?.name || currentUser?.centerName || currentUser?.fullName || currentUser?.name || 'Trung Tâm Đào Tạo')
                : (isParentRole(currentUser?.role) || currentRole === 'parent')
                ? (currentUser?.fullName || currentUser?.name || currentUser?.displayName || 'Phụ Huynh Học Sinh')
                : (isTeacherRole(currentUser?.role) || currentRole === 'teacher')
                ? (getValidTeacherName(currentUser?.fullName, currentUser?.name, currentUser?.displayName, activeTeacher?.fullName, activeTeacher?.name) || 'Giáo Viên')
                : (currentUser?.fullName || currentUser?.name || 'Quản Trị Viên')}
            </div>
            <div className={`text-[10px] ${roleInfo.color}`}>
              {currentUser?.role === 'super_admin' || currentUser?.username === 'admin'
                ? 'Super Admin • Hệ thống'
                : currentUser?.role === 'center_admin'
                ? `Center Admin${currentUser?.fullName || currentUser?.name ? ` • ${currentUser.fullName || currentUser.name}` : ''}`
                : (isParentRole(currentUser?.role) || currentRole === 'parent')
                ? 'Phụ Huynh • Sổ liên lạc điện tử'
                : (isTeacherRole(currentUser?.role) || currentRole === 'teacher')
                ? `Giáo Viên • ${activeTeacher?.subject || currentUser?.subject || 'Bộ môn Văn hóa'}`
                : roleInfo.label}
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors ml-1 cursor-pointer"
            title="Đăng xuất hệ thống"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
