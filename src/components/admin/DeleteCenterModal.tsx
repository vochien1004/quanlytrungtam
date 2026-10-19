import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Trash2,
  Loader2,
  Building2,
  ShieldAlert,
  CheckCircle2,
  X
} from 'lucide-react';
import { CenterItem, deleteCenter } from '../../services/firebaseService';
import { UserAccount } from '../../services/authService';

interface DeleteCenterModalProps {
  isOpen: boolean;
  center: CenterItem | any | null;
  currentUser?: UserAccount | null;
  onClose: () => void;
  onSuccess: (deletedCenterId: string) => void;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const DeleteCenterModal: React.FC<DeleteCenterModalProps> = ({
  isOpen,
  center,
  currentUser,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset confirmation input when opening with a new center
  useEffect(() => {
    if (isOpen) {
      setConfirmInput('');
      setIsDeleting(false);
    }
  }, [isOpen, center?.id]);

  if (!isOpen || !center) return null;

  // Xác thực quyền Super Admin tối cao
  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.username === 'admin';
  if (!isSuperAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-rose-200 space-y-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-slate-900">Từ Chối Quyền Truy Cập</h3>
          <p className="text-xs text-slate-600">
            Chỉ tài khoản Quản Trị Viên Cấp Cao (Super Admin) mới có thẩm quyền xóa toàn diện trung tâm đào tạo.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 text-xs font-bold cursor-pointer transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  const centerName = (center.name || '').trim();
  const trimmedInput = confirmInput.trim();
  
  // Điều kiện kích hoạt: Nhập đúng tên trung tâm HOẶC gõ từ khóa "XÓA" (chấp nhận cả hoa/thường)
  const isNameMatch = trimmedInput.toLowerCase() === centerName.toLowerCase();
  const isKeywordMatch = trimmedInput.toUpperCase() === 'XÓA' || trimmedInput.toUpperCase() === 'XOA';
  const isConfirmationValid = trimmedInput.length > 0 && (isNameMatch || isKeywordMatch);

  const handleExecuteDelete = async () => {
    if (!isConfirmationValid || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteCenter(center.id, center);
      
      if (onShowToast) {
        onShowToast('Đã xóa hoàn toàn trung tâm, dọn dẹp tài khoản và giải phóng toàn bộ username liên quan', 'success');
      }
      
      onSuccess(center.id);
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi xóa cascade trung tâm:', err);
      if (onShowToast) {
        onShowToast(`Lỗi khi xóa trung tâm: ${err.message || 'Không thể hoàn tất quá trình xóa'}`, 'error');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 md:p-8 shadow-2xl border border-rose-200 text-xs space-y-5">
        {/* Nút đóng góc phải */}
        <button
          type="button"
          disabled={isDeleting}
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-30 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tiêu đề & Cảnh báo nguy hiểm */}
        <div className="flex items-start gap-3.5 text-rose-600">
          <div className="p-3 bg-rose-100 rounded-2xl shrink-0 mt-0.5">
            <AlertTriangle className="w-7 h-7 text-rose-600 animate-pulse" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider mb-1">
              Hành động không thể khôi phục
            </div>
            <h3 className="text-lg font-black text-slate-900 leading-snug">
              Xóa Toàn Diện Trung Tâm Đào Tạo
            </h3>
            <p className="text-rose-700 font-semibold text-[11px] mt-0.5">
              Xóa đệ quy toàn bộ dữ liệu (Cascade / Recursive Delete)
            </p>
          </div>
        </div>

        {/* Khối cảnh báo chi tiết theo yêu cầu kỹ thuật */}
        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-2.5 text-rose-950">
          <div className="flex items-start gap-2 text-rose-800 font-bold text-xs leading-relaxed">
            <span className="text-base leading-none">⚠️</span>
            <span>
              Hành động này sẽ xóa vĩnh viễn toàn bộ dữ liệu gồm lớp học, giáo viên, học sinh, phụ huynh, bài tập, điểm số và nhận xét. Không thể khôi phục.
            </span>
          </div>

          <div className="bg-white/80 rounded-xl p-3 border border-rose-200/60 space-y-1 text-slate-700">
            <div className="flex items-center gap-2 font-black text-sm text-slate-900">
              <Building2 className="w-4 h-4 text-[#0072B5] shrink-0" />
              <span>{centerName}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Mã cơ sở / ID: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-slate-700">{center.code || center.id}</code>
            </div>
            {center.adminUsername && (
              <div className="text-[11px] text-slate-500">
                Tài khoản Admin quản lý: <strong className="text-slate-800">{center.adminUsername}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Khối xác thực an toàn: Yêu cầu gõ tên trung tâm hoặc từ khóa XÓA */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-800">
            Xác nhận an toàn bằng cách nhập chính xác tên trung tâm hoặc gõ từ khóa <span className="text-rose-600 font-black">"XÓA"</span>:
          </label>
          <div className="relative">
            <input
              type="text"
              disabled={isDeleting}
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={`Nhập "${centerName}" hoặc "XÓA" để xác nhận`}
              className={`w-full rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-all focus:outline-hidden disabled:bg-slate-100 disabled:opacity-60 ${
                isConfirmationValid
                  ? 'border-emerald-500 bg-emerald-50/30 text-emerald-950 focus:ring-2 focus:ring-emerald-400'
                  : 'border-slate-300 text-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
              }`}
            />
            {isConfirmationValid && (
              <div className="absolute right-3 top-2.5 text-emerald-600 flex items-center gap-1 text-[11px] font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Hợp lệ</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">
              Gợi ý: Gõ <strong className="text-rose-600 font-mono">XÓA</strong> hoặc copy tên trường.
            </span>
            <span className={isConfirmationValid ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
              {isConfirmationValid ? '✓ Nút xóa đã được kích hoạt' : 'Nút xóa đang bị khóa'}
            </span>
          </div>
        </div>

        {/* Hàng nút bấm hành động */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-40"
          >
            Hủy Bỏ
          </button>
          
          <button
            type="button"
            disabled={!isConfirmationValid || isDeleting}
            onClick={handleExecuteDelete}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 font-bold text-white shadow-md transition-all cursor-pointer ${
              !isConfirmationValid || isDeleting
                ? 'bg-rose-300 cursor-not-allowed opacity-60'
                : 'bg-rose-600 hover:bg-rose-700 active:scale-98 cursor-pointer shadow-rose-200'
            }`}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Đang xóa toàn bộ dữ liệu...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>Xác Nhận Xóa Vĩnh Viễn</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
