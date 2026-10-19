import React from 'react';
import { X, Bell, CheckCircle2, AlertTriangle, Info, Calendar } from 'lucide-react';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearAll: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  onClearAll,
}) => {
  if (!isOpen) return null;

  const notifications = [
    {
      id: 1,
      type: 'warning',
      title: 'Phụ huynh xin phép nghỉ',
      content: 'Phụ huynh em Trần Bảo Ngọc (Lớp 6A) vừa gửi tin nhắn xin phép nghỉ khám răng.',
      time: '10 phút trước',
    },
    {
      id: 2,
      type: 'success',
      title: 'Cập nhật điểm kiểm tra mới',
      content: 'Cô Nguyễn Thị Hoa vừa nhập bảng điểm kiểm tra 15 phút Toán Lớp 6A.',
      time: '45 phút trước',
    },
    {
      id: 3,
      type: 'info',
      title: 'Nhắc lịch học phụ đạo chiều nay',
      content: 'Lớp 7B - Văn có buổi bổ trợ kiến thức lúc 18:00 tại Phòng 102.',
      time: '2 giờ trước',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-fade-in border border-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-[#0072B5]">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Thông Báo Hệ Thống</h3>
              <p className="text-xs text-slate-500">Trung tâm dạy thêm Học Giỏi</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-xs max-h-80 overflow-y-auto pr-1">
          {notifications.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200/80 p-3 bg-slate-50/60 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  {item.type === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-[#F39C12]" />}
                  {item.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-[#00A86B]" />}
                  {item.type === 'info' && <Info className="w-3.5 h-3.5 text-[#0072B5]" />}
                  {item.title}
                </span>
                <span className="text-[10px] text-slate-400">{item.time}</span>
              </div>
              <p className="mt-1 text-slate-600 leading-relaxed">{item.content}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
          <button
            type="button"
            onClick={onClearAll}
            className="text-slate-500 hover:text-slate-800 font-semibold"
          >
            Đánh dấu đã đọc tất cả
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white px-4 py-2 font-bold transition-all shadow-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
