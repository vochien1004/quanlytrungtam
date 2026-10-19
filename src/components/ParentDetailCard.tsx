import React, { useState } from 'react';
import { Calendar, MessageSquare, History, Check, Clock, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';
import { INITIAL_WEEKLY_ATTENDANCE } from '../data/mockData';

interface ParentDetailCardProps {
  onViewHistoryClick: () => void;
  onOpenParentPortal?: () => void;
}

export const ParentDetailCard: React.FC<ParentDetailCardProps> = ({
  onViewHistoryClick,
  onOpenParentPortal,
}) => {
  const [selectedStudent] = useState('Bạch Dương - Lớp 7B');

  const renderStatusDot = (status: 'present' | 'excused' | 'unexcused' | 'none') => {
    switch (status) {
      case 'present':
        return (
          <span 
            title="Có mặt đúng giờ" 
            className="inline-block w-3.5 h-3.5 rounded-full bg-[#00A86B] shadow-xs cursor-pointer hover:scale-125 transition-transform" 
          />
        );
      case 'excused':
        return (
          <span 
            title="Vắng có phép" 
            className="inline-block w-3.5 h-3.5 rounded-full bg-[#F39C12] shadow-xs cursor-pointer hover:scale-125 transition-transform" 
          />
        );
      case 'unexcused':
        return (
          <span 
            title="Vắng không phép" 
            className="inline-block w-3.5 h-3.5 rounded-full bg-[#E74C3C] shadow-xs cursor-pointer hover:scale-125 transition-transform" 
          />
        );
      case 'none':
      default:
        return (
          <span 
            title="Không có lịch học" 
            className="inline-block w-2.5 h-2.5 rounded-full bg-slate-200" 
          />
        );
    }
  };

  return (
    <div className="rounded-3xl border-3 border-[#0072B5]/50 bg-white p-5 shadow-xs transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-base font-extrabold text-[#0B486B] tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-5 rounded-full bg-[#F39C12]"></span>
            Chi Tiết Điểm Danh &amp; Nhận Xét (Phụ Huynh)
          </h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <span>Theo dõi con: <strong className="text-slate-800 font-bold">Bạch Dương</strong> (Phụ huynh: Bạch Duyên Thị Hoa)</span>
          </div>
        </div>
        {onOpenParentPortal && (
          <button 
            type="button"
            onClick={onOpenParentPortal}
            className="text-xs text-[#0072B5] font-bold hover:underline flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 transition-colors hover:bg-blue-100"
          >
            <span>Vào Sổ Liên Lạc Đầy Đủ</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Attendance Matrix Table */}
        <div className="lg:col-span-7 overflow-x-auto">
          <table className="w-full text-center text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold">
                <th className="py-2 px-2 text-left font-bold text-slate-700">Tuần</th>
                <th className="py-2 px-1 text-slate-600">T2</th>
                <th className="py-2 px-1 text-slate-600">T3</th>
                <th className="py-2 px-1 text-slate-600">T4</th>
                <th className="py-2 px-1 text-slate-600">T5</th>
                <th className="py-2 px-1 text-slate-600">T6</th>
                <th className="py-2 px-1 text-slate-600">T7</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {INITIAL_WEEKLY_ATTENDANCE.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-2 text-left font-bold text-slate-700 whitespace-nowrap">
                    {row.weekLabel}
                  </td>
                  <td className="py-2.5 px-1">{renderStatusDot(row.mon)}</td>
                  <td className="py-2.5 px-1">{renderStatusDot(row.tue)}</td>
                  <td className="py-2.5 px-1">{renderStatusDot(row.wed)}</td>
                  <td className="py-2.5 px-1">{renderStatusDot(row.thu)}</td>
                  <td className="py-2.5 px-1">{renderStatusDot(row.fri)}</td>
                  <td className="py-2.5 px-1">{renderStatusDot(row.sat)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Micro legend */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-600 pt-2 border-t border-slate-100 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00A86B]"></span> Có mặt
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F39C12]"></span> Vắng có phép
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E74C3C]"></span> Vắng không phép
            </span>
          </div>
        </div>

        {/* Right side: Teacher Note / Remark */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-slate-50 border border-slate-200/90 p-3.5">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#0072B5]" />
                Nhận Xét Sau Buổi Học
              </span>
              <span className="text-[10px] text-slate-500 font-medium">19/03 &bull; 19:35</span>
            </div>
            
            <div className="mt-2.5 rounded-xl bg-white p-3 border border-slate-200/70 shadow-2xs">
              <div className="text-xs font-bold text-[#0B486B] flex items-center justify-between">
                <span>Cô Nguyễn Thị Hoa (Toán):</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                  9.0 / 10
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed italic">
                &ldquo;Em Bạch Dương tiếp thu bài rất nhanh, sôi nổi xung phong chữa bài tập hình học số 3. Làm bài tập về nhà rất chỉn chu.&rdquo;
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onViewHistoryClick}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 px-3 text-xs font-bold transition-all shadow-2xs"
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>Xem Lịch Sử</span>
            </button>

            {onOpenParentPortal && (
              <button
                type="button"
                onClick={onOpenParentPortal}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white py-2 px-3 text-xs font-bold transition-all shadow-xs"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Sổ Liên Lạc</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
