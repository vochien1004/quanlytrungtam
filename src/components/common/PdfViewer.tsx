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

// Cấu hình workerSrc an toàn không gây nghẽn luồng UI chính
if (typeof window !== 'undefined' && (pdfjsLib as any)?.GlobalWorkerOptions) {
  try {
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${(pdfjsLib as any).version || '4.0.0'}/build/pdf.worker.min.mjs`;
  } catch {}
}

// Bộ nhớ đệm nhị phân PDF trong phiên làm việc & localStorage (cho tệp PDF nhỏ) để hiển thị tức thì không cần fetch CORS
const memoryPdfCache = new Map<string, Uint8Array>();

export function cachePdfBinary(key: string | null | undefined, data: ArrayBuffer | Uint8Array | null | undefined): void {
  if (!key || !data || data.byteLength === 0) return;
  try {
    const cleanKey = key.trim();
    const copy =
      data instanceof ArrayBuffer
        ? new Uint8Array(data.slice(0))
        : new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    memoryPdfCache.set(cleanKey, copy);
  } catch {}
}

export function getCachedPdfBinary(key: string | null | undefined): Uint8Array | null {
  if (!key) return null;
  const cleanKey = key.trim();
  const hit = memoryPdfCache.get(cleanKey);
  if (hit && hit.byteLength > 0) {
    return new Uint8Array(hit.buffer.slice(hit.byteOffset, hit.byteOffset + hit.byteLength));
  }
  return null;
}

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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(initialScale);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [embeddedUrl, setEmbeddedUrl] = useState<string | null>(null);
  const [useGoogleViewer, setUseGoogleViewer] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  // 1. Tải tài liệu PDF bằng bản sao ArrayBuffer, bộ nhớ đệm hoặc nhúng trực tiếp an toàn không gây lỗi CORS fetch
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setPdfDoc(null);
    setEmbeddedUrl(null);
    setNumPages(0);
    setCurrentPage(1);

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

        // Ưu tiên 2: Kiểm tra bộ nhớ đệm phiên làm việc theo URL hoặc tên tệp
        if (!rawBytes || rawBytes.byteLength === 0) {
          rawBytes = getCachedPdfBinary(trimmedUrl) || getCachedPdfBinary(fileName);
        }

        // Ưu tiên 3: Giải mã trực tiếp nếu là chuỗi Data URL (data:application/pdf;base64,...) mà không gọi fetch
        if ((!rawBytes || rawBytes.byteLength === 0) && trimmedUrl.startsWith('data:')) {
          rawBytes = decodeDataUrlToBytes(trimmedUrl);
          if (rawBytes && fileName) {
            cachePdfBinary(fileName, rawBytes);
          }
        }

        // Ưu tiên 4: Nếu là Blob URL nội bộ (cùng origin)
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
          } catch {
            // Nếu Blob URL không đọc được qua fetch, dùng trình xem nhúng trực tiếp
            if (!isCancelled) {
              setEmbeddedUrl(trimmedUrl);
              setIsLoading(false);
            }
            return;
          }
        }

        // Ưu tiên 5: Nếu là đường dẫn HTTP/HTTPS (ví dụ Firebase Storage URL)
        if ((!rawBytes || rawBytes.byteLength === 0) && (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://'))) {
          const isSameOrigin = typeof window !== 'undefined' && trimmedUrl.startsWith(window.location.origin);
          if (isSameOrigin) {
            try {
              const response = await fetch(trimmedUrl);
              if (response.ok) {
                const arrayBuf = await response.arrayBuffer();
                if (arrayBuf.byteLength > 0) {
                  rawBytes = new Uint8Array(arrayBuf);
                }
              }
            } catch {}
          }

          // Với URL từ Firebase Storage hoặc tên miền ngoài: Không gọi window.fetch để tránh lỗi CORS Failed to fetch,
          // chuyển sang chế độ hiển thị PDF nhúng trực tiếp (Iframe / Google Docs Viewer)
          if (!rawBytes || rawBytes.byteLength === 0) {
            if (!isCancelled) {
              setEmbeddedUrl(trimmedUrl);
              setIsLoading(false);
            }
            return;
          }
        }

        // Nếu có dữ liệu nhị phân PDF -> kết xuất sắc nét bằng PDF.js lên Canvas
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

        // Trường hợp bài tập mẫu chưa có file nhị phân -> hiển thị trang đề bài A4 chuẩn
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

  // 2. Kết xuất trang hiện tại lên Canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || currentPage < 1) return;

    let isCancelled = false;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
        }

        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const currentScale = inlineMode ? scale * 1.0 : scale * 1.25;
        const viewport = page.getViewport({ scale: currentScale });

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = 'auto';
        canvas.style.maxWidth = scale > 1 ? 'none' : '100%';

        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && !isCancelled) {
          // Bỏ qua cảnh báo khi hủy render
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [pdfDoc, currentPage, scale, inlineMode]);

  const handlePrevPage = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const handleNextPage = () => setCurrentPage((p) => Math.min(p + 1, numPages));
  const handleZoomIn = () => setScale((s) => Math.min(s + 0.15, 2.2));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.15, 0.5));
  const handleResetZoom = () => setScale(initialScale);

  const resolvedIframeSrc = embeddedUrl
    ? useGoogleViewer && (embeddedUrl.startsWith('http://') || embeddedUrl.startsWith('https://'))
      ? `https://docs.google.com/viewer?url=${encodeURIComponent(embeddedUrl)}&embedded=true`
      : embeddedUrl
    : null;

  return (
    <div className={`flex flex-col w-full h-full bg-slate-200/80 rounded-2xl overflow-hidden border border-slate-300 ${className}`}>
      {/* THANH CÔNG CỤ ĐIỀU KHIỂN TRANG & THU PHÓNG */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white border-b border-slate-200 text-xs shrink-0 select-none shadow-2xs">
        {pdfDoc ? (
          <>
            {/* Phân trang Canvas PDF */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1 || isLoading}
                onClick={handlePrevPage}
                className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-35 transition-colors cursor-pointer"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4 text-slate-700" />
              </button>

              <span className="text-[11px] font-black text-slate-700 min-w-[78px] text-center whitespace-nowrap">
                Trang {numPages > 0 ? currentPage : 0} / {numPages}
              </span>

              <button
                type="button"
                disabled={currentPage >= numPages || isLoading}
                onClick={handleNextPage}
                className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-35 transition-colors cursor-pointer"
                title="Trang sau"
              >
                <ChevronRight className="w-4 h-4 text-slate-700" />
              </button>
            </div>

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
          </>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="text-[11px] font-bold text-slate-700 truncate max-w-[240px]" title={fileName}>
              {fileName}
            </span>
            {embeddedUrl && (embeddedUrl.startsWith('http://') || embeddedUrl.startsWith('https://')) && (
              <button
                type="button"
                onClick={() => setUseGoogleViewer((prev) => !prev)}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold border border-slate-200 transition-colors cursor-pointer"
                title="Chuyển đổi chế độ hiển thị PDF"
              >
                {useGoogleViewer ? 'Chế độ: Google Viewer' : 'Đổi chế độ xem'}
              </button>
            )}
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

      {/* KHUNG HIỂN THỊ TRANG TÀI LIỆU PDF */}
      <div className="flex-1 overflow-auto p-3 sm:p-5 flex items-start justify-center min-h-[380px]">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-10 text-slate-500 space-y-2.5 m-auto">
            <Loader2 className="w-7 h-7 text-[#0072B5] animate-spin" />
            <p className="text-xs font-bold text-slate-700">Đang tải trang xem trước PDF...</p>
          </div>
        )}

        {/* Chế độ 1: Kết xuất bằng PDF.js Canvas */}
        <div
          className={`flex flex-col items-center shadow-xl rounded-lg bg-white my-auto overflow-hidden ${
            isLoading || !pdfDoc ? 'hidden' : ''
          }`}
        >
          <canvas ref={canvasRef} className="block max-w-full h-auto" />
        </div>

        {/* Chế độ 2: Nhúng và render trực tiếp nội dung PDF ngay trên giao diện preview, có thanh cuộn xem các trang và nút tải về bên dưới */}
        {!isLoading && !pdfDoc && resolvedIframeSrc && (
          <div className="w-full h-full flex flex-col items-center space-y-4">
            <div className="w-full h-[700px] bg-white rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(resolvedIframeSrc)}&embedded=true`}
                title={fileName}
                className="w-full h-full border-0"
              />
            </div>
            {onDownload && (
              <div className="pt-1 pb-2">
                <button
                  type="button"
                  onClick={onDownload}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0072B5] hover:bg-[#0B486B] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Tệp PDF Xuống Máy</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Chế độ 3: Trang đề bài chuẩn A4 khi xem bài tập mẫu không kèm dữ liệu nhị phân */}
        {!isLoading && !pdfDoc && !resolvedIframeSrc && (
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

