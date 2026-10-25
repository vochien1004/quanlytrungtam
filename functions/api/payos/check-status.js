// Cloudflare Pages Function: /api/payos/check-status
// Handles both GET and POST requests on Cloudflare Pages (e.g. quanlytrungtam.pages.dev)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    let paymentLinkId = (url.searchParams.get('paymentLinkId') || '').trim();
    let checkoutUrl = (url.searchParams.get('checkoutUrl') || '').trim();

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
