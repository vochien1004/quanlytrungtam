import * as XLSXStyleModule from 'xlsx-js-style';
import * as XLSXBaseModule from 'xlsx';
import JSZip from 'jszip';
import { ClassItem, TeacherItem, StudentItem } from '../data/mockData';

/**
 * Helper lấy instance XLSX tương thích mọi môi trường (Vite Dev ESM, UMD window.XLSX, Production Bundle):
 * - Ưu tiên xlsx-js-style (hỗ trợ đầy đủ border, màu nền, font chữ)
 * - Fallback sang window.XLSX hoặc bộ chuẩn xlsx (xlsx.mjs) nếu module UMD chưa export trực tiếp
 */
function getXLSX(): any {
  const styleMod = XLSXStyleModule as any;
  if (styleMod?.utils && typeof styleMod.utils.book_new === 'function') {
    return styleMod;
  }
  if (styleMod?.default?.utils && typeof styleMod.default.utils.book_new === 'function') {
    return styleMod.default;
  }
  if (typeof window !== 'undefined' && (window as any).XLSX?.utils) {
    return (window as any).XLSX;
  }
  const baseMod = XLSXBaseModule as any;
  if (baseMod?.utils && typeof baseMod.utils.book_new === 'function') {
    return baseMod;
  }
  if (baseMod?.default?.utils && typeof baseMod.default.utils.book_new === 'function') {
    return baseMod.default;
  }
  return styleMod;
}

const XLSX: any = getXLSX();

export interface ExportMonthlyAttendanceOptions {
  month: string; // 'YYYY-MM'
  classes: ClassItem[];
  teachers: TeacherItem[];
  students: StudentItem[];
  attendanceRecords: any[];
  pricesMap: Record<string, number>;
  showFinancials: boolean;
  includeOverviewSheet?: boolean;
  centerName?: string;
}

export interface ExportSingleClassOptions {
  month: string;
  cls: ClassItem;
  teacher: TeacherItem | { id?: string; name?: string; fullName?: string; phone?: string; subject?: string; avatar?: string };
  classStudents: StudentItem[];
  monthlyRecords: any[];
  pricePerSession: number;
  showFinancials: boolean;
  centerName?: string;
}

// =========================================================================
// BẢNG MÀU & STYLE CHUẨN ĐỒNG BỘ THEO GIAO DIỆN & HÌNH ẢNH MẪU
// =========================================================================
const COLOR_BRAND = '0B486B';       // Xanh đậm chủ đạo
const COLOR_BLUE = '0072B5';        // Xanh dương điểm nhấn
const COLOR_HEADER_BG = 'F1F5F9';   // Xám nhạt slate-100 cho header
const COLOR_SUBHEADER_BG = 'E2E8F0';// Xám slate-200 cho thanh banner tháng
const COLOR_BORDER = 'CBD5E1';      // Viền kẻ ô slate-300
const COLOR_TEXT_MAIN = '0F172A';   // Chữ đen đậm
const COLOR_TEXT_MUTED = '475569';  // Chữ xám phụ
const COLOR_PRESENT_TEXT = '0B486B';// Chữ X có mặt (xanh đậm)
const COLOR_PRESENT_BG = 'EFF6FF';  // Nền X có mặt (xanh nhạt)
const COLOR_EXCUSED_TEXT = 'B45309';// Chữ P vắng phép (vàng cam)
const COLOR_EXCUSED_BG = 'FEF3C7';  // Nền P (vàng nhạt)
const COLOR_UNEXCUSED_TEXT = 'DC2626'; // Chữ K vắng không phép (đỏ)
const COLOR_UNEXCUSED_BG = 'FEE2E2'; // Nền K (đỏ nhạt)
const COLOR_TOTAL_BG = 'E2E8F0';    // Nền hàng tổng cộng
const COLOR_MONEY_TEXT = '047857';  // Màu tiền học phí (xanh lá cây)
const COLOR_MONEY_BG = 'ECFDF5';    // Nền tiền học phí
const COLOR_MONEY_HEADER_BG = 'DCFCE7'; // Nền header tiền học phí

// Định dạng đường viền ô
const thinBorder = {
  top: { style: 'thin', color: { rgb: COLOR_BORDER } },
  bottom: { style: 'thin', color: { rgb: COLOR_BORDER } },
  left: { style: 'thin', color: { rgb: COLOR_BORDER } },
  right: { style: 'thin', color: { rgb: COLOR_BORDER } },
};

const headerBorder = {
  top: { style: 'thin', color: { rgb: '94A3B8' } },
  bottom: { style: 'medium', color: { rgb: '64748B' } },
  left: { style: 'thin', color: { rgb: COLOR_BORDER } },
  right: { style: 'thin', color: { rgb: COLOR_BORDER } },
};

const totalBorder = {
  top: { style: 'medium', color: { rgb: '64748B' } },
  bottom: { style: 'double', color: { rgb: '334155' } },
  left: { style: 'thin', color: { rgb: COLOR_BORDER } },
  right: { style: 'thin', color: { rgb: COLOR_BORDER } },
};

/**
 * Xử lý tên Sheet trong Excel:
 * - Tối đa 31 ký tự
 * - Không chứa ký tự cấm: \ / ? * : [ ]
 * - Tên sheet duy nhất không trùng lặp
 */
export function sanitizeSheetName(rawName: string, index: number, usedNames: Set<string>): string {
  let clean = (rawName || `Lớp ${index + 1}`).replace(/[\\/?*:[\]]/g, '_').trim();
  if (!clean) clean = `Lớp ${index + 1}`;
  if (clean.length > 28) {
    clean = clean.substring(0, 28);
  }

  let finalName = clean;
  let counter = 1;
  while (usedNames.has(finalName.toLowerCase())) {
    const suffix = `_${counter}`;
    const maxBaseLen = 31 - suffix.length;
    finalName = `${clean.substring(0, maxBaseLen)}${suffix}`;
    counter++;
  }
  usedNames.add(finalName.toLowerCase());
  return finalName;
}

/**
 * Helper kích hoạt tải Blob trên trình duyệt và iframe
 */
function triggerBrowserDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
    URL.revokeObjectURL(url);
  }, 500);
}

/**
 * Helper tải file Excel hỗ trợ môi trường trình duyệt:
 * - Tự động bổ sung PageSetup in ấn vừa khít 1 trang A4 nằm ngang (Landscape, paperSize 9, fitToWidth 1, fitToHeight 1)
 * - Tương thích trình duyệt và iframe
 */
export async function saveWorkbook(workbook: any, filename: string): Promise<void> {
  const xlsxLib = getXLSX();
  try {
    const wbout = xlsxLib.write(workbook, { bookType: 'xlsx', type: 'array' });
    const zipLib: any = (JSZip as any)?.loadAsync ? JSZip : (JSZip as any)?.default;
    if (!zipLib || typeof zipLib.loadAsync !== 'function') {
      throw new Error('JSZip loadAsync not available');
    }
    const zip = await zipLib.loadAsync(wbout);

    // Tiêm cấu hình in ấn: Khổ A4, Xoay ngang (Landscape), Fit to 1 page wide x 1 page tall cho từng worksheet
    for (const sheetPath of Object.keys(zip.files)) {
      if (sheetPath.startsWith('xl/worksheets/sheet') && sheetPath.endsWith('.xml')) {
        let xml = await zip.files[sheetPath].async('string');

        // Bổ sung pageSetUpPr fitToPage="1" vào sheetPr (ở đầu worksheet theo chuẩn OpenXML)
        if (xml.includes('<sheetPr')) {
          xml = xml.replace(/<sheetPr(.*?)>/, '<sheetPr$1><pageSetUpPr fitToPage="1"/>');
        } else {
          xml = xml.replace(/(<worksheet\b[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
        }

        // Bổ sung thẻ <pageSetup> chuẩn A4 nằm ngang (paperSize 9 = A4, orientation="landscape", fitToWidth="1", fitToHeight="1")
        const pageSetupXml = '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="1"/>';
        if (xml.includes('<pageMargins')) {
          xml = xml.replace(/(<pageMargins\b[^>]*\/>)/, '$1' + pageSetupXml);
        } else {
          xml = xml.replace(
            '</worksheet>',
            '<pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.2" footer="0.2"/>' +
              pageSetupXml +
              '</worksheet>'
          );
        }

        zip.file(sheetPath, xml);
      }
    }

    const modifiedBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    triggerBrowserDownload(modifiedBlob, filename);
  } catch (err) {
    console.warn('Lỗi khi tiêm pageSetup bằng JSZip, sử dụng phương thức ghi trực tiếp:', err);
    try {
      const wbout = xlsxLib.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      triggerBrowserDownload(blob, filename);
    } catch {
      xlsxLib.writeFile(workbook, filename);
    }
  }
}

/**
 * Tạo một Worksheet điểm danh cho một lớp học cụ thể có đầy đủ viền, màu sắc, kẻ ô
 * - Đã BỎ tên phòng học
 * - Đã BỎ phần ký của phụ huynh
 * - Tối ưu tỷ lệ cột để in vừa khít 1 trang A4 nằm ngang
 */
function buildClassAttendanceWorksheet({
  cls,
  teacher,
  classStudents,
  monthlyRecords,
  pricePerSession,
  showFinancials,
  month,
  centerName = 'TRUNG TÂM ĐÀO TẠO',
}: {
  cls: ClassItem;
  teacher: any;
  classStudents: StudentItem[];
  monthlyRecords: any[];
  pricePerSession: number;
  showFinancials: boolean;
  month: string;
  centerName?: string;
}) {
  const XLSX = getXLSX();
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const monthNum = parseInt(monthStr || '10', 10);
  const totalDays = new Date(year, monthNum, 0).getDate();
  const daysInMonth = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Số lượng cột: 3 (TT, TÊN HS, SĐT PH) + totalDays + 1 (Tổng buổi) + (2 nếu có tài chính)
  const totalCols = 3 + totalDays + 1 + (showFinancials ? 2 : 0);
  const lastColIdx = totalCols - 1;

  const rows: any[][] = [];

  // =========================================================================
  // 1. HEADER KHỐI THÔNG TIN (HÀNG 0 - 3)
  // =========================================================================
  // Hàng 0: Tên trung tâm đang xuất file (Thay cho TÊN TRUNG TÂM theo yêu cầu)
  const centerDisplayName = (centerName || 'TRUNG TÂM ĐÀO TẠO').trim().toUpperCase();
  rows.push([centerDisplayName]);

  // Hàng 1: Tiêu đề BẢNG ĐIỂM DANH THÁNG MM/YYYY
  const titleText = `${showFinancials ? 'BẢNG ĐIỂM DANH VÀ HỌC PHÍ' : 'BẢNG ĐIỂM DANH'} THÁNG ${monthStr}/${yearStr}`;
  rows.push([titleText]);

  // Hàng 2: Chi tiết Lớp, Giáo viên, Môn học, Sĩ số (ĐÃ BỎ TÊN PHÒNG HỌC THEO YÊU CẦU)
  const teacherDisplay = teacher?.fullName || teacher?.name || 'Chưa phân công';
  const teacherPhone = teacher?.phone ? ` (${teacher.phone})` : '';
  const subInfoText = `Lớp: ${cls.name}   |   GV: ${teacherDisplay}${teacherPhone}   |   Môn: ${cls.subject || 'Toán học'}   |   Sĩ số: ${classStudents.length} HS`;
  rows.push([subInfoText]);

  // Hàng 3: Hàng trống tạo khoảng cách
  rows.push([]);

  // =========================================================================
  // 2. THANH BANNER THÁNG CĂN PHẢI (HÀNG 4)
  // =========================================================================
  const bannerRow: any[] = new Array(totalCols).fill('');
  bannerRow[0] = 'THÔNG TIN HỌC SINH';
  // Đặt chữ THÁNG MM/YYYY ngay trên khối các ngày
  bannerRow[3] = `THÁNG ${monthStr}/${yearStr}`;
  bannerRow[3 + totalDays] = 'TỔNG KẾT';
  rows.push(bannerRow);

  // =========================================================================
  // 3. TIÊU ĐỀ CÁC CỘT (HÀNG 5)
  // Không có cột ký của phụ huynh, chỉ có thông tin điểm danh và học phí
  // =========================================================================
  const headerCols: any[] = ['TT', 'TÊN HỌC SINH', 'SĐT PH'];
  daysInMonth.forEach((d) => headerCols.push(d));
  headerCols.push('Tổng buổi');
  if (showFinancials) {
    headerCols.push('Đơn giá (VNĐ)', 'Tổng tiền (VNĐ)');
  }
  rows.push(headerCols);

  // =========================================================================
  // 4. DANH SÁCH HỌC SINH (HÀNG 6 TRỞ ĐI)
  // =========================================================================
  let totalClassAttended = 0;
  const dailyPresents = new Array(daysInMonth.length).fill(0);

  const startDataRowIdx = rows.length; // Hàng 6

  classStudents.forEach((st, sIdx) => {
    let attendedCount = 0;
    const studentRow: any[] = [sIdx + 1, st.name, st.parentPhone || ''];

    daysInMonth.forEach((d, dIdx) => {
      const dStr = d.toString().padStart(2, '0');
      const iso = `${month}-${dStr}`;
      const rec = monthlyRecords.find((r) => (r.date || r.sessionDate) === iso);
      const sRec = rec?.records?.find((r: any) => r.studentId === st.id || r.id === st.id);

      if (sRec) {
        if (sRec.status === 'present') {
          attendedCount++;
          dailyPresents[dIdx]++;
          studentRow.push('X');
        } else if (sRec.status === 'excused') {
          studentRow.push('P');
        } else if (sRec.status === 'unexcused') {
          studentRow.push('K');
        } else {
          studentRow.push('');
        }
      } else {
        studentRow.push('');
      }
    });

    totalClassAttended += attendedCount;
    studentRow.push(attendedCount);
    if (showFinancials) {
      studentRow.push(pricePerSession, attendedCount * pricePerSession);
    }
    rows.push(studentRow);
  });

  // =========================================================================
  // 5. HÀNG TỔNG CỘNG LỚP
  // =========================================================================
  const totalRowIdx = rows.length;
  const classTotalRow: any[] = ['TỔNG CỘNG LỚP', '', `${classStudents.length} HS`];
  dailyPresents.forEach((count) => {
    classTotalRow.push(count > 0 ? count : '—');
  });
  classTotalRow.push(totalClassAttended);
  if (showFinancials) {
    classTotalRow.push('—', totalClassAttended * pricePerSession);
  }
  rows.push(classTotalRow);

  // =========================================================================
  // =========================================================================
  // 6. GHI CHÚ & CHỮ KÝ DƯỚI BẢNG
  // - ĐÃ BỎ PHẦN KÝ CỦA PHỤ HUYNH THEO YÊU CẦU
  // - Chỉ giữ chữ ký nội bộ: NGƯỜI LẬP BIỂU, GIÁO VIÊN PHỤ TRÁCH, ĐẠI DIỆN TRUNG TÂM
  // - Tự động MERGE các ô qua nhiều cột để không bị khuất/bị cắt chữ
  // =========================================================================

  // Xác định các khoảng cột cho 3 khối chữ ký (Trái, Giữa, Phải):
  // Khối Trái (Người lập biểu): cột 0 -> 6 (rộng ~50 ký tự)
  const leftStartCol = 0;
  const leftEndCol = 6;

  // Khối Giữa (Giáo viên phụ trách): căn giữa bảng (rộng ~32-35 ký tự)
  const midStartCol = Math.floor(totalCols * 0.34);
  const midEndCol = midStartCol + 9;

  // Khối Phải (Đại diện trung tâm & Ngày tháng): dạt hẳn sang lề phải (rộng ~40-55 ký tự)
  const rightStartCol = Math.max(midEndCol + 2, totalCols - 11);
  const rightEndCol = lastColIdx;

  rows.push(new Array(totalCols).fill('')); // hàng trống sau bảng

  // Ghi chú 1
  const note1RowIdx = rows.length;
  const note1Row = new Array(totalCols).fill('');
  note1Row[0] = '* Ghi chú: X = Có mặt (tính tiền) | P = Vắng có phép | K = Vắng không phép | Ô trống = Chưa điểm danh';
  rows.push(note1Row);

  // Ghi chú 2 (nếu có tài chính)
  let note2RowIdx = -1;
  if (showFinancials) {
    note2RowIdx = rows.length;
    const note2Row = new Array(totalCols).fill('');
    note2Row[0] = `* Công thức tính học phí: Tổng tiền = Tổng số buổi có mặt * Đơn giá (${pricePerSession.toLocaleString('vi-VN')} đ/buổi)`;
    rows.push(note2Row);
  }

  rows.push(new Array(totalCols).fill('')); // hàng trống trước khối chữ ký

  // Hàng ngày tháng (bên phải): "..., Ngày ..... tháng ..... năm 20..."
  const dateRowIdx = rows.length;
  const dateSignRow = new Array(totalCols).fill('');
  dateSignRow[rightStartCol] = '..., Ngày ..... tháng ..... năm 20...';
  rows.push(dateSignRow);

  // Hàng tiêu đề chữ ký: NGƯỜI LẬP BIỂU | GIÁO VIÊN PHỤ TRÁCH | ĐẠI DIỆN TRUNG TÂM
  const signTitleRowIdx = rows.length;
  const signTitleRow = new Array(totalCols).fill('');
  signTitleRow[leftStartCol] = 'NGƯỜI LẬP BIỂU';
  signTitleRow[midStartCol] = 'GIÁO VIÊN PHỤ TRÁCH';
  signTitleRow[rightStartCol] = 'ĐẠI DIỆN TRUNG TÂM';
  rows.push(signTitleRow);

  // Hàng phụ đề hướng dẫn ký: (Ký, ghi rõ họ tên) | (Ký, ghi rõ họ tên) | (Ký, đóng dấu)
  const signSubRowIdx = rows.length;
  const signSubRow = new Array(totalCols).fill('');
  signSubRow[leftStartCol] = '(Ký, ghi rõ họ tên)';
  signSubRow[midStartCol] = '(Ký, ghi rõ họ tên)';
  signSubRow[rightStartCol] = '(Ký, đóng dấu)';
  rows.push(signSubRow);

  // 3 hàng trống chừa khoảng cách ký tên
  rows.push(new Array(totalCols).fill(''));
  rows.push(new Array(totalCols).fill(''));
  rows.push(new Array(totalCols).fill(''));

  // Hàng ghi rõ họ tên giáo viên (nếu có)
  const signNameRowIdx = rows.length;
  const signNameRow = new Array(totalCols).fill('');
  const teacherFullName = teacher?.fullName || teacher?.name || '';
  if (teacherFullName) {
    signNameRow[midStartCol] = teacherFullName;
  }
  rows.push(signNameRow);

  // =========================================================================
  // 7. CHUYỂN ĐỔI SANG WORKSHEET & ÁP DỤNG STYLES CHO TỪNG Ô
  // =========================================================================
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Bật hiển thị lưới kẻ ô trong Excel
  ws['!views'] = [{ showGridLines: true }];

  // Thiết lập lề trang nhỏ gọn (Narrow margins: 0.25 inch) để in vừa vặn trong 1 trang A4
  ws['!margins'] = {
    left: 0.25,
    right: 0.25,
    top: 0.35,
    bottom: 0.35,
    header: 0.2,
    footer: 0.2,
  };

  // Thiết lập độ rộng cột tối ưu cho khổ A4 nằm ngang
  const colsConfig: any[] = [
    { wch: 4.5 }, // TT
    { wch: 21 },  // Tên học sinh
    { wch: 12 },  // SĐT PH
  ];
  daysInMonth.forEach(() => {
    colsConfig.push({ wch: 3.2 }); // Cột ngày 1..31 gọn gàng
  });
  colsConfig.push({ wch: 8.5 }); // Tổng buổi
  if (showFinancials) {
    colsConfig.push({ wch: 11.5 }, { wch: 13.5 }); // Đơn giá & Tổng tiền
  }
  ws['!cols'] = colsConfig;

  // Thiết lập chiều cao hàng vừa vặn trang in
  const rowsConfig: any[] = [
    { hpt: 22 }, // Hàng 0: Tên trung tâm
    { hpt: 26 }, // Hàng 1: Tiêu đề Bảng
    { hpt: 19 }, // Hàng 2: Lớp, GV, Môn, Sĩ số
    { hpt: 8 },  // Hàng 3: Khoảng cách
    { hpt: 20 }, // Hàng 4: Banner tháng
    { hpt: 24 }, // Hàng 5: Tiêu đề cột
  ];
  // Chiều cao cho các hàng học sinh
  for (let i = 0; i < classStudents.length; i++) {
    rowsConfig.push({ hpt: 20 });
  }
  rowsConfig.push({ hpt: 23 }); // Hàng tổng cộng (totalRowIdx)

  // Chiều cao các hàng phía dưới bảng (Ghi chú & Chữ ký)
  rowsConfig.push({ hpt: 8 });  // Hàng trống sau bảng
  rowsConfig.push({ hpt: 18 }); // Ghi chú 1
  if (showFinancials) {
    rowsConfig.push({ hpt: 18 }); // Ghi chú 2
  }
  rowsConfig.push({ hpt: 10 }); // Hàng trống trước ngày tháng
  rowsConfig.push({ hpt: 20 }); // Hàng ngày tháng
  rowsConfig.push({ hpt: 22 }); // Hàng tiêu đề chữ ký
  rowsConfig.push({ hpt: 18 }); // Hàng phụ đề ký
  rowsConfig.push({ hpt: 18 }); // Khoảng trống ký 1
  rowsConfig.push({ hpt: 18 }); // Khoảng trống ký 2
  rowsConfig.push({ hpt: 18 }); // Khoảng trống ký 3
  rowsConfig.push({ hpt: 20 }); // Hàng tên giáo viên
  ws['!rows'] = rowsConfig;

  // Thiết lập MERGE các ô
  const merges: any[] = [
    // Hàng 0: Tên trung tâm
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.min(8, lastColIdx) } },
    // Hàng 1: Tiêu đề bảng
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIdx } },
    // Hàng 2: Thông tin lớp
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastColIdx } },
    // Hàng 4: Banner thông tin học sinh
    { s: { r: 4, c: 0 }, e: { r: 4, c: 2 } },
    // Hàng 4: Banner Tháng MM/YYYY
    { s: { r: 4, c: 3 }, e: { r: 4, c: 2 + totalDays } },
    // Hàng 4: Banner tổng kết (chỉ merge khi có từ 2 cột trở lên)
    ...(lastColIdx > 3 + totalDays
      ? [{ s: { r: 4, c: 3 + totalDays }, e: { r: 4, c: lastColIdx } }]
      : []),
    // Hàng tổng cộng: Merge TT + TÊN HỌC SINH
    { s: { r: totalRowIdx, c: 0 }, e: { r: totalRowIdx, c: 1 } },
    // Merge dòng ghi chú 1 qua toàn bộ chiều rộng bảng
    { s: { r: note1RowIdx, c: 0 }, e: { r: note1RowIdx, c: lastColIdx } },
    ...(note2RowIdx !== -1
      ? [{ s: { r: note2RowIdx, c: 0 }, e: { r: note2RowIdx, c: lastColIdx } }]
      : []),
    // Merge ngày tháng bên góc phải
    { s: { r: dateRowIdx, c: rightStartCol }, e: { r: dateRowIdx, c: rightEndCol } },
    // Merge 3 khối tiêu đề chức danh chữ ký
    { s: { r: signTitleRowIdx, c: leftStartCol }, e: { r: signTitleRowIdx, c: leftEndCol } },
    { s: { r: signTitleRowIdx, c: midStartCol }, e: { r: signTitleRowIdx, c: midEndCol } },
    { s: { r: signTitleRowIdx, c: rightStartCol }, e: { r: signTitleRowIdx, c: rightEndCol } },
    // Merge 3 khối phụ đề hướng dẫn ký
    { s: { r: signSubRowIdx, c: leftStartCol }, e: { r: signSubRowIdx, c: leftEndCol } },
    { s: { r: signSubRowIdx, c: midStartCol }, e: { r: signSubRowIdx, c: midEndCol } },
    { s: { r: signSubRowIdx, c: rightStartCol }, e: { r: signSubRowIdx, c: rightEndCol } },
    // Merge khối tên giáo viên (nếu có)
    ...(teacherFullName
      ? [{ s: { r: signNameRowIdx, c: midStartCol }, e: { r: signNameRowIdx, c: midEndCol } }]
      : []),
  ];
  ws['!merges'] = merges;

  // -------------------------------------------------------------------------
  // STYLE HÀNG 0: TÊN TRUNG TÂM
  // -------------------------------------------------------------------------
  const a1Ref = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (ws[a1Ref]) {
    ws[a1Ref].s = {
      font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: COLOR_BRAND } },
      alignment: { vertical: 'center', horizontal: 'left' },
    };
  }

  // -------------------------------------------------------------------------
  // STYLE HÀNG 1: TIÊU ĐỀ BẢNG ĐIỂM DANH
  // -------------------------------------------------------------------------
  const a2Ref = XLSX.utils.encode_cell({ r: 1, c: 0 });
  if (ws[a2Ref]) {
    ws[a2Ref].s = {
      font: { name: 'Calibri', sz: 15, bold: true, color: { rgb: COLOR_BRAND } },
      alignment: { vertical: 'center', horizontal: 'center' },
      fill: { fgColor: { rgb: 'F8FAFC' } },
    };
  }

  // -------------------------------------------------------------------------
  // STYLE HÀNG 2: THÔNG TIN LỚP HỌC (ĐÃ BỎ PHÒNG HỌC)
  // -------------------------------------------------------------------------
  const a3Ref = XLSX.utils.encode_cell({ r: 2, c: 0 });
  if (ws[a3Ref]) {
    ws[a3Ref].s = {
      font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: COLOR_TEXT_MUTED } },
      alignment: { vertical: 'center', horizontal: 'center' },
      fill: { fgColor: { rgb: 'F8FAFC' } },
    };
  }

  // -------------------------------------------------------------------------
  // STYLE HÀNG 4: THANH BANNER THÁNG & PHÂN VÙNG
  // -------------------------------------------------------------------------
  for (let c = 0; c < totalCols; c++) {
    const cRef = XLSX.utils.encode_cell({ r: 4, c });
    if (!ws[cRef]) ws[cRef] = { t: 's', v: '' };

    let alignH = 'center';
    if (c >= 3 && c <= 2 + totalDays) alignH = 'right';

    ws[cRef].s = {
      font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: COLOR_BRAND } },
      fill: { fgColor: { rgb: COLOR_SUBHEADER_BG } },
      border: headerBorder,
      alignment: { vertical: 'center', horizontal: alignH },
    };
  }

  // -------------------------------------------------------------------------
  // STYLE HÀNG 5: CÁC CỘT TIÊU ĐỀ BẢNG (TT, TÊN HS, SĐT PH, 1..31, Tổng buổi,...)
  // -------------------------------------------------------------------------
  for (let c = 0; c < totalCols; c++) {
    const cRef = XLSX.utils.encode_cell({ r: 5, c });
    if (!ws[cRef]) ws[cRef] = { t: 's', v: '' };

    let bgColor = COLOR_HEADER_BG;
    let textColor = COLOR_TEXT_MAIN;
    let alignH = 'center';

    if (c === 1) alignH = 'left';
    if (c === 3 + totalDays) {
      bgColor = 'E0F2FE'; // Nền xanh nhạt cột Tổng buổi
      textColor = '0369A1';
    } else if (showFinancials && c >= 3 + totalDays + 1) {
      bgColor = COLOR_MONEY_HEADER_BG; // Nền xanh lá cột Tiền
      textColor = COLOR_MONEY_TEXT;
      alignH = 'right';
    }

    ws[cRef].s = {
      font: { name: 'Calibri', sz: 9.5, bold: true, color: { rgb: textColor } },
      fill: { fgColor: { rgb: bgColor } },
      border: headerBorder,
      alignment: { vertical: 'center', horizontal: alignH, wrapText: true },
    };
  }

  // -------------------------------------------------------------------------
  // STYLE DỮ LIỆU CÁC HÀNG HỌC SINH (HÀNG 6 TRỞ ĐI)
  // -------------------------------------------------------------------------
  for (let sIdx = 0; sIdx < classStudents.length; sIdx++) {
    const r = startDataRowIdx + sIdx;

    for (let c = 0; c < totalCols; c++) {
      const cRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cRef]) ws[cRef] = { t: 's', v: '' };

      const cellVal = ws[cRef].v;
      let fontBold = false;
      let fontColor = COLOR_TEXT_MAIN;
      let bgColor = 'FFFFFF';
      let alignH = 'center';
      let numFormat: string | undefined = undefined;

      if (c === 0) {
        // TT
        fontBold = true;
        fontColor = COLOR_TEXT_MUTED;
      } else if (c === 1) {
        // Tên học sinh
        fontBold = true;
        alignH = 'left';
      } else if (c === 2) {
        // SĐT Phụ huynh (dạng chuỗi văn bản để giữ số 0 đầu)
        ws[cRef].t = 's';
        numFormat = '@';
        fontColor = COLOR_TEXT_MUTED;
      } else if (c >= 3 && c < 3 + totalDays) {
        // Điểm danh các ngày
        if (cellVal === 'X') {
          fontBold = true;
          fontColor = COLOR_PRESENT_TEXT;
          bgColor = COLOR_PRESENT_BG;
        } else if (cellVal === 'P') {
          fontBold = true;
          fontColor = COLOR_EXCUSED_TEXT;
          bgColor = COLOR_EXCUSED_BG;
        } else if (cellVal === 'K') {
          fontBold = true;
          fontColor = COLOR_UNEXCUSED_TEXT;
          bgColor = COLOR_UNEXCUSED_BG;
        }
      } else if (c === 3 + totalDays) {
        // Cột Tổng buổi
        fontBold = true;
        fontColor = COLOR_BLUE;
        bgColor = 'F0FDF4';
      } else if (showFinancials && c === 3 + totalDays + 1) {
        // Đơn giá
        alignH = 'right';
        numFormat = '#,##0';
        fontColor = COLOR_TEXT_MUTED;
      } else if (showFinancials && c === 3 + totalDays + 2) {
        // Tổng tiền
        fontBold = true;
        alignH = 'right';
        fontColor = COLOR_MONEY_TEXT;
        bgColor = COLOR_MONEY_BG;
        numFormat = '#,##0';
      }

      ws[cRef].s = {
        font: { name: 'Calibri', sz: 9.5, bold: fontBold, color: { rgb: fontColor } },
        fill: { fgColor: { rgb: bgColor } },
        border: thinBorder,
        alignment: { vertical: 'center', horizontal: alignH },
        ...(numFormat ? { numFmt: numFormat } : {}),
      };
    }
  }

  // -------------------------------------------------------------------------
  // STYLE HÀNG TỔNG CỘNG LỚP
  // -------------------------------------------------------------------------
  for (let c = 0; c < totalCols; c++) {
    const cRef = XLSX.utils.encode_cell({ r: totalRowIdx, c });
    if (!ws[cRef]) ws[cRef] = { t: 's', v: '' };

    let alignH = 'center';
    let textColor = COLOR_BRAND;
    let bgColor = COLOR_TOTAL_BG;
    let numFormat: string | undefined = undefined;

    if (c === 0 || c === 1) {
      alignH = 'left';
    } else if (c === 3 + totalDays) {
      bgColor = 'BAE6FD'; // Tổng buổi có mặt cả lớp
      textColor = '0369A1';
    } else if (showFinancials && c === lastColIdx) {
      bgColor = 'BBF7D0'; // Tổng học phí cả lớp
      textColor = '065F46';
      alignH = 'right';
      numFormat = '#,##0';
    }

    ws[cRef].s = {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: textColor } },
      fill: { fgColor: { rgb: bgColor } },
      border: totalBorder,
      alignment: { vertical: 'center', horizontal: alignH },
      ...(numFormat ? { numFmt: numFormat } : {}),
    };
  }

  // -------------------------------------------------------------------------
  // STYLE CHỮ KÝ & GHI CHÚ (ÁP DỤNG CHO CÁC KHỐI ĐÃ ĐƯỢC MERGE RỘNG)
  // -------------------------------------------------------------------------
  // Ghi chú 1
  const n1Ref = XLSX.utils.encode_cell({ r: note1RowIdx, c: 0 });
  if (ws[n1Ref]) {
    ws[n1Ref].s = {
      font: { name: 'Calibri', sz: 9.5, italic: true, color: { rgb: COLOR_TEXT_MUTED } },
      alignment: { vertical: 'center', horizontal: 'left' },
    };
  }

  // Ghi chú 2 (nếu có tài chính)
  if (note2RowIdx !== -1) {
    const n2Ref = XLSX.utils.encode_cell({ r: note2RowIdx, c: 0 });
    if (ws[n2Ref]) {
      ws[n2Ref].s = {
        font: { name: 'Calibri', sz: 9.5, italic: true, color: { rgb: COLOR_MONEY_TEXT } },
        alignment: { vertical: 'center', horizontal: 'left' },
      };
    }
  }

  // Ngày tháng (Góc phải)
  const dRef = XLSX.utils.encode_cell({ r: dateRowIdx, c: rightStartCol });
  if (ws[dRef]) {
    ws[dRef].s = {
      font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: COLOR_TEXT_MAIN } },
      alignment: { vertical: 'center', horizontal: 'center' },
    };
  }

  // Tiêu đề chức danh chữ ký (NGƯỜI LẬP BIỂU, GIÁO VIÊN PHỤ TRÁCH, ĐẠI DIỆN TRUNG TÂM)
  const signColPositions = [leftStartCol, midStartCol, rightStartCol];
  signColPositions.forEach((col) => {
    const cRef = XLSX.utils.encode_cell({ r: signTitleRowIdx, c: col });
    if (ws[cRef]) {
      ws[cRef].s = {
        font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: COLOR_BRAND } },
        alignment: { vertical: 'center', horizontal: 'center' },
      };
    }
  });

  // Phụ đề hướng dẫn ký ((Ký, ghi rõ họ tên), (Ký, đóng dấu))
  signColPositions.forEach((col) => {
    const cRef = XLSX.utils.encode_cell({ r: signSubRowIdx, c: col });
    if (ws[cRef]) {
      ws[cRef].s = {
        font: { name: 'Calibri', sz: 9.5, italic: true, color: { rgb: COLOR_TEXT_MUTED } },
        alignment: { vertical: 'center', horizontal: 'center' },
      };
    }
  });

  // Tên giáo viên phụ trách (dưới chữ ký)
  if (teacherFullName) {
    const nameRef = XLSX.utils.encode_cell({ r: signNameRowIdx, c: midStartCol });
    if (ws[nameRef]) {
      ws[nameRef].s = {
        font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: COLOR_TEXT_MAIN } },
        alignment: { vertical: 'center', horizontal: 'center' },
      };
    }
  }

  return ws;
}

/**
 * XUẤT TOÀN BỘ BẢNG ĐIỂM DANH CỦA TẤT CẢ CÁC LỚP TRÊN 1 FILE EXCEL
 * - Mỗi lớp trên 1 sheet riêng biệt
 * - Định dạng kẻ ô, viền bảng chuẩn theo hình ảnh
 * - Thay TÊN TRUNG TÂM bằng tên cơ sở đang xuất
 * - Đã BỎ tên phòng học và BỎ phần ký của phụ huynh
 * - Tối ưu in vừa khít 1 trang A4 nằm ngang
 */
export async function exportAllClassesAttendanceWorkbook({
  month,
  classes,
  teachers,
  students,
  attendanceRecords,
  pricesMap,
  showFinancials,
  includeOverviewSheet = true,
  centerName = 'TRUNG TÂM ĐÀO TẠO',
}: ExportMonthlyAttendanceOptions): Promise<{ filename: string; classSheetCount: number }> {
  const XLSX = getXLSX();
  const [yearStr, monthStr] = month.split('-');
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  // Helper tìm giáo viên của lớp
  const getTeacher = (cls: ClassItem) => {
    return (
      teachers.find(
        (t) =>
          (cls.teacherId && t.id === cls.teacherId) ||
          (cls.teacherName && (t.name === cls.teacherName || t.fullName === cls.teacherName)) ||
          (t.mainClassId && t.mainClassId === cls.id) ||
          (Array.isArray(t.assignedClassIds) && t.assignedClassIds.includes(cls.id))
      ) || {
        id: cls.teacherId || 'unknown',
        name: cls.teacherName || 'Chưa phân công',
        fullName: cls.teacherName || 'Chưa phân công',
        phone: cls.teacherPhone || '',
        subject: cls.subject || 'Toán học',
      }
    );
  };

  // Helper tìm học sinh của lớp
  const getClassStudents = (cls: ClassItem) => {
    return students.filter(
      (s) =>
        s &&
        (s.classId === cls.id ||
          s.className === cls.name ||
          (cls.classCode && s.classId === cls.classCode))
    );
  };

  // Helper tìm bản ghi điểm danh trong tháng của lớp
  const getClassMonthlyRecords = (cls: ClassItem) => {
    return attendanceRecords.filter((att) => {
      if (!att) return false;
      const isMatchClass =
        att.classId === cls.id ||
        (cls.classCode && att.classId === cls.classCode) ||
        (cls.name && att.className === cls.name);
      if (!isMatchClass) return false;
      const dateStr = att.date || att.sessionDate || '';
      return att.sessionMonth === month || dateStr.startsWith(month);
    });
  };

  // =========================================================================
  // SHEET 1: TỔNG HỢP TOÀN TRUNG TÂM (Tùy chọn) - ĐÃ BỎ PHÒNG HỌC
  // =========================================================================
  if (includeOverviewSheet) {
    const overviewSheetName = sanitizeSheetName('Tổng Hợp Trung Tâm', 0, usedNames);
    const ovRows: any[][] = [];

    // Hàng 0: Tên trung tâm
    ovRows.push([(centerName || 'TRUNG TÂM ĐÀO TẠO').trim().toUpperCase()]);
    // Hàng 1: Tiêu đề
    ovRows.push([`BÁO CÁO TỔNG HỢP ĐIỂM DANH & HỌC PHÍ TOÀN TRUNG TÂM - THÁNG ${monthStr}/${yearStr}`]);
    // Hàng 2: Thời gian xuất
    ovRows.push([
      `Thời gian xuất: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}   |   Tổng số lớp: ${classes.length} lớp`,
    ]);
    // Hàng 3: Trống
    ovRows.push([]);

    // Hàng 4: Headers (ĐÃ BỎ CỘT PHÒNG HỌC THEO YÊU CẦU)
    const ovHeaders = [
      'STT',
      'Tên Lớp Học',
      'Môn Học',
      'Giáo Viên Phụ Trách',
      'SĐT Giáo Viên',
      'Sĩ Số Học Sinh',
      'Buổi Đã Điểm Danh',
      'Tổng Lượt Có Mặt',
    ];
    if (showFinancials) {
      ovHeaders.push('Đơn Giá/Buổi (VNĐ)', 'Dự Thu Học Phí (VNĐ)');
    }
    ovRows.push(ovHeaders);

    let totalStudentsAll = 0;
    let totalRecordedAll = 0;
    let totalPresentAll = 0;
    let totalFeeAll = 0;

    const [yStr, mStr] = month.split('-');
    const totalDays = new Date(parseInt(yStr || '2026', 10), parseInt(mStr || '10', 10), 0).getDate();
    const daysInMonth = Array.from({ length: totalDays }, (_, i) => i + 1);

    classes.forEach((cls, idx) => {
      const teacher = getTeacher(cls);
      const classStudents = getClassStudents(cls);
      const monthlyRecords = getClassMonthlyRecords(cls);
      const pricePerSession = pricesMap[cls.id] !== undefined ? pricesMap[cls.id] : (cls.pricePerSession !== undefined ? Number(cls.pricePerSession) : 40000);

      let classPresentCount = 0;
      classStudents.forEach((st) => {
        daysInMonth.forEach((d) => {
          const dStr = d.toString().padStart(2, '0');
          const iso = `${month}-${dStr}`;
          const rec = monthlyRecords.find((r) => (r.date || r.sessionDate) === iso);
          const sRec = rec?.records?.find((r: any) => r.studentId === st.id || r.id === st.id);
          if (sRec?.status === 'present') {
            classPresentCount++;
          }
        });
      });

      const classTuition = classPresentCount * pricePerSession;
      totalStudentsAll += classStudents.length;
      totalRecordedAll += monthlyRecords.length;
      totalPresentAll += classPresentCount;
      totalFeeAll += classTuition;

      const rData: any[] = [
        idx + 1,
        cls.name,
        cls.subject || 'Toán học',
        teacher.fullName || teacher.name,
        teacher.phone || '',
        classStudents.length,
        monthlyRecords.length,
        classPresentCount,
      ];
      if (showFinancials) {
        rData.push(pricePerSession, classTuition);
      }
      ovRows.push(rData);
    });

    // Hàng tổng kết trung tâm
    const ovTotalRow: any[] = [
      `TỔNG CỘNG TOÀN TRUNG TÂM (${classes.length} Lớp)`,
      '',
      '',
      '',
      '',
      totalStudentsAll,
      totalRecordedAll,
      totalPresentAll,
    ];
    if (showFinancials) {
      ovTotalRow.push('—', totalFeeAll);
    }
    ovRows.push(ovTotalRow);

    const ovTotalRowIdx = ovRows.length - 1;
    const ovLastCol = ovHeaders.length - 1;

    // Khối chữ ký trang Tổng quan
    ovRows.push(new Array(ovHeaders.length).fill('')); // hàng trống
    ovRows.push(new Array(ovHeaders.length).fill('')); // hàng trống

    const ovDateRowIdx = ovRows.length;
    const ovRightColStart = Math.max(0, ovLastCol - 2);
    const ovDateRow = new Array(ovHeaders.length).fill('');
    ovDateRow[ovRightColStart] = '..., Ngày ..... tháng ..... năm 20...';
    ovRows.push(ovDateRow);

    const ovSignTitleRowIdx = ovRows.length;
    const ovMidColStart = Math.floor(ovHeaders.length / 2) - 1;
    const ovSignTitleRow = new Array(ovHeaders.length).fill('');
    ovSignTitleRow[0] = 'NGƯỜI LẬP BIỂU';
    ovSignTitleRow[ovMidColStart] = 'KẾ TOÁN / GIÁO VỤ';
    ovSignTitleRow[ovRightColStart] = 'ĐẠI DIỆN TRUNG TÂM';
    ovRows.push(ovSignTitleRow);

    const ovSignSubRowIdx = ovRows.length;
    const ovSignSubRow = new Array(ovHeaders.length).fill('');
    ovSignSubRow[0] = '(Ký, ghi rõ họ tên)';
    ovSignSubRow[ovMidColStart] = '(Ký, ghi rõ họ tên)';
    ovSignSubRow[ovRightColStart] = '(Ký, đóng dấu)';
    ovRows.push(ovSignSubRow);

    // 3 hàng trống chừa khoảng cách ký
    ovRows.push(new Array(ovHeaders.length).fill(''));
    ovRows.push(new Array(ovHeaders.length).fill(''));
    ovRows.push(new Array(ovHeaders.length).fill(''));

    const wsOverview = XLSX.utils.aoa_to_sheet(ovRows);
    wsOverview['!views'] = [{ showGridLines: true }];
    wsOverview['!margins'] = {
      left: 0.25,
      right: 0.25,
      top: 0.35,
      bottom: 0.35,
      header: 0.2,
      footer: 0.2,
    };

    const ovCols = [
      { wch: 6 },  // STT
      { wch: 22 }, // Tên Lớp
      { wch: 16 }, // Môn Học (Đã bỏ cột Phòng Học)
      { wch: 24 }, // GV
      { wch: 15 }, // SĐT GV
      { wch: 15 }, // Sĩ số
      { wch: 18 }, // Buổi
      { wch: 18 }, // Lượt
      ...(showFinancials ? [{ wch: 18 }, { wch: 22 }] : []),
    ];
    wsOverview['!cols'] = ovCols;

    // Chiều cao hàng Overview
    const ovRowsConfig: any[] = [
      { hpt: 22 }, // Tên trung tâm
      { hpt: 26 }, // Tiêu đề
      { hpt: 19 }, // Phụ đề
      { hpt: 8 },  // Khoảng cách
      { hpt: 24 }, // Header cột
    ];
    for (let i = 0; i < classes.length; i++) {
      ovRowsConfig.push({ hpt: 20 });
    }
    ovRowsConfig.push({ hpt: 23 }); // Tổng cộng
    ovRowsConfig.push({ hpt: 10 }); // Khoảng trống
    ovRowsConfig.push({ hpt: 10 }); // Khoảng trống
    ovRowsConfig.push({ hpt: 20 }); // Ngày tháng
    ovRowsConfig.push({ hpt: 22 }); // Tiêu đề chữ ký
    ovRowsConfig.push({ hpt: 18 }); // Phụ đề ký
    ovRowsConfig.push({ hpt: 20 });
    ovRowsConfig.push({ hpt: 20 });
    ovRowsConfig.push({ hpt: 20 });
    wsOverview['!rows'] = ovRowsConfig;

    wsOverview['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: Math.min(5, ovLastCol) } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: ovLastCol } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: ovLastCol } },
      { s: { r: ovTotalRowIdx, c: 0 }, e: { r: ovTotalRowIdx, c: 4 } },
      // Chữ ký Overview được merge rộng để không bị che khuất
      { s: { r: ovDateRowIdx, c: ovRightColStart }, e: { r: ovDateRowIdx, c: ovLastCol } },
      { s: { r: ovSignTitleRowIdx, c: 0 }, e: { r: ovSignTitleRowIdx, c: ovMidColStart - 1 } },
      { s: { r: ovSignTitleRowIdx, c: ovMidColStart }, e: { r: ovSignTitleRowIdx, c: ovRightColStart - 1 } },
      { s: { r: ovSignTitleRowIdx, c: ovRightColStart }, e: { r: ovSignTitleRowIdx, c: ovLastCol } },
      { s: { r: ovSignSubRowIdx, c: 0 }, e: { r: ovSignSubRowIdx, c: ovMidColStart - 1 } },
      { s: { r: ovSignSubRowIdx, c: ovMidColStart }, e: { r: ovSignSubRowIdx, c: ovRightColStart - 1 } },
      { s: { r: ovSignSubRowIdx, c: ovRightColStart }, e: { r: ovSignSubRowIdx, c: ovLastCol } },
    ];

    // Styles cho Overview Sheet
    const o0Ref = XLSX.utils.encode_cell({ r: 0, c: 0 });
    if (wsOverview[o0Ref]) {
      wsOverview[o0Ref].s = {
        font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: COLOR_BRAND } },
        alignment: { vertical: 'center', horizontal: 'left' },
      };
    }
    const o1Ref = XLSX.utils.encode_cell({ r: 1, c: 0 });
    if (wsOverview[o1Ref]) {
      wsOverview[o1Ref].s = {
        font: { name: 'Calibri', sz: 15, bold: true, color: { rgb: COLOR_BRAND } },
        alignment: { vertical: 'center', horizontal: 'center' },
        fill: { fgColor: { rgb: 'F8FAFC' } },
      };
    }
    const o2Ref = XLSX.utils.encode_cell({ r: 2, c: 0 });
    if (wsOverview[o2Ref]) {
      wsOverview[o2Ref].s = {
        font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: COLOR_TEXT_MUTED } },
        alignment: { vertical: 'center', horizontal: 'center' },
      };
    }
    // Headers
    for (let c = 0; c <= ovLastCol; c++) {
      const cRef = XLSX.utils.encode_cell({ r: 4, c });
      if (wsOverview[cRef]) {
        wsOverview[cRef].s = {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: COLOR_TEXT_MAIN } },
          fill: { fgColor: { rgb: COLOR_SUBHEADER_BG } },
          border: headerBorder,
          alignment: { vertical: 'center', horizontal: 'center' },
        };
      }
    }
    // Dữ liệu các lớp
    for (let idx = 0; idx < classes.length; idx++) {
      const r = 5 + idx;
      for (let c = 0; c <= ovLastCol; c++) {
        const cRef = XLSX.utils.encode_cell({ r, c });
        if (!wsOverview[cRef]) wsOverview[cRef] = { t: 's', v: '' };

        let alignH = 'center';
        let numFormat: string | undefined = undefined;
        let fontColor = COLOR_TEXT_MAIN;
        let fontBold = false;

        if (c === 1 || c === 3) {
          alignH = 'left';
          fontBold = true;
        } else if (c === 4) {
          wsOverview[cRef].t = 's';
          numFormat = '@';
        } else if (showFinancials && c === 8) {
          alignH = 'right';
          numFormat = '#,##0';
        } else if (showFinancials && c === 9) {
          alignH = 'right';
          fontBold = true;
          fontColor = COLOR_MONEY_TEXT;
          numFormat = '#,##0';
        }

        wsOverview[cRef].s = {
          font: { name: 'Calibri', sz: 10, bold: fontBold, color: { rgb: fontColor } },
          border: thinBorder,
          alignment: { vertical: 'center', horizontal: alignH },
          ...(numFormat ? { numFmt: numFormat } : {}),
        };
      }
    }
    // Hàng tổng kết
    for (let c = 0; c <= ovLastCol; c++) {
      const cRef = XLSX.utils.encode_cell({ r: ovTotalRowIdx, c });
      if (!wsOverview[cRef]) wsOverview[cRef] = { t: 's', v: '' };

      let alignH = 'center';
      let numFormat: string | undefined = undefined;
      let textColor = COLOR_BRAND;

      if (c === 0 || c === 1) {
        alignH = 'left';
      } else if (showFinancials && c === ovLastCol) {
        alignH = 'right';
        textColor = '065F46';
        numFormat = '#,##0';
      }

      wsOverview[cRef].s = {
        font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: textColor } },
        fill: { fgColor: { rgb: COLOR_TOTAL_BG } },
        border: totalBorder,
        alignment: { vertical: 'center', horizontal: alignH },
        ...(numFormat ? { numFmt: numFormat } : {}),
      };
    }

    // Styles chữ ký Overview
    const odRef = XLSX.utils.encode_cell({ r: ovDateRowIdx, c: ovRightColStart });
    if (wsOverview[odRef]) {
      wsOverview[odRef].s = {
        font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: COLOR_TEXT_MAIN } },
        alignment: { vertical: 'center', horizontal: 'center' },
      };
    }
    [0, ovMidColStart, ovRightColStart].forEach((col) => {
      const tRef = XLSX.utils.encode_cell({ r: ovSignTitleRowIdx, c: col });
      if (wsOverview[tRef]) {
        wsOverview[tRef].s = {
          font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: COLOR_BRAND } },
          alignment: { vertical: 'center', horizontal: 'center' },
        };
      }
      const sRef = XLSX.utils.encode_cell({ r: ovSignSubRowIdx, c: col });
      if (wsOverview[sRef]) {
        wsOverview[sRef].s = {
          font: { name: 'Calibri', sz: 9.5, italic: true, color: { rgb: COLOR_TEXT_MUTED } },
          alignment: { vertical: 'center', horizontal: 'center' },
        };
      }
    });

    XLSX.utils.book_append_sheet(workbook, wsOverview, overviewSheetName);
  }

  // =========================================================================
  // TỪNG LỚP TRÊN 1 SHEET RIÊNG BIỆT (MỖI LỚP 1 SHEET VỚI ĐỊNH DẠNG ĐẦY ĐỦ)
  // =========================================================================
  classes.forEach((cls, classIdx) => {
    const teacher = getTeacher(cls);
    const classStudents = getClassStudents(cls);
    const monthlyRecords = getClassMonthlyRecords(cls);
    const pricePerSession = pricesMap[cls.id] !== undefined ? pricesMap[cls.id] : (cls.pricePerSession !== undefined ? Number(cls.pricePerSession) : 40000);

    const wsClass = buildClassAttendanceWorksheet({
      cls,
      teacher,
      classStudents,
      monthlyRecords,
      pricePerSession,
      showFinancials,
      month,
      centerName,
    });

    // Cấu trúc tên Sheet dựa trên tên lớp
    const sheetName = sanitizeSheetName(cls.name || `Lớp ${classIdx + 1}`, classIdx + 1, usedNames);
    XLSX.utils.book_append_sheet(workbook, wsClass, sheetName);
  });

  const safeCenterPrefix = (centerName || 'TrungTam').replace(/\s+/g, '_').replace(/[\\/?*:[\]]/g, '');
  const filename = `DiemDanh_${safeCenterPrefix}_${classes.length}_Lop_Thang_${monthStr}_${yearStr}.xlsx`;
  await saveWorkbook(workbook, filename);

  return { filename, classSheetCount: classes.length };
}

/**
 * XUẤT BẢNG ĐIỂM DANH CỦA 1 LỚP DUY NHẤT (ĐỊNH DẠNG KẺ Ô, MÀU SẮC CHUẨN)
 * - Đã BỎ tên phòng học
 * - Đã BỎ phần ký của phụ huynh
 * - Tối ưu in vừa khít 1 trang A4 nằm ngang
 */
export async function exportSingleClassAttendanceWorkbook({
  month,
  cls,
  teacher,
  classStudents,
  monthlyRecords,
  pricePerSession,
  showFinancials,
  centerName = 'TRUNG TÂM ĐÀO TẠO',
}: ExportSingleClassOptions): Promise<string> {
  const XLSX = getXLSX();
  const [yearStr, monthStr] = month.split('-');
  const workbook = XLSX.utils.book_new();

  const effectivePrice = pricePerSession !== undefined ? pricePerSession : (cls.pricePerSession !== undefined ? Number(cls.pricePerSession) : 40000);

  const wsClass = buildClassAttendanceWorksheet({
    cls,
    teacher,
    classStudents,
    monthlyRecords,
    pricePerSession: effectivePrice,
    showFinancials,
    month,
    centerName,
  });

  const usedNames = new Set<string>();
  const sheetName = sanitizeSheetName(cls.name || 'Lop_Hoc', 0, usedNames);
  XLSX.utils.book_append_sheet(workbook, wsClass, sheetName);

  const safeClassName = (cls.name || 'Lop').replace(/\s+/g, '_').replace(/[\\/?*:[\]]/g, '');
  const filename = `DiemDanh_${safeClassName}_Thang_${monthStr}_${yearStr}.xlsx`;
  await saveWorkbook(workbook, filename);

  return filename;
}
