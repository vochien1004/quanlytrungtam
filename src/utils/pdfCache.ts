/**
 * Cache nhị phân PDF độc lập - Không import pdfjs-dist để tránh làm phình bundle lúc khởi động ứng dụng
 */

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
