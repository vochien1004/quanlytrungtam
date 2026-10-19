import React, { useState } from 'react';
import { School, Plus, Users, Calendar, MapPin, Edit3, Trash2, Download, DollarSign } from 'lucide-react';
import { ClassItem } from '../../data/mockData';
import { downloadCSVTemplate } from '../admin/ExcelImportModal';
import { ConfirmDeleteModal } from '../admin/ConfirmDeleteModal';

interface AdminClassesViewProps {
  classes?: ClassItem[];
  onAddClassClick: () => void;
  onEditClassClick?: (cls: ClassItem) => void;
  onDeleteClassClick?: (classId: string) => void;
}

export const AdminClassesView: React.FC<AdminClassesViewProps> = ({
  classes = [],
  onAddClassClick,
  onEditClassClick,
  onDeleteClassClick,
}) => {
  const [deletingClass, setDeletingClass] = useState<ClassItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDeleteClass = async () => {
    if (!deletingClass || !onDeleteClassClick) return;
    setIsDeleting(true);
    try {
      await onDeleteClassClick(deletingClass.id);
      setDeletingClass(null);
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-[#0B486B]">Danh Sách &amp; Quản Lý Lớp Học</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý thời khóa biểu, phòng học, giáo viên phụ trách và sĩ số lưu trên Firestore collection &lsquo;classes&rsquo;
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadCSVTemplate('class')}
            className="flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-3.5 text-xs font-bold transition-all border border-slate-200 cursor-pointer"
            title="Tải về file Excel mẫu để nhập nhiều lớp học cùng lúc"
          >
            <Download className="w-4 h-4 text-[#0072B5]" />
            <span>Tải Mẫu Excel</span>
          </button>
          <button
            type="button"
            onClick={onAddClassClick}
            className="flex items-center gap-2 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white py-2.5 px-4 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Thêm Lớp Mới</span>
          </button>
        </div>
      </div>

      {(classes || []).length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0072B5] mb-2">
            <School className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Chưa có lớp học nào</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Bấm nút bên dưới để tạo lớp học mới lưu trực tiếp vào Firestore collection &lsquo;classes&rsquo;.
          </p>
          <button
            type="button"
            onClick={onAddClassClick}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm lớp học ngay</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(classes || []).map((cls, idx) => {
            if (!cls) return null;
            const occupancy = Math.round(((cls?.studentCount || 0) / (cls?.maxCapacity || 25)) * 100);
            const classCode = cls?.classCode || `LH-0${idx + 1}`;

            return (
              <div
                key={cls?.id || idx}
                className="rounded-2xl border-2 border-slate-200/80 bg-white p-5 shadow-xs hover:border-[#0072B5] hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#0072B5] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                        {cls?.subject ? cls.subject.split(' ')[0] : 'Môn học'}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {classCode}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {occupancy}% sĩ số
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-extrabold text-slate-800">{cls?.name || 'Lớp học'}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{cls?.subject || 'Bộ môn'}</p>

                  <div className="mt-4 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span>GV: <strong className="text-slate-800">{cls?.teacherName || 'Chưa phân công'}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span>{cls?.room || 'Phòng học'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-[11px]">{cls?.schedule || 'Lịch linh hoạt'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span className="text-[11px] font-bold text-slate-700">
                        Đơn giá: <strong className="text-emerald-700 font-extrabold">{((cls?.pricePerSession !== undefined ? cls.pricePerSession : 40000) || 0).toLocaleString('vi-VN')} đ/buổi</strong>
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                      <span>Sĩ số: {cls?.studentCount || 0}/{cls?.maxCapacity || 25} học sinh</span>
                      <span className="text-emerald-600 font-bold">
                        {cls?.status === 'paused' ? 'Tạm dừng' : cls?.status === 'pending' ? 'Chờ khai giảng' : 'Đang hoạt động'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#0072B5] h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(occupancy, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {onEditClassClick && (
                      <button
                        type="button"
                        onClick={() => onEditClassClick(cls)}
                        className="text-slate-600 hover:text-[#0072B5] font-semibold flex items-center gap-1 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Chỉnh sửa lớp học"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Sửa</span>
                      </button>
                    )}
                    {onDeleteClassClick && (
                      <button
                        type="button"
                        onClick={() => setDeletingClass(cls)}
                        className="text-rose-500 hover:text-rose-700 font-semibold flex items-center gap-1 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Xóa lớp học"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Firestore</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deletingClass && (
        <ConfirmDeleteModal
          isOpen={!!deletingClass}
          itemName={deletingClass.name}
          itemType="lớp học"
          itemCode={deletingClass.classCode}
          itemSubInfo={`Môn: ${deletingClass.subject} • Sĩ số: ${deletingClass.studentCount || 0}/${deletingClass.maxCapacity || 25} • GV: ${deletingClass.teacherName || 'Chưa phân công'}`}
          isDeleting={isDeleting}
          onConfirm={handleConfirmDeleteClass}
          onClose={() => setDeletingClass(null)}
        />
      )}
    </div>
  );
};
