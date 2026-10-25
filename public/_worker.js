// Cloudflare Pages Advanced Mode Worker (_worker.js)
// Automatically included inside dist/ on `npm run build` so Cloudflare Pages
// (both Git deployments and Direct Upload of dist/) supports /api/payos/check-status and SPA fallback.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Handle /api/payos/check-status on Cloudflare Edge
    if (url.pathname.startsWith('/api/payos/check-status')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      try {
        let paymentLinkId = (url.searchParams.get('paymentLinkId') || '').trim();
        let checkoutUrl = (url.searchParams.get('checkoutUrl') || '').trim();

        if (!paymentLinkId) {
          const parts = url.pathname.split('/').filter(Boolean);
          if (parts.length >= 4 && parts[2] === 'check-status') {
            paymentLinkId = parts[3].trim();
          }
        }

        if (request.method === 'POST') {
          try {
            const body = await request.json();
            if (!paymentLinkId && body?.paymentLinkId) {
              paymentLinkId = String(body.paymentLinkId).trim();
            }
            if (!checkoutUrl && body?.checkoutUrl) {
              checkoutUrl = String(body.checkoutUrl).trim();
            }
          } catch {}
        }

        if (!paymentLinkId && checkoutUrl) {
          const match = checkoutUrl.match(/\/web\/([a-zA-Z0-9]+)/i);
          if (match && match[1]) {
            paymentLinkId = match[1];
          }
        }

        if (!paymentLinkId || !/^[a-zA-Z0-9_-]+$/.test(paymentLinkId)) {
          return new Response(
            JSON.stringify({ code: '400', desc: 'Missing or invalid paymentLinkId' }),
            { status: 400, headers: corsHeaders }
          );
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
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: corsHeaders,
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            code: '99',
            desc: err?.message || 'PayOS status check failed',
            data: { status: 'PENDING' },
          }),
          { status: 200, headers: corsHeaders }
        );
      }
    }

    // 2. Handle /api/proxy-file on Cloudflare Edge
    if (url.pathname === '/api/proxy-file') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      try {
        const remoteRes = await fetch(targetUrl);
        const headers = new Headers(remoteRes.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Content-Disposition', 'inline');
        return new Response(remoteRes.body, {
          status: remoteRes.status,
          headers,
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err?.message || 'Proxy error' }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // 3. Serve static assets via Cloudflare Pages ASSETS binding
    return env.ASSETS.fetch(request);
  },
};
