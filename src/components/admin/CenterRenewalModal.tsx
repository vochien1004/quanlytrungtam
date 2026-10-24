import React, { useState, useEffect } from 'react';
import {
  Crown,
  X,
  QrCode,
  Phone,
  MessageSquare,
  CheckCircle2,
  Loader2,
  Building2,
  Calendar,
  Send,
  Sparkles,
  Copy,
  Check
} from 'lucide-react';
import { CenterItem, RenewalRequestItem, submitRenewalRequest } from '../../services/firebaseService';
import { UserAccount } from '../../services/authService';

interface CenterRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  center: CenterItem;
  currentUser?: UserAccount | null;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onSuccess?: (newRequest: RenewalRequestItem) => void;
}

interface RenewalPackageOption {
  months: 3 | 6 | 12;
  title: string;
  price: number;
  amount: number;
  amountText: string;
  badge?: string;
  description: string;
}

const BANK_INFO = {
  BANK_ID: 'VBA',
  BANK_NAME: 'Agribank (VBA)',
  ACCOUNT_NO: '5105205024485',
  ACCOUNT_NAME: 'VO CHIEN',
} as const;

const RENEWAL_PACKAGES: RenewalPackageOption[] = [
  {
    months: 3,
    title: 'Gói 3 Tháng',
    price: 199000,
    amount: 199000,
    amountText: '199.000 đ',
    description: 'Phù hợp duy trì ngắn hạn theo học kỳ',
  },
  {
    months: 6,
    title: 'Gói 6 Tháng',
    price: 399000,
    amount: 399000,
    amountText: '399.000 đ',
    badge: 'Phổ biến',
    description: 'Tối ưu chi phí vận hành trung hạn',
  },
  {
    months: 12,
    title: 'Gói 12 Tháng',
    price: 599000,
    amount: 599000,
    amountText: '599.000 đ',
    badge: 'Tiết kiệm nhất',
    description: 'Trọn gói 1 năm hoạt động ổn định',
  },
];

export const CenterRenewalModal: React.FC<CenterRenewalModalProps> = ({
  isOpen,
  onClose,
  center,
  currentUser,
  onShowToast,
  onSuccess,
}) => {
  const [selectedMonths, setSelectedMonths] = useState<3 | 6 | 12>(6);
  const [contactPhone, setContactPhone] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [qrLoadError, setQrLoadError] = useState<boolean>(false);
  const [copiedMemo, setCopiedMemo] = useState<boolean>(false);

  const selectedPkg =
    RENEWAL_PACKAGES.find((p) => p.months === selectedMonths) || RENEWAL_PACKAGES[1];

  useEffect(() => {
    if (isOpen) {
      setContactPhone(center?.phone || currentUser?.phone || '');
      setMessage(
        `Trung tâm ${center?.name || ''} (${center?.code || center?.id || ''}) đăng ký gia hạn gói ${selectedMonths} tháng (${selectedPkg.amountText}).`
      );
      setQrLoadError(false);
    }
  }, [isOpen, center?.id, center?.name, center?.code, center?.phone, currentUser?.phone]);

  // Cập nhật gợi ý lời nhắn khi đổi gói nếu người dùng chưa sửa nội dung tùy chỉnh khác
  const handleSelectPackage = (pkg: RenewalPackageOption) => {
    setSelectedMonths(pkg.months);
    setQrLoadError(false);
    setMessage(
      `Trung tâm ${center?.name || ''} (${center?.code || center?.id || ''}) đăng ký gia hạn gói ${pkg.months} tháng (${pkg.amountText}).`
    );
  };

  if (!isOpen) return null;

  const cleanCode = String(center?.code || center?.id || 'HG01')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  const price = selectedPkg.price;
  const memo = `GIAHAN ${cleanCode} ${selectedPkg.months}T`;

  const qrImageUrl = `https://img.vietqr.io/image/${BANK_INFO.BANK_ID}-${BANK_INFO.ACCOUNT_NO}-compact2.png?amount=${price}&addInfo=${encodeURIComponent(
    memo
  )}&accountName=${encodeURIComponent(BANK_INFO.ACCOUNT_NAME)}`;

  const handleCopyMemo = () => {
    try {
      navigator.clipboard.writeText(memo);
      setCopiedMemo(true);
      setTimeout(() => setCopiedMemo(false), 2000);
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactPhone.trim()) {
      if (onShowToast) {
        onShowToast('Vui lòng nhập số điện thoại liên hệ để Super Admin xác nhận!', 'error');
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const createdReq = await submitRenewalRequest({
        centerId: center.id,
        centerName: center.name || 'Trung tâm đào tạo',
        centerCode: center.code || center.id,
        currentExpiryDate: center.expiryDate || '',
        months: selectedPkg.months,
        amount: price,
        price,
        memo,
        bankId: BANK_INFO.BANK_ID,
        accountNo: BANK_INFO.ACCOUNT_NO,
        accountName: BANK_INFO.ACCOUNT_NAME,
        packageLabel: `${selectedPkg.title} - ${selectedPkg.amountText}`,
        contactPhone: contactPhone.trim(),
        message: message.trim() || `Yêu cầu gia hạn ${selectedPkg.title} (${selectedPkg.amountText})`,
        requesterName: currentUser?.fullName || currentUser?.name || 'Quản trị viên trung tâm',
        requesterUsername: currentUser?.username || center.adminUsername || '',
      });

      if (onShowToast) {
        onShowToast(
          `✓ Đã gửi yêu cầu gia hạn ${selectedPkg.title} (${selectedPkg.amountText}) thành công! Đang chuyển đến danh sách đăng ký gia hạn...`,
          'success'
        );
      }
      onClose();
      if (onSuccess) {
        onSuccess(createdReq);
      }
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(`Lỗi gửi yêu cầu gia hạn: ${err.message || 'Vui lòng thử lại'}`, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#0B486B] via-[#0072B5] to-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-400/20 border border-amber-300/40 text-amber-300">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  Đăng Ký Gia Hạn Bản Quyền Trung Tâm
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-400/20 border border-emerald-300/30 px-2.5 py-0.5 text-[10px] font-black text-emerald-200 uppercase">
                  <Sparkles className="w-3 h-3" />
                  Trực tuyến
                </span>
              </div>
              <p className="text-xs text-blue-100 font-medium">
                Vui lòng thực hiện đầy đủ các bước dưới đây để tiến hành gia hạn.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto text-xs text-slate-800">
          {/* Thông tin trường hiện tại */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-100 text-[#0072B5]">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="font-black text-slate-900 text-xs sm:text-sm">{center?.name || 'Trung tâm đào tạo'}</div>
                <div className="text-[11px] text-slate-500 font-semibold">
                  Mã cơ sở: <strong className="text-[#0072B5]">{center?.code || center?.id}</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>Hạn hiện tại: <strong>{center?.expiryDate || 'Đang cập nhật'}</strong></span>
            </div>
          </div>

          {/* 1. Chọn gói gia hạn (3 tháng, 6 tháng, 12 tháng) */}
          <div className="space-y-2.5">
            <label className="block font-black text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-500" />
              <span>1. Chọn Gói Gia Hạn Bản Quyền <span className="text-rose-500">*</span></span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {RENEWAL_PACKAGES.map((pkg) => {
                const isSelected = selectedMonths === pkg.months;
                return (
                  <button
                    key={pkg.months}
                    type="button"
                    onClick={() => handleSelectPackage(pkg)}
                    className={`relative text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-amber-500 bg-gradient-to-br from-amber-50 via-orange-50/40 to-white shadow-md ring-2 ring-amber-400/30'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    {pkg.badge && (
                      <span
                        className={`inline-block self-start mb-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isSelected
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {pkg.badge}
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-slate-900">{pkg.title}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />}
                      </div>
                      <div className="text-lg sm:text-xl font-black text-[#0B486B] mt-1">
                        {pkg.amountText}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug font-medium">
                        {pkg.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Thẻ hiển thị mã QR & Thông tin chuyển khoản */}
          <div className="rounded-2xl border-2 border-blue-100 bg-gradient-to-br from-blue-50/60 via-white to-slate-50 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
              <div className="flex items-center gap-2 font-black text-[#0B486B] text-xs sm:text-sm">
                <QrCode className="w-4 h-4 text-[#0072B5]" />
                <span>2. Thẻ Mã QR Thanh Toán Gia Hạn</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-[#0072B5] font-black text-[11px]">
                {selectedPkg.title}: {selectedPkg.amountText}
              </span>
            </div>

            <div className="space-y-3.5">
              {/* Hàng trên: Thẻ hiển thị mã QR to, rõ ràng */}
              <div className="w-full flex flex-col items-center justify-center bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                {!qrLoadError ? (
                  <img
                    src={qrImageUrl}
                    alt="Mã QR Thanh Toán Gia Hạn"
                    className="w-64 sm:w-80 h-auto max-w-full object-contain rounded-xl"
                    onError={() => setQrLoadError(true)}
                  />
                ) : (
                  <div className="w-64 h-64 flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-300 p-4 text-center">
                    <QrCode className="w-28 h-28 text-[#0B486B] mb-2" />
                    <span className="text-xs font-bold text-slate-600">
                      Mã QR Thanh Toán ({selectedPkg.amountText})
                    </span>
                  </div>
                )}
                <span className="text-xs font-bold text-slate-500 mt-2.5 text-center">
                  Quét mã QR bằng ứng dụng Ngân hàng
                </span>
              </div>

              {/* Hàng dưới: Thẻ thông tin ngân hàng, tài khoản và nội dung gia hạn */}
              <div className="space-y-2.5 text-xs">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Ngân hàng thụ hưởng:</span>
                    <span className="font-black text-slate-900">{BANK_INFO.BANK_NAME}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Số tài khoản:</span>
                    <span className="font-mono font-black text-[#0072B5] text-sm">{BANK_INFO.ACCOUNT_NO}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Chủ tài khoản:</span>
                    <span className="font-extrabold text-slate-800">{BANK_INFO.ACCOUNT_NAME}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                    <span className="text-slate-500 font-semibold">Số tiền cần chuyển:</span>
                    <span className="font-black text-base text-rose-600">{price.toLocaleString('vi-VN')} đ</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold text-amber-800 uppercase">Nội dung chuyển khoản:</div>
                    <div className="font-mono font-black text-amber-950 text-xs sm:text-sm">{memo}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyMemo}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedMemo ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedMemo ? 'Đã chép' : 'Sao chép'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Số điện thoại liên hệ & 4. Lời nhắn */}
          <div className="space-y-3.5">
            <div>
              <label className="block font-black text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-[#0072B5]" />
                <span>3. Số Điện Thoại Liên Hệ <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="tel"
                required
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Nhập số điện thoại liên hệ của trung tâm (VD: 0988123456)..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-[#0072B5] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-black text-slate-800 mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-[#0072B5]" />
                <span>4. Lời Nhắn Gửi Super Admin</span>
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Nhập lời nhắn hoặc thông tin xác nhận chuyển khoản..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:border-[#0072B5] focus:outline-hidden"
              />
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-5 py-2.5 text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang gửi yêu cầu...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Gửi Yêu Cầu Gia Hạn</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
