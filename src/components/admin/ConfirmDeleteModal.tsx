import React from 'react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  itemName: string;
  itemType?: 'giáo viên' | 'học sinh' | 'lớp học' | 'tài khoản' | string;
  itemCode?: string;
  itemSubInfo?: string;
  warningNote?: string;
  isDeleting?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  itemName,
  itemType = 'mục',
  itemCode,
  itemSubInfo,
  warningNote,
  isDeleting = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const defaultTitle = `Xác nhận xóa ${itemType}`;
  const defaultWarning =
    itemType === 'giáo viên'
      ? 'Hành động này sẽ xóa vĩnh viễn giáo viên khỏi cơ sở dữ liệu, hủy phân công đứng lớp và vô hiệu hóa tài khoản đăng nhập hệ thống. Không thể hoàn tác sau khi thực hiện.'
      : itemType === 'học sinh'
      ? 'Hồ sơ học sinh, lịch sử điểm danh và kết quả học tập liên quan sẽ bị xóa hoàn toàn khỏi trung tâm. Không thể hoàn tác sau khi thực hiện.'
      : itemType === 'lớp học'
      ? 'Lớp học sẽ bị xóa khỏi danh sách trung tâm. Học sinh và giáo viên liên kết với lớp học này sẽ được tự động gỡ phân công.'
      : 'Dữ liệu sau khi xóa sẽ không thể phục hồi lại. Vui lòng kiểm tra kỹ trước khi xác nhận.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 my-8 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">{title || defaultTitle}</h3>
              <p className="text-xs text-slate-500">Cảnh báo thao tác xóa dữ liệu</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung đối tượng cần xóa */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Đối tượng xóa:
              </span>
              <p className="text-sm font-black text-slate-800 leading-snug">{itemName}</p>
            </div>
            {itemCode && (
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                {itemCode}
              </span>
            )}
          </div>
          {itemSubInfo && (
            <p className="text-xs text-slate-500 font-medium pt-1 border-t border-slate-200/60">
              {itemSubInfo}
            </p>
          )}
        </div>

        {/* Khối cảnh báo màu đỏ */}
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-900 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-rose-800">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>Cảnh báo quan trọng:</span>
          </div>
          <p className="text-[11px] text-rose-700 leading-relaxed font-medium">
            {warningNote || defaultWarning}
          </p>
        </div>

        {/* Nút thao tác */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xóa...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Xác nhận xóa</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
