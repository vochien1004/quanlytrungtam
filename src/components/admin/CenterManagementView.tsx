import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  CheckCircle2, 
  Edit3, 
  Loader2, 
  Calendar, 
  Crown, 
  Clock, 
  ShieldCheck, 
  Users, 
  School, 
  GraduationCap, 
  Info,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Trash2,
  FileText
} from 'lucide-react';
import {
  CenterItem,
  updateCenter,
  RenewalRequestItem,
  getRealtimeRenewalRequests
} from '../../services/firebaseService';
import { UserAccount } from '../../services/authService';
import { DeleteCenterModal } from './DeleteCenterModal';
import { CenterRenewalModal } from './CenterRenewalModal';
import { CenterRenewalListModal } from './CenterRenewalListModal';

interface CenterManagementViewProps {
  centers: CenterItem[];
  activeCenterId: string;
  currentUser?: UserAccount | null;
  classesCount?: number;
  teachersCount?: number;
  studentsCount?: number;
  openRenewalListTrigger?: number;
  onSelectCenter?: (centerId: string) => void;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onDeleteCenterSuccess?: (deletedCenterId: string) => void;
}

export const CenterManagementView: React.FC<CenterManagementViewProps> = ({
  centers,
  activeCenterId,
  currentUser,
  classesCount = 0,
  teachersCount = 0,
  studentsCount = 0,
  openRenewalListTrigger = 0,
  onShowToast,
  onDeleteCenterSuccess,
}) => {
  // Tìm đúng trung tâm của Center Admin hiện tại
  const targetCenterId = currentUser?.centerId || activeCenterId;
  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.username === 'admin';
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const currentCenter = centers.find((c) => c.id === targetCenterId) || centers[0] || {
    id: targetCenterId || 'center_01',
    name: currentUser?.centerName || 'Trung Tâm Đào Tạo',
    code: targetCenterId || 'HG01',
    address: 'Chưa cập nhật địa chỉ',
    phone: currentUser?.phone || '0900.000.000',
    email: currentUser?.email || 'admin@trungtam.edu.vn',
    packagePlan: 'Premium',
    expiryDate: '2026-12-31',
    status: 'active',
  };

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
  const [isRenewalHighlighted, setIsRenewalHighlighted] = useState(false);
  const [allRenewalRequests, setAllRenewalRequests] = useState<RenewalRequestItem[]>([]);
  const renewalListSectionRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(currentCenter.name);
  const [address, setAddress] = useState(currentCenter.address || '');
  const [phone, setPhone] = useState(currentCenter.phone || '');
  const [email, setEmail] = useState(currentCenter.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scrollToRenewalSection = useCallback(() => {
    setTimeout(() => {
      renewalListSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      setIsRenewalHighlighted(true);
      setTimeout(() => {
        setIsRenewalHighlighted(false);
      }, 2500);
    }, 100);
  }, []);

  // Lắng nghe danh sách đăng ký gia hạn theo thời gian thực
  useEffect(() => {
    const unsub = getRealtimeRenewalRequests((list) => {
      setAllRenewalRequests(list);
    });
    return () => unsub();
  }, []);

  // Tự động cuộn đến phần Danh sách đăng ký gia hạn khi được chuyển hướng sau khi gửi gia hạn thành công
  useEffect(() => {
    if (openRenewalListTrigger > 0) {
      scrollToRenewalSection();
    }
  }, [openRenewalListTrigger, scrollToRenewalSection]);

  // Lọc danh sách yêu cầu gia hạn của trường hiện tại
  const centerRenewalRequests = allRenewalRequests.filter((req) => {
    const matchId = req.centerId && currentCenter.id && req.centerId === currentCenter.id;
    const matchCode =
      req.centerCode &&
      currentCenter.code &&
      req.centerCode.toUpperCase() === currentCenter.code.toUpperCase();
    return Boolean(matchId || matchCode);
  });

  const pendingRenewalCount = centerRenewalRequests.filter(
    (r) => r.status === 'pending' || !r.status
  ).length;

  const handleOpenEdit = () => {
    setName(currentCenter.name);
    setAddress(currentCenter.address || '');
    setPhone(currentCenter.phone || '');
    setEmail(currentCenter.email || '');
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await updateCenter(currentCenter.id, {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
      if (onShowToast) {
        onShowToast(`✓ Đã cập nhật thành công thông tin trường "${name}"!`, 'success');
      }
      setIsEditModalOpen(false);
    } catch (err: any) {
      console.error('Lỗi khi cập nhật trường:', err);
      if (onShowToast) onShowToast(`Lỗi: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tính toán số ngày còn lại của hạn dịch vụ (chuẩn hóa theo mốc 0h đầu ngày)
  const expiryRaw = currentCenter.expiryDate;
  let daysRemaining: number | null = null;
  let isExpiringSoon = false;
  let isExpired = false;

  if (expiryRaw) {
    const parts = expiryRaw.split('-');
    let expiryDate: Date;
    if (parts.length === 3) {
      expiryDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      expiryDate = new Date(expiryRaw);
    }

    if (!isNaN(expiryDate.getTime())) {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const expiryStartOfDay = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate()).getTime();
      const diffMs = expiryStartOfDay - startOfToday;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      
      daysRemaining = diffDays;
      isExpired = diffDays < 0;
      isExpiringSoon = diffDays >= 0 && diffDays <= 7;
    }
  }

  const isSuspended = currentCenter.status === 'suspended';

  // Xác định yêu cầu gia hạn đã được duyệt gần nhất của trường
  const latestApprovedRenewal =
    centerRenewalRequests.find((r) => r.status === 'approved') ||
    ((currentCenter as any)?.latestRenewalRequest?.status === 'approved'
      ? (currentCenter as any).latestRenewalRequest
      : null);

  // Xác định tên Gói cước đang sử dụng thực tế (cập nhật ngay khi yêu cầu gia hạn đã được duyệt)
  const rawPackagePlan = String(currentCenter.packagePlan || '').trim();
  const isTrialPlanName = /trial|dùng thử|dung thu/i.test(rawPackagePlan);

  let resolvedPlanCode = rawPackagePlan;
  if (latestApprovedRenewal && Number(latestApprovedRenewal.months) > 0) {
    resolvedPlanCode = `${Number(latestApprovedRenewal.months)} Tháng`;
  } else if (isTrialPlanName && daysRemaining !== null && daysRemaining > 35) {
    if (daysRemaining > 200) {
      resolvedPlanCode = '12 Tháng';
    } else if (daysRemaining > 100) {
      resolvedPlanCode = '6 Tháng';
    } else {
      resolvedPlanCode = '3 Tháng';
    }
  }

  const activePackageDisplayName = resolvedPlanCode
    ? resolvedPlanCode.toLowerCase().startsWith('gói ')
      ? resolvedPlanCode
      : `Gói ${resolvedPlanCode}`
    : 'Gói Tiêu Chuẩn (Standard)';

  // Tự động đồng bộ lại packagePlan lên Firestore nếu dữ liệu cũ vẫn lưu "Trial" sau khi đã duyệt gia hạn
  useEffect(() => {
    if (
      currentCenter?.id &&
      isTrialPlanName &&
      resolvedPlanCode &&
      resolvedPlanCode !== rawPackagePlan
    ) {
      updateCenter(currentCenter.id, { packagePlan: resolvedPlanCode }).catch(() => {});
    }
  }, [currentCenter?.id, isTrialPlanName, resolvedPlanCode, rawPackagePlan]);

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 pb-12">
      {/* CẢNH BÁO NỔI BẬT ĐẦU TRANG CHO CENTER ADMIN NẾU SẮP HẾT HẠN HOẶC ĐÃ HẾT HẠN */}
      {isExpired ? (
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
                  Quá hạn {Math.abs(daysRemaining ?? 0)} ngày
                </span>
              </div>
              <h3 className="text-base md:text-lg font-black text-rose-950">
                Gói bản quyền của trường đã hết hạn sử dụng!
              </h3>
              <p className="text-xs md:text-sm text-rose-800 leading-relaxed font-medium">
                Hạn dịch vụ đã kết thúc vào ngày <strong>{currentCenter.expiryDate}</strong>. Vui lòng liên hệ ngay Quản Trị Viên Hệ Thống (Super Admin) để thanh toán gia hạn, tránh bị tạm ngừng truy cập các tính năng quản lý và điểm danh.
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
      ) : isExpiringSoon ? (
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
                  {daysRemaining === 0 ? 'Hôm nay là ngày cuối cùng' : `Chỉ còn ${daysRemaining} ngày nữa`}
                </span>
              </div>
              <h3 className="text-base md:text-lg font-black text-amber-950">
                Gói dịch vụ của trường sắp hết hạn sử dụng!
              </h3>
              <p className="text-xs md:text-sm text-amber-900 leading-relaxed font-medium">
                Thời hạn bản quyền hệ thống của trung tâm sẽ kết thúc vào ngày <strong>{currentCenter.expiryDate}</strong> ({daysRemaining === 0 ? 'hôm nay' : `còn ${daysRemaining} ngày`}). Quản trị viên vui lòng liên hệ Super Admin gia hạn sớm để dịch vụ hoạt động liên tục, không làm gián đoạn việc giảng dạy và tương tác phụ huynh.
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

      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B486B] via-[#0072B5] to-slate-900 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-400/20 border border-blue-300/40 px-3 py-1 text-xs font-black text-blue-200 backdrop-blur-md">
                <Building2 className="w-4 h-4 text-blue-300 shrink-0" />
                <span>HỒ SƠ &amp; THÔNG TIN CƠ SỞ TRƯỜNG HỌC</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 text-[11px] font-extrabold text-emerald-300 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span>KHÔNG GIAN ĐỘC LẬP</span>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
              {currentCenter.name}
            </h1>
            <p className="text-xs md:text-sm text-blue-100 font-medium leading-relaxed">
              Mã cơ sở: <strong className="text-amber-300 uppercase">{currentCenter.code}</strong> • Quản lý thông tin liên hệ, địa chỉ đào tạo và theo dõi gói bản quyền sử dụng của trường.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={scrollToRenewalSection}
              className="flex items-center gap-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-5 py-3.5 text-xs shadow-lg transition-all cursor-pointer shrink-0"
            >
              <FileText className="w-4 h-4 text-slate-900" />
              <span>Danh sách đăng ký gia hạn ({centerRenewalRequests.length})</span>
            </button>

            <button
              type="button"
              onClick={handleOpenEdit}
              className="flex items-center gap-2 rounded-2xl bg-white hover:bg-slate-100 text-[#0B486B] font-black px-5 py-3.5 text-xs shadow-lg transition-all cursor-pointer shrink-0"
            >
              <Edit3 className="w-4 h-4 text-[#0072B5]" />
              <span>Cập Nhật Thông Tin Trường</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: School Contact & Location Details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card: Thông tin liên hệ cơ sở */}
          <div className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-blue-50 text-[#0072B5]">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Chi Tiết Trụ Sở &amp; Liên Hệ</h2>
                  <p className="text-xs text-slate-500 font-medium">Thông tin hiển thị trên báo cáo và phiếu liên lạc</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-[#0072B5] border border-blue-100">
                Mã: {currentCenter.code}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tên Cơ Sở</div>
                <div className="text-sm font-black text-slate-800">{currentCenter.name}</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tài Khoản Phụ Trách (Center Admin)</div>
                <div className="text-sm font-black text-[#0072B5] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{currentUser?.name || currentCenter.adminUsername || 'Center Admin'}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Hotline / Số Điện Thoại</span>
                </div>
                <div className="text-sm font-bold text-slate-800">{currentCenter.phone || 'Chưa cập nhật'}</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email Tiếp Nhận</span>
                </div>
                <div className="text-sm font-bold text-slate-800">{currentCenter.email || 'Chưa cập nhật'}</div>
              </div>

              <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Địa Chỉ Trụ Sở Đào Tạo</span>
                </div>
                <div className="text-sm font-bold text-slate-800">{currentCenter.address || 'Chưa cập nhật địa chỉ cơ sở'}</div>
              </div>
            </div>
          </div>

          {/* Card: Thống kê quy mô cơ sở */}
          <div className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Quy Mô Cơ Sở Hiện Tại</span>
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 text-center">
                <School className="w-5 h-5 text-[#0072B5] mx-auto mb-1" />
                <div className="text-2xl font-black text-[#0B486B]">{classesCount}</div>
                <div className="text-[11px] font-bold text-slate-600">Lớp Học</div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-center">
                <Users className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                <div className="text-2xl font-black text-indigo-900">{teachersCount}</div>
                <div className="text-[11px] font-bold text-slate-600">Giáo Viên</div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-center">
                <GraduationCap className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <div className="text-2xl font-black text-emerald-900">{studentsCount}</div>
                <div className="text-[11px] font-bold text-slate-600">Học Sinh</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: License Status & SaaS Policy Note */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card: Thông tin bản quyền SaaS */}
          <div className={`rounded-3xl bg-white border p-6 shadow-xs space-y-5 transition-all ${
            isExpired 
              ? 'border-rose-400 ring-4 ring-rose-500/10' 
              : isExpiringSoon 
                ? 'border-amber-400 ring-4 ring-amber-500/10' 
                : 'border-slate-200/90'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${
                  isExpired 
                    ? 'bg-rose-50 text-rose-600' 
                    : isExpiringSoon 
                      ? 'bg-amber-100 text-amber-700' 
                      : 'bg-amber-50 text-amber-600'
                }`}>
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Bản Quyền &amp; Hạn Dịch Vụ</h2>
                  <p className="text-xs text-slate-500 font-medium">Gói cước cấp phép hệ thống SaaS</p>
                </div>
              </div>

              {isExpiringSoon && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-amber-500 text-white shadow-xs animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Sắp hết hạn
                </span>
              )}
              {isExpired && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-rose-600 text-white shadow-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Đã hết hạn
                </span>
              )}
            </div>

            {/* CẢNH BÁO NỔI BẬT NỘI BỘ CARD KHI GẦN HẾT HẠN (<= 7 NGÀY) */}
            {isExpiringSoon && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/10 border-2 border-amber-400 text-amber-950 shadow-xs space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5 shadow-xs animate-bounce">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="font-black text-xs uppercase tracking-wide text-amber-950 flex items-center gap-1.5">
                        ⚠ Gói Cước Sắp Hết Hạn
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black shadow-xs">
                        {daysRemaining === 0 ? 'Hết hạn hôm nay' : `Còn ${daysRemaining} ngày`}
                      </span>
                    </div>
                    <p className="text-xs text-amber-900 font-medium leading-relaxed">
                      Thời hạn bản quyền của trường sẽ kết thúc vào <strong>{currentCenter.expiryDate}</strong> ({daysRemaining === 0 ? 'hôm nay' : `chỉ còn ${daysRemaining} ngày nữa`}). Vui lòng liên hệ <strong>Super Admin</strong> để gia hạn, tránh làm gián đoạn việc giảng dạy và điểm danh.
                    </p>
                    <div className="pt-0.5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsRenewalModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-colors shadow-xs cursor-pointer"
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>Gia hạn ngay</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CẢNH BÁO NỔI BẬT NỘI BỘ CARD KHI ĐÃ HẾT HẠN */}
            {isExpired && (
              <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-400 text-rose-950 shadow-xs space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0 mt-0.5 shadow-xs">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="font-black text-xs uppercase tracking-wide text-rose-950 block">
                        ✕ Gói Dịch Vụ Đã Hết Hạn
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black shadow-xs">
                        Quá hạn {Math.abs(daysRemaining ?? 0)} ngày
                      </span>
                    </div>
                    <p className="text-xs text-rose-900 font-medium leading-relaxed">
                      Thời hạn bản quyền đã kết thúc vào ngày <strong>{currentCenter.expiryDate}</strong>. Hệ thống có thể bị tạm ngưng truy cập. Vui lòng liên hệ ngay Quản trị viên Super Admin để kích hoạt lại.
                    </p>
                    <div className="pt-0.5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsRenewalModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-colors shadow-xs cursor-pointer"
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>Gia hạn ngay</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/70">
                <div>
                  <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Gói Cước Đang Sử Dụng</div>
                  <div className="text-base font-black text-amber-950">
                    {activePackageDisplayName}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={scrollToRenewalSection}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-blue-50 text-[#0B486B] border border-slate-200 font-black text-xs shadow-2xs transition-all cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#0072B5]" />
                    <span>Danh sách gia hạn ({centerRenewalRequests.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRenewalModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-xs transition-all cursor-pointer"
                  >
                    <Crown className="w-4 h-4" />
                    <span>Gia hạn ngay</span>
                  </button>
                </div>
              </div>

              {pendingRenewalCount > 0 && (
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-blue-50/90 border border-blue-200 text-xs">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-[#0072B5] shrink-0" />
                    <div>
                      <div className="font-black text-[#0B486B]">
                        Đang có {pendingRenewalCount} yêu cầu đăng ký gia hạn chờ duyệt
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium">
                        Nhấn để xem chi tiết thời gian đăng ký, gói cước, tình trạng hoặc hủy yêu cầu
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={scrollToRenewalSection}
                    className="px-3 py-1.5 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white font-black text-[11px] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Xem danh sách
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Trạng Thái Kích Hoạt</div>
                  <div className="mt-1">
                    {isSuspended ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-700 border border-rose-200">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Tạm Khóa
                      </span>
                    ) : isExpired ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-700 border border-rose-300">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Đã Hết Hạn Dịch Vụ
                      </span>
                    ) : isExpiringSoon ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                        Sắp Hết Hạn ({daysRemaining === 0 ? 'Hôm nay' : `Còn ${daysRemaining} ngày`})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Đang Hoạt Động
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                isExpired 
                  ? 'bg-rose-50/90 border-rose-300 text-rose-950' 
                  : isExpiringSoon 
                    ? 'bg-amber-50/90 border-amber-400 text-amber-950 shadow-xs ring-2 ring-amber-400/20' 
                    : 'bg-slate-50 border-slate-200/80'
              }`}>
                <div>
                  <div className={`text-[11px] font-bold uppercase tracking-wider ${
                    isExpired ? 'text-rose-700' : isExpiringSoon ? 'text-amber-800' : 'text-slate-500'
                  }`}>
                    Thời Hạn Dịch Vụ Đến
                  </div>
                  <div className="text-sm font-black mt-1 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Calendar className={`w-4 h-4 ${
                        isExpired ? 'text-rose-600' : isExpiringSoon ? 'text-amber-600' : 'text-[#0072B5]'
                      }`} />
                      <span>{currentCenter.expiryDate || 'Vô thời hạn'}</span>
                    </div>

                    {isExpiringSoon && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-black shadow-xs animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        {daysRemaining === 0 ? 'Hết hạn hôm nay' : `Còn ${daysRemaining} ngày`}
                      </span>
                    )}

                    {isExpired && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-black shadow-xs">
                        <AlertCircle className="w-3 h-3" />
                        Quá hạn {Math.abs(daysRemaining ?? 0)} ngày
                      </span>
                    )}

                    {!isExpiringSoon && !isExpired && daysRemaining !== null && (
                      <span className="text-[11px] font-semibold text-slate-500">
                        (Còn {daysRemaining} ngày)
                      </span>
                    )}
                  </div>
                </div>

                {isExpiringSoon && (
                  <div className="text-right shrink-0">
                    <span className="hidden sm:inline-block text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-200/80 px-2 py-1 rounded-lg border border-amber-300">
                      Cần gia hạn gấp
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Note info */}
            <div className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
              isExpiringSoon 
                ? 'bg-amber-50/70 border-amber-200 text-amber-950' 
                : isExpired 
                  ? 'bg-rose-50/70 border-rose-200 text-rose-950' 
                  : 'bg-blue-50/70 border-blue-200 text-slate-700'
            }`}>
              <div className={`font-extrabold flex items-center gap-1.5 ${
                isExpiringSoon ? 'text-amber-900' : isExpired ? 'text-rose-900' : 'text-[#0B486B]'
              }`}>
                <Info className="w-4 h-4 shrink-0" />
                <span>Chính Sách Cấp Phép &amp; Hướng Dẫn Gia Hạn</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Thời hạn hợp đồng và gói cước được quản lý và gia hạn bởi <strong>Super Admin Hệ Thống</strong>. Khi gần hết hạn (dưới 7 ngày) hoặc cần nâng cấp hạn mức, người quản trị cơ sở vui lòng liên hệ Ban Quản Trị qua hotline <strong>1900 6868</strong> để được hỗ trợ gia hạn kịp thời, không gián đoạn dịch vụ.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* DANH SÁCH ĐĂNG KÝ GIA HẠN BẢN QUYỀN (HIỂN THỊ TRỰC TIẾP TRÊN TRANG) */}
      <div ref={renewalListSectionRef} className="scroll-mt-6">
        <CenterRenewalListModal
          center={currentCenter}
          requests={centerRenewalRequests}
          onOpenNewRenewal={() => setIsRenewalModalOpen(true)}
          onShowToast={onShowToast}
          highlighted={isRenewalHighlighted}
        />
      </div>

      {/* VÙNG NGUY HIỂM (SUPER ADMIN ONLY): XÓA TRUNG TÂM TOÀN DIỆN */}
      {isSuperAdmin && (
        <div className="rounded-3xl bg-rose-50/80 border border-rose-200/90 p-6 md:p-8 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-start gap-3.5 max-w-2xl">
              <div className="p-3 bg-rose-100 rounded-2xl text-rose-600 shrink-0 mt-0.5">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-200/70 text-rose-800 text-[10px] font-black uppercase tracking-wider">
                  Khu vực nguy hiểm • Super Admin
                </div>
                <h3 className="text-base font-black text-rose-950">
                  Xóa Toàn Diện Trung Tâm (Cascade / Recursive Delete)
                </h3>
                <p className="text-xs text-rose-800 font-medium leading-relaxed">
                  Hành động này sẽ xóa vĩnh viễn toàn bộ dữ liệu gồm lớp học, giáo viên, học sinh, phụ huynh, bài tập, điểm số và nhận xét. Không thể khôi phục.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-black px-6 py-3.5 text-xs shadow-md transition-all cursor-pointer shrink-0"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Xóa Toàn Diện Trung Tâm Này</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CẬP NHẬT THÔNG TIN TRƯỜNG */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-[#0072B5]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Cập Nhật Thông Tin Trường</h3>
                  <p className="text-xs text-slate-500">Thay đổi thông tin liên lạc và địa chỉ của trường</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tên Trường / Trung Tâm <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: TT An Khang..."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold focus:border-[#0072B5] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Địa Chỉ Trụ Sở Đào Tạo
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ví dụ: 123 Đường Nguyễn Huệ, Phường 1..."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold focus:border-[#0072B5] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Số Điện Thoại / Hotline
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0912.345.678"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold focus:border-[#0072B5] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Email Tiếp Nhận
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@trungtam.edu.vn"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold focus:border-[#0072B5] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0B486B] to-[#0072B5] hover:from-[#083652] hover:to-[#005a91] text-white px-5 py-2.5 text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Lưu Thay Đổi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: XÓA TRUNG TÂM TOÀN DIỆN DÀNH CHO SUPER ADMIN */}
      {isDeleteModalOpen && (
        <DeleteCenterModal
          isOpen={isDeleteModalOpen}
          center={currentCenter}
          currentUser={currentUser}
          onClose={() => setIsDeleteModalOpen(false)}
          onSuccess={(deletedCenterId) => {
            setIsDeleteModalOpen(false);
            if (onDeleteCenterSuccess) {
              onDeleteCenterSuccess(deletedCenterId);
            }
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* MODAL: FORM ĐĂNG KÝ GIA HẠN BẢN QUYỀN */}
      <CenterRenewalModal
        isOpen={isRenewalModalOpen}
        onClose={() => setIsRenewalModalOpen(false)}
        center={currentCenter}
        currentUser={currentUser}
        onShowToast={onShowToast}
        onSuccess={() => {
          setIsRenewalModalOpen(false);
          scrollToRenewalSection();
        }}
      />
    </div>
  );
};
