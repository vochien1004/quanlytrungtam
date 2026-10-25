import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // Proxy endpoint to bypass CORS for remote storage files (e.g. Firebase Storage)
  // Ensures inline preview without triggering browser "Save As" download dialogs
  app.get('/api/proxy-file', async (req, res) => {
    // 1. Lấy URL gốc (Express query parser đã giải mã một lần, TUYỆT ĐỐI không gọi decodeURIComponent thêm một lần nữa
    // để tránh làm hỏng các ký tự %2F phân tách thư mục trong object path của Firebase Storage)
    let targetUrl = req.query.url as string;

    // Dự phòng nếu query url bị cắt hoặc thiếu do format
    if (!targetUrl && req.originalUrl.includes('?url=')) {
      targetUrl = req.originalUrl.substring(req.originalUrl.indexOf('?url=') + 5);
    }

    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    // 2. Chuẩn hóa an toàn cho Firebase Storage:
    // Firebase Storage REST API bắt buộc phần object path sau /o/ phải dùng %2F (không được là dấu gạch chéo '/')
    if (targetUrl.includes('firebasestorage.googleapis.com') || targetUrl.includes('.firebasestorage.app')) {
      const oIndex = targetUrl.indexOf('/o/');
      if (oIndex !== -1) {
        const qIndex = targetUrl.indexOf('?', oIndex);
        const prefix = targetUrl.substring(0, oIndex + 3);
        const rawObjectPath = qIndex !== -1 ? targetUrl.substring(oIndex + 3, qIndex) : targetUrl.substring(oIndex + 3);
        const suffix = qIndex !== -1 ? targetUrl.substring(qIndex) : '';

        // Đảm bảo mọi slash '/' trong object path đều được encode chuẩn thành %2F
        const encodedPath = rawObjectPath
          .split('/')
          .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
          .join('%2F');

        targetUrl = `${prefix}${encodedPath}${suffix}`;
      }
    }

    try {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        console.warn(`[Proxy] Remote fetch error ${response.status} ${response.statusText} for URL: ${targetUrl}`);
        return res.status(response.status).json({
          error: `Failed to fetch remote file: ${response.statusText}`,
        });
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error('Error in /api/proxy-file:', err);
      res.status(500).json({ error: err.message || 'Internal proxy error' });
    }
  });

  // Proxy endpoint to check real-time PayOS payment status directly via paymentLinkId
  // Bypasses browser CORS and Firestore root collection rules so the modal & student status update immediately upon payment
  const handlePayOSCheckStatus = async (req: express.Request, res: express.Response) => {
    try {
      let paymentLinkId = String(
        req.body?.paymentLinkId || req.params?.paymentLinkId || req.query?.paymentLinkId || ''
      ).trim();
      const checkoutUrl = String(req.body?.checkoutUrl || req.query?.checkoutUrl || '').trim();

      if (!paymentLinkId && checkoutUrl) {
        const match = checkoutUrl.match(/\/web\/([a-zA-Z0-9]+)/i);
        if (match && match[1]) {
          paymentLinkId = match[1];
        }
      }

      if (!paymentLinkId || !/^[a-zA-Z0-9_-]+$/.test(paymentLinkId)) {
        return res.status(400).json({ code: '400', desc: 'Missing or invalid paymentLinkId' });
      }

      const payosRes = await fetch(
        `https://pay.payos.vn/api/web/${encodeURIComponent(paymentLinkId)}/check-status/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      const data = await payosRes.json().catch(() => ({}));
      return res.status(200).json(data);
    } catch (err: any) {
      return res.status(200).json({
        code: '99',
        desc: err?.message || 'PayOS status check failed',
        data: { status: 'PENDING' },
      });
    }
  };

  app.post('/api/payos/check-status', handlePayOSCheckStatus);
  app.get('/api/payos/check-status/:paymentLinkId', handlePayOSCheckStatus);
  app.get('/api/payos/check-status', handlePayOSCheckStatus);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
