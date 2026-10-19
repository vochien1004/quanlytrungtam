import React from 'react';
import { Plus, FileText, TrendingUp, Users, School, GraduationCap, FileSpreadsheet } from 'lucide-react';
import { ClassItem, TeacherItem, StudentItem } from '../data/mockData';

interface AdminSystemCardProps {
  classes: ClassItem[];
  teachers: TeacherItem[];
  students: StudentItem[];
  onAddClassClick: () => void;
  onImportStudentsClick: () => void;
  onManageClassesClick: () => void;
  onManageTeachersClick?: () => void;
  onManageStudentsClick?: () => void;
  onExportMonthlyExcelClick?: () => void;
}

export const AdminSystemCard: React.FC<AdminSystemCardProps> = ({
  classes,
  teachers,
  students,
  onAddClassClick,
  onImportStudentsClick,
  onManageClassesClick,
  onManageTeachersClick,
  onManageStudentsClick,
  onExportMonthlyExcelClick,
}) => {
  return (
    <div className="rounded-2xl border-2 border-amber-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h2 className="text-base font-extrabold text-[#0B486B] tracking-tight flex items-center gap-2">
          <span className="w-2 h-5 rounded-full bg-[#0072B5]"></span>
          Hệ Thống Quản Trị Admin
        </h2>
        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          Cập nhật hôm nay
        </span>
      </div>

      {/* 3 Metric Stats with Mini Bar Charts matching screenshot */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Metric 1: Classes */}
        <div 
          onClick={onManageClassesClick}
          className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-br from-blue-50/60 to-white p-3.5 transition-all hover:border-[#0072B5] hover:shadow-xs"
        >
          <div className="text-[12px] font-bold text-slate-600 flex items-center justify-between">
            <span>Danh Sách Lớp Học:</span>
            <School className="w-3.5 h-3.5 text-[#0072B5]" />
          </div>
          <div className="mt-1 flex items-end justify-between">
            <span className="text-2xl font-black text-[#0B486B]">{classes.length}</span>
            {/* Mini Blue Bar Chart */}
            <div className="flex items-end gap-1 h-6">
              <span className="w-1.5 h-2 bg-blue-300 rounded-t-xs"></span>
              <span className="w-1.5 h-3 bg-blue-400 rounded-t-xs"></span>
              <span className="w-1.5 h-4 bg-blue-500 rounded-t-xs"></span>
              <span className="w-1.5 h-5 bg-[#0072B5] rounded-t-xs"></span>
              <span className="w-1.5 h-6 bg-[#0B486B] rounded-t-xs"></span>
            </div>
          </div>
          <div className="mt-1 text-[10px] text-blue-600 font-semibold flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" />
            Đồng bộ Firestore
          </div>
        </div>

        {/* Metric 2: Teachers */}
        <div 
          onClick={onManageTeachersClick}
          className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-br from-amber-50/60 to-white p-3.5 transition-all hover:border-[#F39C12] hover:shadow-xs"
        >
          <div className="text-[12px] font-bold text-slate-600 flex items-center justify-between">
            <span>Giáo Viên:</span>
            <Users className="w-3.5 h-3.5 text-[#F39C12]" />
          </div>
          <div className="mt-1 flex items-end justify-between">
            <span className="text-2xl font-black text-[#B7791F]">{teachers.length}</span>
            {/* Mini Orange/Yellow Bar Chart */}
            <div className="flex items-end gap-1 h-6">
              <span className="w-1.5 h-2 bg-amber-300 rounded-t-xs"></span>
              <span className="w-1.5 h-3.5 bg-amber-400 rounded-t-xs"></span>
              <span className="w-1.5 h-4 bg-[#F39C12] rounded-t-xs"></span>
              <span className="w-1.5 h-5 bg-amber-600 rounded-t-xs"></span>
              <span className="w-1.5 h-6 bg-[#D97706] rounded-t-xs"></span>
            </div>
          </div>
          <div className="mt-1 text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" />
            Tài khoản active
          </div>
        </div>

        {/* Metric 3: Students */}
        <div 
          onClick={onManageStudentsClick}
          className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-br from-emerald-50/60 to-white p-3.5 transition-all hover:border-[#00A86B] hover:shadow-xs"
        >
          <div className="text-[12px] font-bold text-slate-600 flex items-center justify-between">
            <span>Học Sinh:</span>
            <GraduationCap className="w-3.5 h-3.5 text-[#00A86B]" />
          </div>
          <div className="mt-1 flex items-end justify-between">
            <span className="text-2xl font-black text-[#047857]">{students.length}</span>
            {/* Mini Green Bar Chart */}
            <div className="flex items-end gap-1 h-6">
              <span className="w-1.5 h-2 bg-emerald-300 rounded-t-xs"></span>
              <span className="w-1.5 h-3 bg-emerald-400 rounded-t-xs"></span>
              <span className="w-1.5 h-4.5 bg-emerald-500 rounded-t-xs"></span>
              <span className="w-1.5 h-5.5 bg-[#00A86B] rounded-t-xs"></span>
              <span className="w-1.5 h-6 bg-emerald-700 rounded-t-xs"></span>
            </div>
          </div>
          <div className="mt-1 text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" />
            Hồ sơ học sinh (Nhấn để xem)
          </div>
        </div>
      </div>

      {/* Action Buttons matching image 1 */}
      <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          onClick={onAddClassClick}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white py-2.5 px-4 text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>[+] Thêm Lớp Mới</span>
        </button>

        <button
          type="button"
          onClick={onImportStudentsClick}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-slate-50 text-[#0072B5] border-2 border-[#0072B5] py-2.5 px-4 text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <FileText className="w-4 h-4 text-[#0072B5]" />
          <span>[+] Nhập DS Học Sinh</span>
        </button>

        {onExportMonthlyExcelClick && (
          <button
            type="button"
            onClick={onExportMonthlyExcelClick}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-2 border-emerald-500 py-2.5 px-4 text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Xuất file Excel tổng hợp toàn bộ các lớp (chọn tháng để xuất, mỗi lớp 1 sheet)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>[+] Xuất File Excel Tổng Hợp</span>
          </button>
        )}
      </div>
    </div>
  );
};
