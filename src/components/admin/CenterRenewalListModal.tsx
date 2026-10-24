import React, { useState } from 'react';
import {
  Crown,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  Calendar,
  Phone,
  Building2,
  Plus,
  Loader2,
  FileText,
  CreditCard,
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import {
  CenterItem,
  RenewalRequestItem,
  cancelRenewalRequest
} from '../../services/firebaseService';

interface CenterRenewalListModalProps {
  center: CenterItem;
  requests: RenewalRequestItem[];
  onOpenNewRenewal?: () => void;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
  highlighted?: boolean;
}

export const CenterRenewalListModal: React.FC<CenterRenewalListModalProps> = ({
  center,
  requests,
  onOpenNewRenewal,
  onShowToast,
  highlighted = false,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const formatRequestTime = (req: RenewalRequestItem): string => {
    if (req.createdAtStr && req.createdAtStr.trim()) {
      return req.createdAtStr;
    }
    if (req.createdAt?.seconds) {
      return new Date(req.createdAt.seconds * 1000).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
    const parts = (req.id || '').split('_');
    const ts = Number(parts[parts.length - 1]);
    if (!isNaN(ts) && ts > 1000000000000) {
      return new Date(ts).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
    return 'Vừa đăng ký';
  };

  const pendingCount = requests.filter((r) => r.status === 'pending' || !r.status).length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length;

  const filteredRequests = requests.filter((r) => {
    if (statusFilter === 'all') return true;
    const st = r.status || 'pending';
    return st === statusFilter;
  });

  const handleCancelRequest = async (req: RenewalRequestItem) => {
    setCancellingId(req.id);
    try {
      await cancelRenewalRequest(req);
      setConfirmCancelId(null);
      if (onShowToast) {
        onShowToast(
          `✓ Đã hủy yêu cầu đăng ký gia hạn gói ${req.months} tháng thành công!`,
          'info'
        );
      }
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(`Lỗi khi hủy yêu cầu: ${err.message || 'Vui lòng thử lại'}`, 'error');
      }
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div
      className={`w-full rounded-3xl bg-white shadow-xs border overflow-hidden flex flex-col transition-all duration-500 ${
        highlighted
          ? 'border-[#0072B5] ring-4 ring-blue-500/20 shadow-lg'
          : 'border-slate-200/90'
      }`}
    >
      {/* Card Header */}
      <div className="bg-gradient-to-r from-[#0B486B] via-[#0072B5] to-slate-900 px-6 py-4 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-400/20 border border-amber-300/40 text-amber-300">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black tracking-tight">
              Danh Sách Đăng Ký Gia Hạn Bản Quyền
            </h3>
            <p className="text-xs text-blue-100 font-medium">
              Theo dõi thời gian đăng ký, gói gia hạn, tình trạng phê duyệt và quản lý yêu cầu của trường
            </p>
          </div>
        </div>
      </div>

      {/* Sub-header: Thông tin trường & Bộ lọc trạng thái */}
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 text-[#0072B5]">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-black text-slate-900 text-xs sm:text-sm">
                {center?.name || 'Trung tâm đào tạo'}
              </div>
              <div className="text-[11px] text-slate-500 font-semibold">
                Mã cơ sở: <strong className="text-[#0072B5] font-mono">{center?.code || center?.id}</strong>
                {' · '}
                Hạn hiện tại: <strong className="text-slate-800 tabular-nums">{center?.expiryDate || 'Đang cập nhật'}</strong>
              </div>
            </div>
          </div>

          {onOpenNewRenewal && (
            <button
              type="button"
              onClick={onOpenNewRenewal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Đăng ký gói gia hạn mới</span>
            </button>
          )}
        </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-[#0B486B] text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Tất cả ({requests.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
              }`}
            >
              Chưa duyệt ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'approved'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              Đã duyệt ({approvedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'rejected'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
              }`}
            >
              Bị từ chối ({rejectedCount})
            </button>
          </div>
        </div>

        {/* Content: Danh sách đăng ký gia hạn */}
        <div className="p-5 sm:p-6 space-y-4 text-xs text-slate-800">
          {filteredRequests.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0072B5] flex items-center justify-center mx-auto">
                <Crown className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-slate-700">
                  {statusFilter === 'all'
                    ? 'Chưa có yêu cầu đăng ký gia hạn nào'
                    : statusFilter === 'pending'
                    ? 'Không có yêu cầu nào đang ở trạng thái Chưa duyệt'
                    : statusFilter === 'approved'
                    ? 'Chưa có yêu cầu nào ở trạng thái Đã duyệt'
                    : 'Không có yêu cầu nào Bị từ chối'}
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Khi bạn gửi yêu cầu gia hạn bản quyền, thông tin thời gian đăng ký, gói cước và trạng thái xét duyệt từ Super Admin sẽ hiển thị trực tiếp tại đây.
                </p>
              </div>
              {onOpenNewRenewal && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={onOpenNewRenewal}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white font-black text-xs shadow-xs transition-all cursor-pointer"
                  >
                    <Crown className="w-4 h-4" />
                    <span>Đăng ký gia hạn ngay</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-black">
                      <th className="py-3.5 px-4 whitespace-nowrap">Thời Gian Đã Đăng Ký</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Gói Đăng Ký &amp; Thanh Toán</th>
                      <th className="py-3.5 px-4 whitespace-nowrap text-center">Tình Trạng</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Phản Hồi Từ Super Admin</th>
                      <th className="py-3.5 px-4 whitespace-nowrap text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredRequests.map((req) => {
                      const status = req.status || 'pending';
                      const priceVal = Number(req.price ?? req.amount ?? 0);
                      const isCancelling = cancellingId === req.id;
                      const isConfirming = confirmCancelId === req.id;

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/80 transition-colors align-top">
                          {/* 1. Thời gian đã đăng ký */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 tabular-nums">
                              <Calendar className="w-3.5 h-3.5 text-[#0072B5] shrink-0" />
                              <span>{formatRequestTime(req)}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>LH: <strong className="text-slate-700 tabular-nums">{req.contactPhone || 'Chưa cập nhật'}</strong></span>
                            </div>
                          </td>

                          {/* 2. Gói đăng ký */}
                          <td className="py-4 px-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-black text-[#0B486B] text-xs sm:text-sm">
                                Gói {req.months} Tháng
                              </span>
                              <span aria-hidden="true" className="text-slate-300">·</span>
                              <span className="font-mono font-black text-rose-600 text-xs sm:text-sm tabular-nums">
                                {priceVal.toLocaleString('vi-VN')} đ
                              </span>
                            </div>

                            {req.memo && (
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-600">
                                <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>
                                  Nội dung CK: <strong className="font-mono text-amber-900">{req.memo}</strong>
                                </span>
                              </div>
                            )}

                            {req.message && (
                              <p className="mt-1 text-[11px] text-slate-500 line-clamp-2 max-w-md">
                                Lời nhắn gửi đi: {req.message}
                              </p>
                            )}
                          </td>

                          {/* 3. Tình trạng (Đã duyệt, Chưa duyệt, Bị từ chối) */}
                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            {status === 'approved' ? (
                              <div className="inline-flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-xs">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>Đã duyệt</span>
                                </span>
                                {req.newExpiryDate && (
                                  <span className="text-[10px] font-bold text-emerald-700 tabular-nums">
                                    Hạn mới: {req.newExpiryDate}
                                  </span>
                                )}
                              </div>
                            ) : status === 'rejected' ? (
                              <div className="inline-flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-black text-xs">
                                  <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                  <span>Bị từ chối</span>
                                </span>
                                <span className="text-[10px] font-semibold text-rose-600">
                                  Yêu cầu không được duyệt
                                </span>
                              </div>
                            ) : (
                              <div className="inline-flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 font-black text-xs">
                                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>Chưa duyệt</span>
                                </span>
                                <span className="text-[10px] font-semibold text-amber-700">
                                  Đang chờ Super Admin duyệt
                                </span>
                              </div>
                            )}
                          </td>

                          {/* 4. Phản hồi từ Super Admin */}
                          <td className="py-4 px-4 min-w-[220px] max-w-sm">
                            {req.adminFeedback && req.adminFeedback.trim() ? (
                              <div
                                className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                                  status === 'approved'
                                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                                    : status === 'rejected'
                                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                                    : 'bg-blue-50/70 border-blue-200 text-slate-800'
                                }`}
                              >
                                <div className="flex items-start gap-1.5">
                                  <MessageSquare
                                    className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                                      status === 'approved'
                                        ? 'text-emerald-600'
                                        : status === 'rejected'
                                        ? 'text-rose-600'
                                        : 'text-[#0072B5]'
                                    }`}
                                  />
                                  <div className="font-semibold leading-relaxed break-words">
                                    {req.adminFeedback}
                                  </div>
                                </div>
                                {req.respondedAtStr && (
                                  <div className="text-[10px] text-slate-500 font-medium pl-5">
                                    Phản hồi lúc: {req.respondedAtStr}
                                  </div>
                                )}
                              </div>
                            ) : status === 'approved' ? (
                              <span className="text-[11px] text-emerald-700 font-semibold italic">
                                Đã xác nhận &amp; kích hoạt gói gia hạn thành công
                              </span>
                            ) : status === 'rejected' ? (
                              <span className="text-[11px] text-rose-600 font-semibold italic">
                                Từ chối phê duyệt (Không có ghi chú thêm)
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Chưa có phản hồi từ Super Admin
                              </span>
                            )}
                          </td>

                          {/* 4. Nút hủy yêu cầu */}
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            {isConfirming ? (
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  disabled={isCancelling}
                                  onClick={() => handleCancelRequest(req)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {isCancelling ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Đang hủy...</span>
                                    </>
                                  ) : (
                                    <span>Xác nhận hủy</span>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  disabled={isCancelling}
                                  onClick={() => setConfirmCancelId(null)}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                                >
                                  Không
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={isCancelling}
                                onClick={() => setConfirmCancelId(req.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white font-black text-xs transition-all cursor-pointer disabled:opacity-50"
                              >
                                {isCancelling ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Đang hủy...</span>
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>Hủy yêu cầu</span>
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ghi chú hướng dẫn */}
          <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-2.5 text-[11px] text-slate-600">
            <AlertCircle className="w-4 h-4 text-[#0072B5] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#0B486B]">Lưu ý:</strong> Khi yêu cầu ở trạng thái{' '}
              <strong className="text-amber-800">Chưa duyệt</strong>, bạn có thể nhấn nút{' '}
              <strong className="text-rose-700">Hủy yêu cầu</strong> nếu muốn thay đổi gói đăng ký. Ngay khi{' '}
              <strong>Super Admin</strong> phê duyệt, tình trạng sẽ tự động chuyển sang{' '}
              <strong className="text-emerald-700">Đã duyệt</strong> và thời hạn sử dụng của trường sẽ được cộng thêm số tháng tương ứng.
            </div>
          </div>
        </div>
    </div>
  );
};
