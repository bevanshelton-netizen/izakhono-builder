const { json } = require('./_lib/supabase');

function config() {
  return {
    url: process.env.I_CONNECT_SUPABASE_URL,
    key: process.env.I_CONNECT_SUPABASE_SERVICE_ROLE_KEY
  };
}

async function serviceRpc(res, name, args) {
  const c = config();
  if (!c.url || !c.key) return json(res, 503, { error: 'payment_provider_not_configured' });
  const r = await fetch(c.url + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: c.key,
      authorization: 'Bearer ' + c.key
    },
    body: JSON.stringify(args || {})
  });
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!r.ok) return json(res, r.status, { error: 'supabase_rpc_failed', details: data });
  return json(res, 200, { ok: true, data });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const sessionId = String(body.checkoutSessionId || '').trim();
    const provider = String(body.provider || '').trim();
    if (!sessionId) return json(res, 400, { error: 'checkout_session_id_required' });
    if (!provider) return json(res, 400, { error: 'provider_required' });

    return await serviceRpc(res, 'pay_prepare_checkout_provider_attempt', {
      p_checkout_session_id: sessionId,
      p_provider: provider,
      p_request: body.request && typeof body.request === 'object' ? body.request : {}
    });
  } catch (e) {
    return json(res, 400, { error: 'invalid_request' });
  }
};
