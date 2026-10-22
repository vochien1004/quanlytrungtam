import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  FileText, 
  FileCode, 
  File, 
  Image as ImageIcon,
  Loader2,
  Table as TableIcon,
  Layers
} from 'lucide-react';
import { getProxiedFileUrl } from '../../utils/fileProxy';

const PdfViewer = React.lazy(() => import('./PdfViewer').then((m) => ({ default: m.PdfViewer })));

export interface DocumentPreviewData {
  fileName: string;
  fileUrl?: string | null;
  fileData?: ArrayBuffer | Uint8Array | null;
  fileType?: 'pdf' | 'word' | 'image' | 'excel' | 'other';
  htmlContent?: string | null;
  assignmentTitle?: string;
  subject?: string;
  className?: string;
  teacherName?: string;
  dueDate?: string;
  assignmentContent?: string;
}

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentPreviewData | null;
}

interface ExcelSheetData {
  name: string;
  html: string;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  document,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [fallbackBlobUrl, setFallbackBlobUrl] = useState<string | null>(null);

  // Parsed states for Excel & Word
  const [isLoadingParsed, setIsLoadingParsed] = useState<boolean>(false);
  const [excelSheets, setExcelSheets] = useState<ExcelSheetData[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [parsedWordHtml, setParsedWordHtml] = useState<string | null>(null);

  const fileName = document?.fileName || 'Tai_lieu';
  const fileUrl = document?.fileUrl || null;
  const fileData = document?.fileData || null;
  const fileType = document?.fileType || 'other';
  const htmlContent = document?.htmlContent || null;
  const assignmentTitle = document?.assignmentTitle;
  const className = document?.className || 'Lớp học';
  const teacherName = document?.teacherName || 'Giáo viên';
  const assignmentContent = document?.assignmentContent;

  // Xác định định dạng tệp thực tế
  const isPdf = fileType === 'pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isExcel = 
    fileType === 'excel' || 
    /\.(xlsx|xls|csv|ods)$/i.test(fileName);
  const isWord = 
    fileType === 'word' || 
    /\.(docx|doc)$/i.test(fileName);
  const isImage =
    fileType === 'image' ||
    /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(fileName) ||
    Boolean(fileUrl && fileUrl.startsWith('data:image/'));

  // Reset zoom & state mỗi khi mở tài liệu mới
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(100);
      setRotation(0);
      setExcelSheets([]);
      setActiveSheetIndex(0);
      setParsedWordHtml(null);
    }
  }, [isOpen, fileName, fileUrl]);

  // Parse Excel hoặc Word tự động khi mở
  useEffect(() => {
    if (!isOpen || !document) return;

    let isCancelled = false;

    const loadAndParseDocument = async () => {
      setIsLoadingParsed(true);
      try {
        let arrayBuffer: ArrayBuffer | null = null;

        // 1. Lấy ArrayBuffer từ fileData hoặc fileUrl
        if (fileData) {
          if (fileData instanceof ArrayBuffer) {
            arrayBuffer = fileData;
          } else if (fileData instanceof Uint8Array) {
            arrayBuffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength) as ArrayBuffer;
          }
        } else if (fileUrl) {
          try {
            const proxyUrl = getProxiedFileUrl(fileUrl);
            const res = await fetch(proxyUrl);
            if (res.ok) {
              const ab = await res.arrayBuffer();
              arrayBuffer = ab instanceof ArrayBuffer ? ab : (new Uint8Array(ab).buffer as ArrayBuffer);
            }
          } catch (fetchErr) {
            try {
              const directRes = await fetch(fileUrl, { mode: 'cors' });
              if (directRes.ok) {
                const ab = await directRes.arrayBuffer();
                arrayBuffer = ab instanceof ArrayBuffer ? ab : (new Uint8Array(ab).buffer as ArrayBuffer);
              }
            } catch (directErr) {
              console.warn('Không thể nạp tệp trực tiếp:', directErr);
            }
          }
        }

        if (isCancelled) return;

        // 2. Phân tích Excel (.xlsx, .xls, .csv)
        if (isExcel && arrayBuffer) {
          try {
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheets: ExcelSheetData[] = workbook.SheetNames.map((sheetName) => {
              const worksheet = workbook.Sheets[sheetName];
              // Chuyển sheet sang HTML table
              const rawHtml = XLSX.utils.sheet_to_html(worksheet, { id: `sheet-${sheetName}`, editable: false });
              return {
                name: sheetName,
                html: rawHtml,
              };
            });
            if (!isCancelled) {
              setExcelSheets(sheets);
              setActiveSheetIndex(0);
            }
          } catch (excelErr) {
            console.warn('Lỗi parse file Excel:', excelErr);
          }
        }

        // 3. Phân tích Word (.docx)
        if (isWord && arrayBuffer) {
          try {
            const mammothModule = await import('mammoth');
            const mammothInstance = (mammothModule as any).default || mammothModule;
            const result = await mammothInstance.convertToHtml({ arrayBuffer: arrayBuffer.slice(0) });
            if (!isCancelled && result.value) {
              setParsedWordHtml(result.value);
            }
          } catch (wordErr) {
            console.warn('Lỗi parse file Word:', wordErr);
          }
        }

      } catch (err) {
        console.warn('Lỗi phân tích tài liệu:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingParsed(false);
        }
      }
    };

    loadAndParseDocument();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, document, fileUrl, fileData, isExcel, isWord]);

  // Tự động tạo Blob URL dự phòng từ fileData nếu là ảnh chụp
  useEffect(() => {
    if (!isOpen || !isImage) {
      setFallbackBlobUrl(null);
      return;
    }
    if (!fileUrl && fileData && fileData.byteLength > 0) {
      const ext = fileName.split('.').pop()?.toLowerCase();
      const mimeType =
        ext === 'png'
          ? 'image/png'
          : ext === 'webp'
          ? 'image/webp'
          : ext === 'gif'
          ? 'image/gif'
          : 'image/jpeg';
      const bufferSlice =
        fileData instanceof Uint8Array ? fileData.slice() : fileData.slice(0);
      const blob = new Blob([bufferSlice as any], { type: mimeType });
      const createdUrl = URL.createObjectURL(blob);
      setFallbackBlobUrl(createdUrl);
      return () => {
        URL.revokeObjectURL(createdUrl);
      };
    } else {
      setFallbackBlobUrl(null);
    }
  }, [isOpen, isImage, fileUrl, fileData, fileName]);

  if (!isOpen || !document) return null;

  const resolvedImageUrl = (fileUrl ? getProxiedFileUrl(fileUrl) : null) || fallbackBlobUrl;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 20, 240));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 20, 50));
  const handleResetZoom = () => {
    setZoomLevel(100);
    setRotation(0);
  };
  const handleRotateImage = () => setRotation((prev) => (prev + 90) % 360);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const downloadUrl = resolvedImageUrl || fileUrl;
    if (downloadUrl) {
      const link = window.document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    } else if (fileData && fileData.byteLength > 0) {
      const blob = new Blob([fileData as any]);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = fileName;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } else if (htmlContent) {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = fileName.endsWith('.html') ? fileName : `${fileName}.html`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-2 sm:p-4 animate-fade-in overflow-hidden">
      <div className="flex flex-col w-full max-w-5xl h-[92vh] bg-slate-100 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* MODAL TOP TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-2xl shrink-0 ${
              isPdf ? 'bg-rose-50 text-rose-600 border border-rose-200' :
              isExcel ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
              isWord ? 'bg-blue-50 text-[#0072B5] border border-blue-200' :
              isImage ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
              'bg-slate-100 text-slate-700 border border-slate-200'
            }`}>
              {isPdf ? <FileText className="w-5 h-5 text-rose-600" /> :
               isExcel ? <TableIcon className="w-5 h-5 text-emerald-700" /> :
               isWord ? <FileCode className="w-5 h-5 text-[#0072B5]" /> :
               isImage ? <ImageIcon className="w-5 h-5 text-emerald-600" /> :
               <File className="w-5 h-5" />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900 truncate" title={fileName}>
                  {fileName}
                </h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 ${
                  isPdf ? 'bg-rose-100 text-rose-800' :
                  isExcel ? 'bg-emerald-100 text-emerald-800' :
                  isWord ? 'bg-blue-100 text-blue-800' :
                  isImage ? 'bg-emerald-100 text-emerald-800' :
                  'bg-slate-200 text-slate-700'
                }`}>
                  {isPdf ? 'PDF Document' : isExcel ? 'Excel Spreadsheet' : isWord ? 'Word (.docx)' : isImage ? 'Ảnh chụp bài tập' : 'Document'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {assignmentTitle ? `Bài tập: ${assignmentTitle} • ` : ''} Lớp: {className} • GV: {teacherName}
              </p>
            </div>
          </div>

          {/* Controls: Zoom, Rotate, Print, Download, Close */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {(isWord || isImage || isExcel) && (
              <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200 text-xs mr-1">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-[11px] font-black text-slate-700 min-w-[44px] text-center">
                  {zoomLevel}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Phóng to"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                {isImage && (
                  <button
                    type="button"
                    onClick={handleRotateImage}
                    className="p-1.5 rounded-lg hover:bg-white text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer border-l border-slate-200 ml-0.5 pl-2 flex items-center gap-1 font-bold text-[11px]"
                    title="Xoay ảnh 90 độ"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Xoay ảnh</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="p-1.5 rounded-lg hover:bg-white text-slate-500 hover:text-slate-800 transition-colors cursor-pointer text-[10px] font-bold px-2"
                  title="Đặt lại mặc định (100%)"
                >
                  100%
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="In tài liệu"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden md:inline">In File</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="Tải tệp xuống máy"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Về</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer ml-1"
              title="Đóng xem trước"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL MAIN PREVIEW CANVAS */}
        <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-200/70 flex justify-center items-start">
          {/* 1. PDF VIEWER */}
          {isPdf && (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <React.Suspense
                fallback={
                  <div className="min-h-[500px] w-full flex flex-col items-center justify-center text-slate-500 text-xs font-semibold gap-2.5">
                    <Loader2 className="w-7 h-7 animate-spin text-[#0072B5]" />
                    <span>Đang tải trình đọc tài liệu PDF...</span>
                  </div>
                }
              >
                <PdfViewer
                  fileUrl={fileUrl}
                  fileData={fileData}
                  fileName={fileName}
                  onDownload={handleDownload}
                  assignmentTitle={assignmentTitle}
                  subject={document?.subject}
                  classNameTitle={className}
                  teacherName={teacherName}
                  dueDate={document?.dueDate}
                  assignmentContent={assignmentContent}
                  className="min-h-[620px] shadow-xl w-full"
                />
              </React.Suspense>
            </div>
          )}

          {/* 2. EXCEL SPREADSHEET VIEWER (.XLSX, .XLS, .CSV) */}
          {isExcel && (
            <div className="w-full flex flex-col items-center transition-transform duration-200">
              <div 
                className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl p-4 sm:p-8 border border-slate-300 min-h-[680px] text-slate-900 font-sans space-y-4"
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
              >
                <div className="border-b border-slate-200 pb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-[#0B486B]">{assignmentTitle || fileName}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Lớp: {className} • Giáo viên: {teacherName} {document?.dueDate ? `• Hạn nộp: ${document.dueDate}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-[11px] font-bold px-3 py-1.5 rounded-xl border border-emerald-200">
                    <TableIcon className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Excel Viewer Trực Tiếp</span>
                  </div>
                </div>

                {assignmentContent && (
                  <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 text-xs text-slate-800 space-y-1">
                    <h4 className="font-bold text-[#0B486B] flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#0072B5]" />
                      <span>Hướng dẫn / Dặn dò:</span>
                    </h4>
                    <p className="whitespace-pre-wrap leading-relaxed">{assignmentContent}</p>
                  </div>
                )}

                {isLoadingParsed ? (
                  <div className="min-h-[450px] w-full flex flex-col items-center justify-center text-slate-500 text-xs font-semibold gap-2.5">
                    <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
                    <span>Đang phân tích bảng dữ liệu Excel...</span>
                  </div>
                ) : excelSheets.length > 0 ? (
                  <div className="space-y-4 pt-2">
                    {/* Sheet Selection Tabs */}
                    {excelSheets.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
                        <Layers className="w-4 h-4 text-slate-500 shrink-0 ml-1" />
                        {excelSheets.map((sheet, idx) => (
                          <button
                            key={sheet.name}
                            type="button"
                            onClick={() => setActiveSheetIndex(idx)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                              activeSheetIndex === idx
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {sheet.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Active Sheet Table */}
                    <div className="w-full overflow-x-auto max-h-[580px] rounded-xl border border-slate-200 bg-white p-2">
                      <div 
                        className="excel-preview-table-container text-xs text-slate-800"
                        dangerouslySetInnerHTML={{ __html: excelSheets[activeSheetIndex]?.html || '' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center space-y-4 pt-4">
                    <p className="text-xs text-slate-500">Không thể phân tích nội dung bảng tính trực tiếp từ tệp này.</p>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0072B5] hover:bg-[#0B486B] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Tải Tệp Về Máy</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. WORD DOCUMENT VIEWER (.DOCX) */}
          {isWord && (
            <div
              className="w-full flex justify-center transition-transform duration-200 overflow-y-auto"
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            >
              <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-6 sm:p-12 border border-slate-300 min-h-[680px] text-slate-900 font-sans space-y-6">
                <div className="border-b border-slate-200 pb-4">
                  <h2 className="text-lg sm:text-xl font-extrabold text-[#0B486B]">{assignmentTitle || fileName}</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Lớp: {className} • Giáo viên: {teacherName} {document?.dueDate ? `• Hạn nộp: ${document.dueDate}` : ''}
                  </p>
                </div>

                {assignmentContent && (
                  <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 text-xs sm:text-sm text-slate-800 space-y-2">
                    <h4 className="font-bold text-[#0B486B] flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#0072B5]" />
                      <span>Nội dung bài tập &amp; Dặn dò của giáo viên:</span>
                    </h4>
                    <p className="whitespace-pre-wrap leading-relaxed">{assignmentContent}</p>
                  </div>
                )}

                {isLoadingParsed ? (
                  <div className="min-h-[350px] w-full flex flex-col items-center justify-center text-slate-500 text-xs font-semibold gap-2.5">
                    <Loader2 className="w-7 h-7 animate-spin text-[#0072B5]" />
                    <span>Đang đọc tài liệu Word (.docx)...</span>
                  </div>
                ) : parsedWordHtml ? (
                  <div 
                    className="prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed text-slate-800 space-y-4 word-preview-content pt-2"
                    dangerouslySetInnerHTML={{ __html: parsedWordHtml }}
                  />
                ) : htmlContent ? (
                  <div 
                    className="prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed text-slate-800 space-y-4 word-preview-content pt-2"
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                  />
                ) : (
                  <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">Không có nội dung văn bản hiển thị cho tệp này.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. IMAGE VIEWER (ẢNH CHỤP BÀI TẬP) */}
          {isImage && (
            <div className="w-full min-h-full flex flex-col justify-center items-center py-4">
              {resolvedImageUrl ? (
                <div className="flex flex-col items-center gap-4 max-w-full">
                  <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-2xl border border-slate-300 overflow-auto max-w-full flex items-center justify-center">
                    <img
                      src={resolvedImageUrl}
                      alt={fileName}
                      className="max-w-full max-h-[72vh] object-contain rounded-xl transition-transform duration-200"
                      style={{
                        transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                        transformOrigin: 'center center',
                      }}
                    />
                  </div>
                  {assignmentContent && (
                    <div className="w-full max-w-2xl bg-white/95 backdrop-blur-xs p-3.5 rounded-xl border border-slate-200 shadow-xs text-xs text-slate-700">
                      <span className="font-extrabold text-[#0B486B] block mb-1">Hướng dẫn &amp; dặn dò đính kèm:</span>
                      <p className="whitespace-pre-wrap leading-relaxed">{assignmentContent}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 text-center space-y-2">
                  <ImageIcon className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-800">{fileName}</p>
                  <p className="text-[11px] text-slate-500">Không tìm thấy dữ liệu ảnh chụp để hiển thị.</p>
                </div>
              )}
            </div>
          )}

          {/* 5. OTHER DOCUMENT TYPES */}
          {!isPdf && !isExcel && !isWord && !isImage && (
            <div className="w-full h-full flex flex-col items-center justify-center space-y-4 p-2">
              <div className="w-full max-w-lg bg-white p-8 rounded-2xl shadow-xl border border-slate-300 text-center space-y-4 my-auto">
                <FileText className="w-16 h-16 text-[#0072B5] mx-auto" />
                <h3 className="font-extrabold text-sm text-slate-900">{fileName}</h3>
                <p className="text-xs text-slate-500">
                  Tệp tin đính kèm cho bài tập &ldquo;{assignmentTitle || 'Bài tập về nhà'}&rdquo;.
                </p>
                {assignmentContent && (
                  <div className="text-left p-3.5 bg-slate-50 rounded-xl text-xs text-slate-700 whitespace-pre-wrap border border-slate-200">
                    {assignmentContent}
                  </div>
                )}
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải File Về Máy</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
