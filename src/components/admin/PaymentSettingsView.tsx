import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Building2,
  UserCheck,
  Hash,
  Save,
  CheckCircle2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Info,
} from 'lucide-react';
import {
  CenterItem,
  CenterPaymentSettings,
  saveCenterPaymentSettings,
  getRealtimeCenterPaymentSettings,
} from '../../services/firebaseService';
import { UserAccount } from '../../services/authService';

interface PaymentSettingsViewProps {
  centers: CenterItem[];
  activeCenterId: string;
  currentUser?: UserAccount | null;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const POPULAR_BANKS = [
  { code: 'VBA', name: 'Agribank (VBA)' },
  { code: 'VCB', name: 'Vietcombank (VCB)' },
  { code: 'MB', name: 'MBBank (MB)' },
  { code: 'TCB', name: 'Techcombank (TCB)' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'CTG', name: 'VietinBank (CTG)' },
  { code: 'ACB', name: 'ACB' },
  { code: 'TPB', name: 'TPBank (TPB)' },
  { code: 'VPB', name: 'VPBank (VPB)' },
  { code: 'STB', name: 'Sacombank (STB)' },
];

export const PaymentSettingsView: React.FC<PaymentSettingsViewProps> = ({
  centers,
  activeCenterId,
  currentUser,
  onShowToast,
}) => {
  const effectiveCenterId = (currentUser?.centerId || activeCenterId || 'HG01').trim();
  const currentCenter =
    centers.find((c) => c.id === effectiveCenterId || c.code === effectiveCenterId) ||
    centers[0] ||
    null;

  const [bankId, setBankId] = useState<string>('');
  const [accountNo, setAccountNo] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [savedSettings, setSavedSettings] = useState<CenterPaymentSettings | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Lắng nghe dữ liệu thiết lập thanh toán từ Firebase theo thời gian thực
  useEffect(() => {
    if (!effectiveCenterId) return;
    setIsLoaded(false);

    const unsub = getRealtimeCenterPaymentSettings(effectiveCenterId, (settings) => {
      setSavedSettings(settings);
      setIsLoaded(true);
      if (settings) {
        setBankId((prev) => (hasUnsavedChanges ? prev : settings.bankId || ''));
        setAccountNo((prev) => (hasUnsavedChanges ? prev : settings.accountNo || ''));
        setAccountName((prev) => (hasUnsavedChanges ? prev : settings.accountName || ''));
      } else if (currentCenter?.bankId || currentCenter?.accountNo || currentCenter?.accountName) {
        setBankId((prev) => (hasUnsavedChanges ? prev : currentCenter.bankId || ''));
        setAccountNo((prev) => (hasUnsavedChanges ? prev : currentCenter.accountNo || ''));
        setAccountName((prev) => (hasUnsavedChanges ? prev : currentCenter.accountName || ''));
      }
    });

    return () => {
      unsub();
    };
  }, [effectiveCenterId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBankId = bankId.trim().toUpperCase();
    const cleanAccountNo = accountNo.trim();
    const cleanAccountName = accountName.trim().toUpperCase();

    if (!cleanBankId || !cleanAccountNo || !cleanAccountName) {
      onShowToast?.('Vui lòng nhập đầy đủ Mã ngân hàng, Số tài khoản và Tên chủ tài khoản!', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await saveCenterPaymentSettings(effectiveCenterId, {
        bankId: cleanBankId,
        accountNo: cleanAccountNo,
        accountName: cleanAccountName,
        updatedBy: currentUser?.fullName || currentUser?.username || 'Center Admin',
      });
      setBankId(updated.bankId);
      setAccountNo(updated.accountNo);
      setAccountName(updated.accountName);
      setSavedSettings(updated);
      setHasUnsavedChanges(false);
      onShowToast?.('✓ Đã lưu Thiết lập thanh toán của trường lên Firebase thành công!', 'success');
    } catch (err: any) {
      onShowToast?.(err?.message || 'Không thể lưu thiết lập thanh toán lên Firebase.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const cleanPreviewBankId = bankId.trim().toUpperCase();
  const cleanPreviewAccountNo = accountNo.trim().replace(/[\[\]\s]/g, '');
  const cleanPreviewAccountName = accountName.trim().toUpperCase().replace(/^\[|\]$/g, '');

  const qrPreviewUrl =
    cleanPreviewBankId && cleanPreviewAccountNo
      ? `https://img.vietqr.io/image/${encodeURIComponent(cleanPreviewBankId)}-${encodeURIComponent(
          cleanPreviewAccountNo
        )}-compact2.png?accountName=${encodeURIComponent(cleanPreviewAccountName)}`
      : '';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0B486B] via-[#0072B5] to-[#00A86B] p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-13 h-13 rounded-2xl bg-white/15 backdrop-blur-xs border border-white/25 flex items-center justify-center shrink-0 shadow-sm">
              <CreditCard className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/20 text-white">
                  Cấu hình tài khoản nhận học phí
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/25 text-emerald-100 border border-emerald-300/30 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Đồng bộ Realtime Firebase
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black mt-1.5 tracking-tight">
                Thiết Lập Thanh Toán — {currentCenter?.name || currentUser?.centerName || 'Trường của bạn'}
              </h1>
              <p className="text-xs sm:text-sm text-blue-100 mt-1">
                Khai báo thông tin tài khoản ngân hàng nhận học phí của trung tâm để lưu trữ và đồng bộ trực tiếp trên Firebase.
              </p>
            </div>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-xs shrink-0">
            <div className="text-blue-100 font-semibold">Mã cơ sở (Center ID)</div>
            <div className="text-sm font-black text-white mt-0.5">{effectiveCenterId}</div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form nhập liệu Thiết lập thanh toán (7 cột) */}
        <div className="lg:col-span-7">
          <form
            onSubmit={handleSave}
            className="rounded-3xl border-2 border-blue-100 bg-white p-6 shadow-sm space-y-5"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#0B486B] flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#0072B5]" />
                  Thông Tin Tài Khoản Ngân Hàng Nhận Thanh Toán
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Điền chính xác 3 thông tin bên dưới và nhấn Lưu để cập nhật lên cơ sở dữ liệu Firebase
                </p>
              </div>
              {savedSettings?.bankId && savedSettings?.accountNo && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-extrabold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Đã lưu trên Firebase
                </span>
              )}
            </div>

            {/* Ô nhập 1: Mã ngân hàng */}
            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                1. Mã ngân hàng <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4.5 h-4.5 text-[#0072B5] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={bankId}
                  onChange={(e) => {
                    setBankId(e.target.value.toUpperCase());
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Nhập mã ngân hàng (VD: VBA, VCB, MB, TCB, BIDV, ACB...)"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-[#0072B5] focus:outline-none text-sm font-black text-[#0B486B] placeholder:font-normal placeholder:text-slate-400 transition-colors"
                  required
                />
              </div>

              {/* Gợi ý chọn nhanh mã ngân hàng phổ biến */}
              <div className="pt-1">
                <span className="text-[11px] font-bold text-slate-500 block mb-1.5">
                  Chọn nhanh mã ngân hàng phổ biến:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_BANKS.map((b) => {
                    const isSelected = bankId.trim().toUpperCase() === b.code;
                    return (
                      <button
                        key={b.code}
                        type="button"
                        onClick={() => {
                          setBankId(b.code);
                          setHasUnsavedChanges(true);
                        }}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-[#0072B5] text-white border-[#0072B5] shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#0072B5] hover:text-[#0072B5]'
                        }`}
                      >
                        {b.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Ô nhập 2: Số tài khoản */}
            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                2. Số tài khoản <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Hash className="w-4.5 h-4.5 text-[#0072B5] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={accountNo}
                  onChange={(e) => {
                    setAccountNo(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Nhập số tài khoản ngân hàng (VD: 5105205024485)"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-[#0072B5] focus:outline-none text-sm font-black text-[#0B486B] placeholder:font-normal placeholder:text-slate-400 transition-colors"
                  required
                />
              </div>
            </div>

            {/* Ô nhập 3: Tên chủ tài khoản */}
            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                3. Tên chủ tài khoản <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <UserCheck className="w-4.5 h-4.5 text-[#0072B5] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => {
                    setAccountName(e.target.value.toUpperCase());
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Nhập tên chủ tài khoản in hoa không dấu (VD: NGUYEN VAN A)"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-[#0072B5] focus:outline-none text-sm font-black text-[#0B486B] uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 transition-colors"
                  required
                />
              </div>
            </div>

            {/* Thanh nút hành động */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#0072B5] shrink-0" />
                <span>
                  Lưu trữ tại Firestore: <code className="font-bold text-slate-700">/centers/{effectiveCenterId}/settings/payment</code>
                </span>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#0072B5] to-[#0B486B] hover:from-[#0B486B] hover:to-[#0072B5] text-white text-xs sm:text-sm font-black shadow-md transition-all cursor-pointer disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang lưu lên Firebase...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Lưu thiết lập thanh toán</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Cột phải: Thẻ xem trước dữ liệu đã lưu trên Firebase & Mã QR (5 cột) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-3xl border-2 border-blue-100 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm sm:text-base font-black text-[#0B486B] flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#0072B5]" />
                Thông Tin Đang Lưu Trên Firebase
              </h3>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {isLoaded ? 'Đã đồng bộ' : 'Đang tải...'}
              </span>
            </div>

            {/* Khung chi tiết 3 trường đang lưu */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                <span className="font-bold text-slate-500">Mã ngân hàng:</span>
                <span className="font-black text-sm text-[#0B486B]">
                  {savedSettings?.bankId || cleanPreviewBankId || 'Chưa thiết lập'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                <span className="font-bold text-slate-500">Số tài khoản:</span>
                <span className="font-black text-sm text-[#0072B5]">
                  {savedSettings?.accountNo || cleanPreviewAccountNo || 'Chưa thiết lập'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Tên chủ tài khoản:</span>
                <span className="font-black text-sm text-emerald-700">
                  {savedSettings?.accountName || cleanPreviewAccountName || 'Chưa thiết lập'}
                </span>
              </div>
            </div>

            {/* Xem trước mã VietQR tự động */}
            {qrPreviewUrl ? (
              <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/40 p-4 text-center space-y-2">
                <p className="text-xs font-extrabold text-[#0B486B] uppercase tracking-wider">
                  Mã QR Thanh Toán Tương Ứng
                </p>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 inline-block shadow-xs">
                  <img
                    src={qrPreviewUrl}
                    alt="VietQR Preview"
                    className="w-48 h-48 object-contain mx-auto"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Mã VietQR được tạo tự động dựa trên Mã ngân hàng, Số tài khoản và Tên chủ tài khoản.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">
                Nhập Mã ngân hàng và Số tài khoản để xem trước mã QR thanh toán của trung tâm.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
