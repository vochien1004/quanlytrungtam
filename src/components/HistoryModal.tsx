import React from 'react';
import { X, Calendar, CheckCircle2, AlertCircle, Clock, FileSpreadsheet } from 'lucide-react';
import { StudentItem } from '../data/mockData';
import { AccountAvatar } from './common/AccountAvatar';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentItem;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  student,
}) => {
  if (!isOpen) return null;

  const mockLogs = [
    { date: '19/03/2024', status: 'present', note: 'Có mặt đúng giờ 17:25. Phát biểu 3 lần. Điểm kiểm tra 15p: 9.0' },
    { date: '16/03/2024', status: 'present', note: 'Có mặt đúng giờ. Nộp đủ bài tập về nhà số 5.' },
    { date: '14/03/2024', status: 'excused', note: 'Phụ huynh báo xin phép nghỉ vì sốt nhẹ. Đã gửi link bài giảng video.' },
    { date: '12/03/2024', status: 'present', note: 'Có mặt đúng giờ. Tham gia hoạt động nhóm tích cực.' },
    { date: '09/03/2024', status: 'present', note: 'Có mặt đúng giờ. Hoàn thành xuất sắc bài kiểm tra giữa kỳ.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-2xl animate-fade-in border border-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <AccountAvatar
              name={student?.name || 'Học sinh'}
              role="student"
              size="md"
              className="ring-2 ring-blue-200"
            />
            <div>
              <h3 className="text-base font-bold text-slate-800">Lịch Sử Điểm Danh &amp; Học Tập</h3>
              <p className="text-xs text-slate-500">{student?.name || 'Học sinh'} &bull; {student?.className || 'Chưa xếp lớp'}</p>
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

        <div className="mt-4 space-y-3 max-h-80 overflow-y-auto pr-1 text-xs">
          {mockLogs.map((log, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200/80 p-3 bg-slate-50/50 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#0072B5]" />
                  {log.date}
                </span>

                {log.status === 'present' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-[#00A86B]">
                    <CheckCircle2 className="w-3 h-3" />
                    Có mặt
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-[#F39C12]">
                    <Clock className="w-3 h-3" />
                    Có phép
                  </span>
                )}
              </div>
              <p className="text-slate-600 italic mt-0.5">{log.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            Tỷ lệ chuyên cần: <strong className="text-emerald-600 font-bold">95.8%</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white px-4 py-2 text-xs font-bold transition-all shadow-xs"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};
