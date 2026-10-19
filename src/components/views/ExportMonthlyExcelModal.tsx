import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  X, 
  Download, 
  Calendar, 
  Layers, 
  Users, 
  CheckCircle2, 
  Building2, 
  Sparkles,
  School,
  ChevronRight,
  Info
} from 'lucide-react';
import { ClassItem, TeacherItem, StudentItem } from '../../data/mockData';
import { exportAllClassesAttendanceWorkbook } from '../../services/excelExportService';

interface ExportMonthlyExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassItem[];
  teachers: TeacherItem[];
  students: StudentItem[];
  attendanceRecords: any[];
  pricesMap: Record<string, number>;
  showFinancials: boolean;
  initialMonth?: string;
  centerName?: string;
}

export const ExportMonthlyExcelModal: React.FC<ExportMonthlyExcelModalProps> = ({
  isOpen,
  onClose,
  classes = [],
  teachers = [],
  students = [],
  attendanceRecords = [],
  pricesMap = {},
  showFinancials = true,
  initialMonth,
  centerName = 'TRUNG TÂM ĐÀO TẠO',
}) => {
  // Tháng được chọn để xuất Excel (mặc định lấy từ props hoặc tháng hiện tại)
  const defaultMonth = initialMonth || new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [includeOverviewSheet, setIncludeOverviewSheet] = useState<boolean>(true);
  const [includeFinancials, setIncludeFinancials] = useState<boolean>(showFinancials);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Danh sách các tháng để chọn (năm hiện tại và các năm lân cận)
  const monthOptions = useMemo(() => {
    const [yearStr] = (selectedMonth || defaultMonth).split('-');
    const currentYear = parseInt(yearStr || '2026', 10);
    const options: { value: string; label: string }[] = [];

    // Hỗ trợ chọn trong 3 năm: năm trước, năm nay, năm sau
    [currentYear - 1, currentYear, currentYear + 1].forEach((yr) => {
      for (let m = 1; m <= 12; m++) {
        const mStr = m.toString().padStart(2, '0');
        options.push({
          value: `${yr}-${mStr}`,
          label: `Tháng ${mStr}/${yr}`,
        });
      }
    });

    return options;
  }, [selectedMonth, defaultMonth]);

  // Thống kê nhanh theo tháng được chọn
  const monthStats = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr || '2026', 10);
    const month = parseInt(monthStr || '10', 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const monthlyRecords = attendanceRecords.filter((att) => {
      if (!att) return false;
      const dateStr = att.date || att.sessionDate || '';
      return att.sessionMonth === selectedMonth || dateStr.startsWith(selectedMonth);
    });

    return {
      daysInMonth,
      recordCount: monthlyRecords.length,
      classCount: classes.length,
      studentCount: students.length,
      monthFormatted: `${monthStr}/${yearStr}`,
    };
  }, [selectedMonth, attendanceRecords, classes, students]);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportSuccess(null);

      // Gọi service xuất file Excel nhiều sheet
      const result = await exportAllClassesAttendanceWorkbook({
        month: selectedMonth,
        classes,
        teachers,
        students,
        attendanceRecords,
        pricesMap,
        showFinancials: includeFinancials && showFinancials,
        includeOverviewSheet,
        centerName,
      });

      setExportSuccess(
        `✓ Đã xuất thành công file "${result.filename}" với ${result.classSheetCount} sheet lớp học (chuẩn in A4 nằm ngang)!`
      );

      // Tự động đóng modal sau 2.5s nếu người dùng không bấm
      setTimeout(() => {
        setIsExporting(false);
      }, 700);
    } catch (error) {
      console.error('Lỗi khi xuất file Excel tổng hợp:', error);
      alert('Có lỗi xảy ra khi tạo file Excel. Vui lòng thử lại!');
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-2xl overflow-hidden animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        {/* HEADER MODAL */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-[#0B486B] text-white p-5 md:p-6 flex items-start justify-between relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center ring-2 ring-white/20 shadow-inner">
              <FileSpreadsheet className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black tracking-tight text-white flex items-center gap-2">
                <span>Xuất File Excel Điểm Danh Tổng Hợp</span>
                <span className="text-[10px] bg-emerald-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Mỗi lớp 1 sheet
                </span>
              </h2>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Xuất toàn bộ bảng điểm danh của tất cả các lớp trên 1 file Excel (.xlsx) duy nhất
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY MODAL */}
        <div className="p-5 md:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* THÔNG BÁO THÀNH CÔNG NẾU CÓ */}
          {exportSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2.5 shadow-2xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{exportSuccess}</span>
            </div>
          )}

          {/* 1. CHỌN THÁNG ĐỂ XUẤT */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>CHỌN THÁNG ĐỂ XUẤT ĐIỂM DANH:</span>
              </span>
              <span className="text-[11px] font-bold text-emerald-700 lowercase">
                (Tháng {monthStats.monthFormatted} có {monthStats.daysInMonth} ngày)
              </span>
            </label>

            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setExportSuccess(null);
                }}
                className="w-full appearance-none rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-900 shadow-2xs transition-all cursor-pointer focus:border-emerald-600 focus:outline-hidden focus:ring-2 focus:ring-emerald-100 pr-10"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} {opt.value === defaultMonth ? '★ (Tháng hiện tại)' : ''}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-emerald-700">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* 2. CHỈ SỐ THỐNG KÊ TỔNG HỢP TRONG THÁNG ĐƯỢC CHỌN */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center justify-center gap-1">
                <School className="w-3.5 h-3.5 text-[#0072B5]" />
                <span>Số Lớp Sẽ Xuất</span>
              </div>
              <div className="text-xl font-black text-[#0B486B] mt-1">
                {classes.length} <span className="text-xs font-semibold text-slate-500">lớp</span>
              </div>
              <div className="text-[10px] text-blue-600 font-semibold mt-0.5">
                ={classes.length} sheet Excel
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center justify-center gap-1">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tổng Học Sinh</span>
              </div>
              <div className="text-xl font-black text-emerald-700 mt-1">
                {students.length} <span className="text-xs font-semibold text-slate-500">HS</span>
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                Toàn trung tâm
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Buổi Đã Điểm Danh</span>
              </div>
              <div className="text-xl font-black text-amber-700 mt-1">
                {monthStats.recordCount} <span className="text-xs font-semibold text-slate-500">buổi</span>
              </div>
              <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
                Trong tháng {monthStats.monthFormatted}
              </div>
            </div>
          </div>

          {/* 3. DANH SÁCH SHEET SẼ ĐƯỢC TẠO TRONG FILE EXCEL */}
          <div className="space-y-2">
            <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#0072B5]" />
              <span>CẤU TRÚC CÁC SHEET TRONG FILE EXCEL:</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {includeOverviewSheet && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-100/80 text-[#0072B5] text-xs font-black border border-blue-200 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Sheet 1: Tổng Hợp Trung Tâm
                  </span>
                )}
                {classes.map((c, idx) => (
                  <span
                    key={c.id || idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white text-slate-800 text-xs font-bold border border-slate-200 shadow-2xs"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Sheet {includeOverviewSheet ? idx + 2 : idx + 1}: {c.name}
                  </span>
                ))}
              </div>

              <p className="text-[11px] text-slate-500 flex items-center gap-1 pt-1">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  Mỗi sheet lớp học chứa đầy đủ bảng điểm danh 31 ngày (X, P, K), sĩ số, SĐT phụ huynh, tổng buổi và học phí.
                </span>
              </p>
            </div>
          </div>

          {/* 4. TÙY CHỌN BỔ SUNG */}
          <div className="space-y-2.5 pt-1 border-t border-slate-200/80">
            <label className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={includeOverviewSheet}
                onChange={(e) => setIncludeOverviewSheet(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
              />
              <div className="text-xs">
                <div className="font-bold text-slate-800">
                  Tạo thêm Sheet "Tổng Hợp Trung Tâm" ở đầu file
                </div>
                <div className="text-slate-500 text-[11px]">
                  Tóm tắt số lớp, sĩ số, số buổi đã điểm danh và dự thu học phí của toàn bộ các lớp.
                </div>
              </div>
            </label>

            {showFinancials && (
              <label className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={includeFinancials}
                  onChange={(e) => setIncludeFinancials(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-800">
                    Bao gồm các cột Đơn giá và Dự thu học phí (Dành riêng Center Admin)
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Hiển thị cột Đơn giá (đ) và Tổng tiền học phí dự thu theo số buổi học sinh có mặt.
                  </div>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* FOOTER MODAL */}
        <div className="p-4 md:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            Đóng
          </button>

          <button
            type="button"
            disabled={isExporting || classes.length === 0}
            onClick={handleExport}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black shadow-md transition-all cursor-pointer ${
              classes.length === 0
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-[#0072B5] hover:from-emerald-700 hover:to-blue-700 text-white shadow-emerald-600/20 hover:shadow-lg'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>
              {isExporting ? 'Đang tạo file Excel...' : `Tải Xuống File Excel (${classes.length} Lớp - Tháng ${monthStats.monthFormatted})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
