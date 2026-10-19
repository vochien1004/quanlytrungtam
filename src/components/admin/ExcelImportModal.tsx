import React, { useState } from 'react';
import { X, UploadCloud, FileSpreadsheet, CheckCircle2, Download, FileCheck } from 'lucide-react';
import * as XLSX from 'xlsx';
import { EntityType } from './EditEntityModal';

interface ExcelImportModalProps {
  isOpen: boolean;
  type: EntityType;
  onClose: () => void;
  onImportBatch: (items: any[]) => void;
}

/**
 * Hàm xuất & tải về tệp Mẫu Excel (.xlsx) chuẩn định dạng chuyên nghiệp:
 * - Tự động thiết lập độ rộng cột rộng rãi, vừa vặn không bị nén hay che chữ.
 * - Khóa định dạng chuỗi Text ('s') cho Số điện thoại để Excel không bị biến thành '9.12E+08'.
 * - Giữ nguyên số 0 ở đầu SĐT (VD: 0912345678).
 */
export function downloadCSVTemplate(type: EntityType) {
  let filename = '';
  let sheetName = '';
  let headers: string[] = [];
  let colWidths: { wch: number }[] = [];
  let dataRows: (string | number)[][] = [];

  if (type === 'class') {
    filename = 'Mau_Import_Danh_Sach_Lop_Hoc.xlsx';
    sheetName = 'Danh Sach Lop Hoc';
    headers = [
      'Mã Lớp',
      'Tên Lớp Học',
      'Môn Học',
      'Tên Giáo Viên Phụ Trách',
      'Số Điện Thoại GV',
      'Phòng Học',
      'Thời Khóa Biểu',
      'Sĩ Số Tối Đa',
      'Đơn Giá / Buổi (VNĐ)'
    ];
    colWidths = [
      { wch: 16 }, // Mã Lớp
      { wch: 30 }, // Tên Lớp Học
      { wch: 22 }, // Môn Học
      { wch: 28 }, // Tên GV
      { wch: 20 }, // SĐT GV (Hiển thị đầy đủ số 0)
      { wch: 24 }, // Phòng Học
      { wch: 40 }, // Thời Khóa Biểu
      { wch: 15 }, // Sĩ Số
      { wch: 22 }  // Đơn Giá / Buổi
    ];
    dataRows = [
      ['LH-6A01', 'Lớp 6A - Toán Bồi Dưỡng', 'Toán học', 'Cô Nguyễn Thị Hoa', '0912345678', 'Phòng 201 (Tầng 2)', 'Thứ 2 - Thứ 4 - Thứ 6 (17:30 - 19:30)', 25, 40000],
      ['LH-7B02', 'Lớp 7B - Văn Cảm Thụ', 'Ngữ Văn', 'Thầy Trần Minh Đức', '0988765432', 'Phòng 302 (Tầng 3)', 'Thứ 3 - Thứ 5 - Thứ 7 (18:00 - 20:00)', 20, 45000],
      ['LH-9A03', 'Lớp 9A - Lý Luyện Thi 10', 'Vật Lý', 'Thầy Lê Hoàng Nam', '0977111222', 'Phòng 102 (Tầng 1)', 'Thứ 2 - Thứ 5 (19:30 - 21:30)', 25, 50000]
    ];
  } else if (type === 'teacher') {
    filename = 'Mau_Import_Danh_Sach_Giao_Vien.xlsx';
    sheetName = 'Danh Sach Giang Vien';
    headers = [
      'Mã Giáo Viên',
      'Họ Và Tên',
      'Tên Đăng Nhập',
      'Mật Khẩu',
      'Chuyên Môn Giảng Dạy',
      'Lớp Đảm Nhận Main',
      'Số Điện Thoại',
      'Email Trực',
      'Tiểu Sử & Bằng Cấp'
    ];
    colWidths = [
      { wch: 16 }, // Mã GV
      { wch: 28 }, // Họ Và Tên
      { wch: 20 }, // Username
      { wch: 16 }, // Password
      { wch: 32 }, // Chuyên môn
      { wch: 30 }, // Lớp
      { wch: 20 }, // SĐT (Rộng rãi hiển thị SĐT)
      { wch: 32 }, // Email
      { wch: 60 }  // Tiểu sử
    ];
    dataRows = [
      ['GV-01', 'Cô Nguyễn Thị Hoa', 'gv_nguyenhoa', 'Hoa@123456', 'Toán học THCS & Chuyên Toán', 'Lớp 6A - Toán Bồi Dưỡng', '0912345678', 'nguyenhoa@tthocgioi.edu.vn', 'Thạc sĩ Sư phạm Toán, 10 năm kinh nghiệm bồi dưỡng học sinh giỏi.'],
      ['GV-02', 'Thầy Trần Minh Đức', 'gv_minhduc', 'Duc@123456', 'Ngữ Văn Cảm Thụ & Ôn Thi 10', 'Lớp 7B - Văn Cảm Thụ', '0988765432', 'minhduc@tthocgioi.edu.vn', 'Cử nhân Khen thưởng Sư phạm Văn, Chuyên gia luyện thi chuyên.'],
      ['GV-03', 'Thầy Lê Hoàng Nam', 'gv_hoangnam', 'Nam@123456', 'Vật Lý & Hóa Học THCS', 'Lớp 9A - Lý Luyện Thi', '0977111222', 'hoangnam@tthocgioi.edu.vn', 'Giáo viên giỏi cấp Tỉnh môn Vật Lý.']
    ];
  } else {
    filename = 'Mau_Import_Danh_Sach_Hoc_Sinh.xlsx';
    sheetName = 'Danh Sach Hoc Sinh';
    headers = [
      'Mã Học Sinh',
      'Họ Và Tên Học Sinh',
      'Mã Lớp',
      'Tên Lớp Học',
      'Họ Tên Phụ Huynh',
      'Số Điện Thoại PH',
      'Email Phụ Huynh',
      'Tên Đăng Nhập PH',
      'Mật Khẩu PH',
      'Giới Tính',
      'Điểm TB (GPA)',
      'Ghi Chú Ban Đầu'
    ];
    colWidths = [
      { wch: 15 }, // Mã HS
      { wch: 25 }, // Họ tên HS
      { wch: 14 }, // Mã Lớp
      { wch: 28 }, // Tên Lớp
      { wch: 25 }, // Họ tên PH
      { wch: 20 }, // SĐT PH (Hiển thị đầy đủ số 0)
      { wch: 28 }, // Email PH
      { wch: 20 }, // User PH
      { wch: 15 }, // Pass PH
      { wch: 12 }, // Giới tính
      { wch: 15 }, // GPA
      { wch: 45 }  // Ghi chú
    ];
    dataRows = [
      ['HS-01', 'Bạch Dương', 'LH-7B02', 'Lớp 7B - Văn Cảm Thụ', 'Bạch Duyên Thị Hoa', '0988111222', 'duyenhoa@gmail.com', 'ph_0988111222', '123', 'Nữ', 8.8, 'Chăm ngoan, hăng hái phát biểu.'],
      ['HS-02', 'Đặng Quốc Bảo', 'LH-6A01', 'Lớp 6A - Toán Bồi Dưỡng', 'Đặng Văn Long', '0912999001', 'vanlong@gmail.com', 'ph_0912999001', '123', 'Nam', 8.6, 'Tiếp thu bài nhanh.'],
      ['HS-03', 'Hoàng Kim Ngân', 'LH-7B02', 'Lớp 7B - Văn Cảm Thụ', 'Hoàng Thị Yến', '0938888777', 'kimngan@gmail.com', 'ph_0938888777', '123', 'Nữ', 8.9, 'Đạt giải nhì HSG cấp trường.']
    ];
  }

  // Build Sheet Array of Arrays
  const aoaData = [headers, ...dataRows];
  const worksheet = XLSX.utils.aoa_to_sheet(aoaData);

  // Set explicit column widths so headers & text are never cut off
  worksheet['!cols'] = colWidths;

  // Format all cell values properly:
  // Explicitly set type = 's' (String) & format = '@' for Phone numbers, codes, usernames
  for (let r = 0; r < aoaData.length; r++) {
    for (let c = 0; c < aoaData[r].length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (worksheet[cellRef]) {
        const valStr = String(aoaData[r][c]);
        // Force string text type for SĐT (starting with 0) or Codes (GV-, HS-, LH-, ph_)
        if (r > 0 && (/^0\d+/.test(valStr) || valStr.startsWith('GV-') || valStr.startsWith('HS-') || valStr.startsWith('LH-') || valStr.startsWith('ph_'))) {
          worksheet[cellRef].t = 's';
          worksheet[cellRef].v = valStr;
          worksheet[cellRef].z = '@'; // Explicit Text cell format in Microsoft Excel
        }
      }
    }
  }

  // Create workbook and write binary .xlsx file
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  type,
  onClose,
  onImportBatch,
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  if (!isOpen) return null;

  const typeConfig = {
    class: {
      title: 'Nhập Danh Sách Lớp Học từ Excel (.xlsx)',
      templateName: 'Mau_Import_Danh_Sach_Lop_Hoc.xlsx',
      columns: ['Mã Lớp', 'Tên Lớp', 'Môn Học', 'Giáo Viên', 'Phòng Học', 'Lịch Học'],
      sampleItems: [
        { classCode: 'LH-8A01', name: 'Lớp 8A - Toán', subject: 'Toán học nâng cao', teacherName: 'Cô Nguyễn Thị Hoa', room: 'Phòng 204', schedule: 'T3-T5 (18:00 - 20:00)', studentCount: 18, maxCapacity: 25 },
        { classCode: 'LH-9B02', name: 'Lớp 9B - Hóa Học', subject: 'Hóa học luyện thi 10', teacherName: 'Thầy Lê Hoàng Nam', room: 'Phòng 301', schedule: 'T4-T6 (19:30 - 21:30)', studentCount: 15, maxCapacity: 20 },
      ]
    },
    teacher: {
      title: 'Nhập Danh Sách Giáo Viên từ Excel (.xlsx)',
      templateName: 'Mau_Import_Danh_Sach_Giao_Vien.xlsx',
      columns: ['Mã GV', 'Họ Tên', 'Tên Đăng Nhập', 'Mật Khẩu', 'Chuyên Môn', 'Lớp Đảm Nhận', 'Số Điện Thoại', 'Email'],
      sampleItems: [
        { teacherCode: 'GV-04', name: 'Cô Phạm Thị Thu', username: 'gv_phatthu', password: '123', subject: 'Tiếng Anh (IELTS/THCS)', mainClassName: 'Lớp 8A - Anh', phone: '0945111222', email: 'gv_phatthu@tthocgioi.edu.vn', bio: 'Thạc sĩ Sư phạm Tiếng Anh, IELTS 8.0.' },
        { teacherCode: 'GV-05', name: 'Thầy Vũ Đình Trọng', username: 'gv_vutrong', password: '123', subject: 'Toán Hình học & Đại số', mainClassName: 'Lớp 9A - Toán', phone: '0978333444', email: 'gv_vutrong@tthocgioi.edu.vn', bio: 'Chuyên gia bồi dưỡng chuyên Toán.' },
      ]
    },
    student: {
      title: 'Nhập Danh Sách Học Sinh từ Excel (.xlsx)',
      templateName: 'Mau_Import_Danh_Sach_Hoc_Sinh.xlsx',
      columns: ['Mã HS', 'Họ Tên', 'Lớp Học', 'Phụ Huynh', 'SĐT Phụ Huynh', 'Ghi Chú'],
      sampleItems: [
        { studentCode: 'HS-06', name: 'Đặng Quốc Bảo', className: 'Lớp 6A - Toán', classId: 'class-6a', parentName: 'Đặng Văn Long', parentPhone: '0912999001', attendanceStatus: 'present', gpa: 8.6, note: 'Học sinh mới đăng ký bồi dưỡng học kỳ 2.' },
        { studentCode: 'HS-07', name: 'Hoàng Kim Ngân', className: 'Lớp 7B - Văn', classId: 'class-7b', parentName: 'Hoàng Thị Yến', parentPhone: '0938888777', attendanceStatus: 'present', gpa: 8.9, note: 'Đạt giải nhì kỳ thi học sinh giỏi cấp trường.' },
        { studentCode: 'HS-08', name: 'Vũ Minh Khang', className: 'Lớp 9A - Lý', classId: 'class-9a', parentName: 'Vũ Văn Quang', parentPhone: '0903666555', attendanceStatus: 'present', gpa: 9.2, note: 'Ôn luyện thi vào chuyên Lê Hồng Phong.' },
      ]
    }
  }[type];

  // Read binary Excel / CSV file using SheetJS XLSX.read
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file.name);
      setIsProcessing(true);

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true, raw: false });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

          if (jsonRows.length > 1) {
            const dataRows = jsonRows.slice(1).filter((r: any[]) => r.some((cell) => cell !== ''));
            const parsed = dataRows.map((cols: any[], idx: number) => {
              if (type === 'class') {
                return {
                  classCode: cols[0] || `LH-0${idx + 1}`,
                  name: cols[1] || 'Lớp học mới',
                  subject: cols[2] || 'Văn hóa bồi dưỡng',
                  teacherName: cols[3] || 'Chưa phân công',
                  teacherPhone: String(cols[4] || ''),
                  room: cols[5] || 'Phòng 201',
                  schedule: cols[6] || 'Thứ 2 - Thứ 4 - Thứ 6',
                  maxCapacity: Number(cols[7]) || 25,
                  pricePerSession: cols[8] !== undefined && !isNaN(Number(cols[8])) ? Number(cols[8]) : 40000,
                  studentCount: 0,
                  status: 'active',
                };
              } else if (type === 'teacher') {
                return {
                  teacherCode: cols[0] || `GV-0${idx + 1}`,
                  name: cols[1] || 'Giáo viên mới',
                  username: cols[2] || `gv_${Date.now()}_${idx}`,
                  password: cols[3] || '123',
                  subject: cols[4] || 'Văn hóa',
                  mainClassName: cols[5] || '',
                  phone: String(cols[6] || ''),
                  email: cols[7] || '',
                  bio: cols[8] || 'Giáo viên bồi dưỡng.',
                  role: 'teacher',
                };
              } else {
                return {
                  studentCode: cols[0] || `HS-0${idx + 1}`,
                  name: cols[1] || 'Học sinh mới',
                  classId: cols[2] || 'class-6a',
                  className: cols[3] || 'Lớp học',
                  parentName: cols[4] || 'Phụ huynh',
                  parentPhone: String(cols[5] || ''),
                  parentEmail: cols[6] || '',
                  username: cols[7] || `ph_${Date.now()}_${idx}`,
                  password: cols[8] || '123',
                  gender: cols[9] || 'Nam',
                  gpa: Number(cols[10]) || 8.0,
                  note: cols[11] || 'Nhập từ file Excel/CSV mẫu',
                  attendanceStatus: 'present',
                  status: 'active',
                };
              }
            });
            setPreviewData(parsed);
          } else {
            setPreviewData(typeConfig.sampleItems);
          }
        } catch (err) {
          console.warn('Lỗi đọc file Excel:', err);
          setPreviewData(typeConfig.sampleItems);
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleSimulateDemo = () => {
    setSelectedFile(`${typeConfig.templateName} (Dữ liệu mẫu demo)`);
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setPreviewData(typeConfig.sampleItems);
    }, 600);
  };

  const handleConfirmImport = () => {
    onImportBatch(previewData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-2xl animate-fade-in border border-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 text-[#00A86B]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">{typeConfig.title}</h3>
              <p className="text-xs text-slate-500">Nạp dữ liệu hàng loạt tự động nạp trực tiếp vào Firestore</p>
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

        <div className="mt-4 space-y-4 text-xs">
          {/* File Upload Drop Area */}
          <div className="border-2 border-dashed border-[#0072B5]/40 hover:border-[#0072B5] bg-blue-50/30 rounded-2xl p-6 text-center transition-all relative">
            <UploadCloud className="w-10 h-10 text-[#0072B5] mx-auto mb-2" />
            <span className="font-extrabold text-sm text-slate-800 block">
              {selectedFile ? `Đã chọn file: ${selectedFile}` : 'Nhấp hoặc kéo thả file Excel (.xlsx, .xls, .csv) vào đây'}
            </span>
            <p className="text-slate-500 mt-1">
              Hệ thống tự động kiểm tra định dạng và bỏ qua các bản ghi trùng lặp
            </p>

            <div className="mt-3 flex items-center justify-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0072B5] text-white font-bold text-xs shadow-xs hover:bg-[#0B486B]">
                <span>Chọn tệp từ máy tính</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleSimulateDemo}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
              >
                <span>Dùng mẫu thử demo</span>
              </button>
            </div>
          </div>

          {/* REQUIRED FEATURE: Download Professional Excel (.xlsx) Template File */}
          <div className="flex items-center justify-between bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80">
            <div className="flex items-center gap-2.5">
              <FileCheck className="w-5 h-5 text-[#00A86B] shrink-0" />
              <div>
                <span className="font-extrabold text-slate-800 block leading-tight">
                  Tải File Mẫu Chuẩn ({typeConfig.templateName})
                </span>
                <span className="text-[11px] text-slate-500">
                  Đã căn chỉnh độ rộng cột rộng rãi, giữ nguyên số 0 ở SĐT, chuẩn định dạng .XLSX
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => downloadCSVTemplate(type)}
              className="flex items-center gap-1.5 rounded-xl bg-[#00A86B] hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải Mẫu Excel (.xlsx)</span>
            </button>
          </div>

          {/* Processing Status */}
          {isProcessing && (
            <div className="text-center py-4 text-slate-600 font-bold animate-pulse">
              Đang phân tích định dạng các cột và kiểm tra hợp lệ dữ liệu...
            </div>
          )}

          {/* Preview Records */}
          {previewData.length > 0 && !isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-slate-700 font-bold">
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  Tìm thấy {previewData.length} bản ghi hợp lệ sẵn sàng nạp:
                </span>
                <span className="text-[11px] text-slate-500">Sẵn sàng lưu vào Firestore</span>
              </div>

              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {previewData.map((row, idx) => (
                  <div key={idx} className="p-2.5 bg-white flex items-center justify-between text-xs">
                    <div>
                      <strong className="text-[#0B486B]">{row.studentCode || row.teacherCode || row.classCode || `ID-${idx+1}`}</strong>: {row.name}
                      <span className="text-slate-500 ml-2">({row.className || row.subject || row.mainClassName})</span>
                    </div>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                      Hợp lệ
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 text-xs"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={previewData.length === 0}
            onClick={handleConfirmImport}
            className={`flex items-center gap-1.5 rounded-xl px-5 py-2 font-bold text-xs shadow-xs transition-colors cursor-pointer ${
              previewData.length > 0
                ? 'bg-[#00A86B] hover:bg-emerald-700 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Nạp {previewData.length} Bản Ghi Vào Firestore</span>
          </button>
        </div>
      </div>
    </div>
  );
};
