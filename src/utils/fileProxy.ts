/**
 * Tiện ích chuyển đổi URL tệp để xem trực tiếp trên trình duyệt,
 * giải quyết triệt để lỗi CORS từ Firebase Storage và lỗi bị trình duyệt bắt tải file về (Save As).
 */
export function getProxiedFileUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Dữ liệu dạng Data URI (base64) hoặc Blob URL cục bộ
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Nếu là URL HTTP / HTTPS ngoài (ví dụ Firebase Storage)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // Nếu đã được chuyển qua proxy thì không lặp lại
    if (trimmed.includes('/api/proxy-file')) {
      return trimmed;
    }
    return `/api/proxy-file?url=${encodeURIComponent(trimmed)}`;
  }

  return trimmed;
}
