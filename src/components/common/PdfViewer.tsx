import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  Loader2, 
  FileText,
  Printer
} from 'lucide-react';
import { getProxiedFileUrl } from '../../utils/fileProxy';

// Cấu hình workerSrc an toàn không gây nghẽn luồng UI chính
if (typeof window !== 'undefined' && (pdfjsLib as any)?.GlobalWorkerOptions) {
  try {
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${(pdfjsLib as any).version || '4.0.0'}/build/pdf.worker.min.mjs`;
  } catch {}
}

import { cachePdfBinary, getCachedPdfBinary } from '../../utils/pdfCache';
export { cachePdfBinary, getCachedPdfBinary };

const decodeDataUrlToBytes = (dataUrl: string): Uint8Array | null => {
  try {
    const base64Idx = dataUrl.indexOf('base64,');
    if (base64Idx === -1) return null;
    const b64 = dataUrl.slice(base64Idx + 7).replace(/\s/g, '');
    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes.byteLength > 0 ? bytes : null;
  } catch {
    return null;
  }
};

interface PdfViewerProps {
  fileUrl?: string | null;
  fileData?: ArrayBuffer | Uint8Array | null;
  fileName?: string;
  initialScale?: number;
  inlineMode?: boolean;
  className?: string;
  onDownload?: () => void;
  assignmentTitle?: string;
  subject?: string;
  classNameTitle?: string;
  teacherName?: string;
  dueDate?: string;
  assignmentContent?: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  fileUrl,
  fileData,
  fileName = 'Tai_lieu.pdf',
  initialScale = 1.0,
  inlineMode = false,
  className = '',
  onDownload,
  assignmentTitle,
  subject,
  classNameTitle,
  teacherName,
  dueDate,
  assignmentContent,
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(initialScale);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [embeddedUrl, setEmbeddedUrl] = useState<string | null>(null);
  const [useGoogleViewer, setUseGoogleViewer] = useState<boolean>(false);

  const pageCanvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});

  // 1. Tải tài liệu PDF bằng ArrayBuffer, bộ nhớ đệm, URL từ Firebase Storage hoặc PDF.js network loader
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setPdfDoc(null);
    setEmbeddedUrl(null);
    setNumPages(0);
    pageCanvasRefs.current = {};

    const loadPdf = async () => {
      try {
        let rawBytes: Uint8Array | null = null;
        const trimmedUrl = typeof fileUrl === 'string' ? fileUrl.trim() : '';

        // Ưu tiên 1: Dữ liệu nhị phân truyền trực tiếp qua props
        if (fileData && fileData.byteLength > 0) {
          if (fileData instanceof ArrayBuffer) {
            rawBytes = new Uint8Array(fileData.slice(0));
          } else {
            rawBytes = new Uint8Array(
              fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength)
            );
          }
          if (trimmedUrl) cachePdfBinary(trimmedUrl, rawBytes);
          if (fileName) cachePdfBinary(fileName, rawBytes);
        }

        // Ưu tiên 2: Kiểm tra bộ nhớ đệm phiên làm việc
        if (!rawBytes || rawBytes.byteLength === 0) {
          rawBytes = getCachedPdfBinary(trimmedUrl) || getCachedPdfBinary(fileName);
        }

        // Ưu tiên 3: Data URL
        if ((!rawBytes || rawBytes.byteLength === 0) && trimmedUrl.startsWith('data:')) {
          rawBytes = decodeDataUrlToBytes(trimmedUrl);
          if (rawBytes && fileName) {
            cachePdfBinary(fileName, rawBytes);
          }
        }

        // Ưu tiên 4: Blob URL
        if ((!rawBytes || rawBytes.byteLength === 0) && trimmedUrl.startsWith('blob:')) {
          try {
            const response = await fetch(trimmedUrl);
            if (response.ok) {
              const arrayBuf = await response.arrayBuffer();
              if (arrayBuf.byteLength > 0) {
                rawBytes = new Uint8Array(arrayBuf);
                if (fileName) cachePdfBinary(fileName, rawBytes);
              }
            }
          } catch {}
        }

        // Nếu có rawBytes -> Kết xuất bằng PDF.js với dữ liệu nhị phân
        if (rawBytes && rawBytes.byteLength > 0) {
          const loadingTask = pdfjsLib.getDocument({
            data: rawBytes,
            cMapPacked: true,
          });
          const doc = await loadingTask.promise;
          if (isCancelled) return;

          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setIsLoading(false);
          return;
        }

        // Ưu tiên 5: URL HTTP/HTTPS (ví dụ Firebase Storage URL) -> Sử dụng proxy /api/proxy-file để tránh lỗi CORS và ngăn Chrome bật hộp thoại Save As
        if ((!rawBytes || rawBytes.byteLength === 0) && (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://'))) {
          // 5.1 Thử nạp qua API proxy của hệ thống
          try {
            const proxyUrl = getProxiedFileUrl(trimmedUrl);
            const res = await fetch(proxyUrl);
            if (res.ok) {
              const buf = await res.arrayBuffer();
              if (buf.byteLength > 0) {
                rawBytes = new Uint8Array(buf);
                cachePdfBinary(trimmedUrl, rawBytes);
                if (fileName) cachePdfBinary(fileName, rawBytes);

                const loadingTask = pdfjsLib.getDocument({
                  data: rawBytes,
                  cMapPacked: true,
                });
                const doc = await loadingTask.promise;
                if (!isCancelled) {
                  setPdfDoc(doc);
                  setNumPages(doc.numPages);
                  setIsLoading(false);
                }
                return;
              }
            }
          } catch (proxyErr) {
            console.warn('Lỗi fetch PDF qua proxy:', proxyErr);
          }

          // 5.2 Thử fetch trực tiếp phòng khi URL hỗ trợ sẵn CORS
          try {
            const res = await fetch(trimmedUrl, { mode: 'cors' });
            if (res.ok) {
              const buf = await res.arrayBuffer();
              if (buf.byteLength > 0) {
                rawBytes = new Uint8Array(buf);
                cachePdfBinary(trimmedUrl, rawBytes);
                if (fileName) cachePdfBinary(fileName, rawBytes);

                const loadingTask = pdfjsLib.getDocument({
                  data: rawBytes,
                  cMapPacked: true,
                });
                const doc = await loadingTask.promise;
                if (!isCancelled) {
                  setPdfDoc(doc);
                  setNumPages(doc.numPages);
                  setIsLoading(false);
                }
                return;
              }
            }
          } catch {}

          // 5.3 Thử PDF.js URL loader qua proxy hoặc url gốc
          try {
            const loadingTask = pdfjsLib.getDocument({
              url: getProxiedFileUrl(trimmedUrl),
              cMapPacked: true,
            });
            const doc = await loadingTask.promise;
            if (!isCancelled) {
              setPdfDoc(doc);
              setNumPages(doc.numPages);
              setIsLoading(false);
            }
            return;
          } catch (urlErr) {
            console.warn('PDF.js URL loader fallback:', urlErr);
          }

          if (!isCancelled) {
            setIsLoading(false);
          }
          return;
        }

        if (!isCancelled) {
          setIsLoading(false);
        }
      } catch {
        if (isCancelled) return;
        const trimmedUrl = typeof fileUrl === 'string' ? fileUrl.trim() : '';
        if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('blob:')) {
          setEmbeddedUrl(trimmedUrl);
        }
        setIsLoading(false);
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [fileUrl, fileData, fileName]);

  // 2. Kết xuất TẤT CẢ CÁC TRANG của tài liệu PDF lần lượt lên các canvas dọc liên tục
  useEffect(() => {
    if (!pdfDoc || numPages < 1) return;

    let isCancelled = false;

    const renderAllPages = async () => {
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (isCancelled) break;
        try {
          const page = await pdfDoc.getPage(pageNum);
          if (isCancelled) break;

          const canvas = pageCanvasRefs.current[pageNum];
          if (!canvas) continue;

          const context = canvas.getContext('2d');
          if (!context) continue;

          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const currentScale = inlineMode ? scale * 1.0 : scale * 1.25;
          const viewport = page.getViewport({ scale: currentScale });

          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;

          context.setTransform(dpr, 0, 0, dpr, 0, 0);

          const renderContext = {
            canvasContext: context,
            viewport: viewport,
            canvas: canvas,
          } as any;

          await page.render(renderContext).promise;
        } catch (err: any) {
          if (err?.name !== 'RenderingCancelledException' && !isCancelled) {
            console.warn(`Lỗi render trang PDF ${pageNum}:`, err);
          }
        }
      }
    };

    renderAllPages();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, numPages, scale, inlineMode]);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.15, 2.2));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.15, 0.5));
  const handleResetZoom = () => setScale(initialScale);

  // Iframe Google Docs viewer đã được loại bỏ hoàn toàn để tránh trình duyệt ép tải file "viewer" về máy

  return (
    <div className={`flex flex-col w-full h-full bg-slate-200/80 rounded-2xl overflow-hidden border border-slate-300 ${className}`}>
      {/* THANH CÔNG CỤ ĐIỀU KHIỂN & THU PHÓNG */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white border-b border-slate-200 text-xs shrink-0 select-none shadow-2xs">
        {pdfDoc ? (
          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-[#0B486B] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              📄 Tổng số trang: {numPages} trang (Xem tất cả)
            </span>
            {/* Nút thu phóng */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={isLoading}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-35 transition-colors cursor-pointer"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-bold text-slate-600 min-w-[38px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={isLoading}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-35 transition-colors cursor-pointer"
                title="Phóng to"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                disabled={isLoading}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 disabled:opacity-35 transition-colors cursor-pointer"
                title="Đặt lại kích thước 100%"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="text-[11px] font-bold text-slate-700 truncate max-w-[240px]" title={fileName}>
              {fileName}
            </span>
          </div>
        )}

        {/* Nút In & Tải PDF */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition-all shadow-2xs cursor-pointer"
            title="In tài liệu"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">In</span>
          </button>

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0072B5] hover:bg-[#0B486B] text-white text-[11px] font-bold transition-all shadow-2xs cursor-pointer"
              title="Tải tệp PDF xuống"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tải PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* KHUNG HIỂN THỊ TẤT CẢ CÁC TRANG PDF DỌC LIÊN TỤC */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 flex flex-col items-center space-y-6 min-h-[420px] bg-slate-200/90">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-10 text-slate-500 space-y-2.5 m-auto">
            <Loader2 className="w-7 h-7 text-[#0072B5] animate-spin" />
            <p className="text-xs font-bold text-slate-700">Đang tải toàn bộ các trang tài liệu PDF...</p>
          </div>
        )}

        {/* Render tất cả các trang PDF (1 đến numPages) theo thứ tự */}
        {!isLoading && pdfDoc && numPages > 0 && (
          <div className="flex flex-col items-center space-y-6 w-full max-w-4xl mx-auto">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                className="flex flex-col items-center shadow-xl rounded-xl bg-white overflow-hidden border border-slate-300 w-full relative group"
              >
                {/* Header nhãn số trang */}
                <div className="w-full bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex items-center justify-between text-[11px] font-extrabold text-slate-500">
                  <span>Trang {pageNum} / {numPages}</span>
                  <span className="text-[#0072B5] font-bold">{fileName}</span>
                </div>
                <div className="p-3 bg-white flex justify-center w-full overflow-x-auto">
                  <canvas
                    ref={(el) => {
                      pageCanvasRefs.current[pageNum] = el;
                    }}
                    className="block max-w-full h-auto shadow-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Trang thông tin & đề bài khi chưa/không kết xuất được trang PDF */}
        {!isLoading && (!pdfDoc || numPages === 0) && (
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-300 p-6 sm:p-10 my-auto space-y-5 text-slate-800">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4 gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                  <FileText className="w-3.5 h-3.5" />
                  Tài liệu PDF: {fileName}
                </span>
                <h4 className="text-base sm:text-lg font-extrabold text-[#0B486B] pt-1">
                  {assignmentTitle || fileName.replace(/\.pdf$/i, '')}
                </h4>
                {(classNameTitle || teacherName || subject) && (
                  <p className="text-xs text-slate-500 font-medium">
                    {subject ? `Môn: ${subject} • ` : ''}
                    {classNameTitle ? `Lớp: ${classNameTitle} • ` : ''}
                    {teacherName ? `Giáo viên: ${teacherName}` : ''}
                    {dueDate ? ` • Hạn nộp: ${dueDate}` : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-slate-800 min-h-[180px]">
              {assignmentContent ||
                'Tài liệu bài tập định dạng PDF đã được đính kèm trên hệ thống. Quý phụ huynh và học sinh có thể xem nội dung hướng dẫn tại đây hoặc nhấn nút Tải PDF ở góc trên bên phải.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

