const { json, rpc } = require('./_lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const checkoutIntentId = String(body.checkoutIntentId || '').trim();
    if (!checkoutIntentId) return json(res, 400, { error: 'checkout_intent_id_required' });

    return await rpc(req, res, 'ic_checkout_state_for_customer', {
      p_checkout_intent_id: checkoutIntentId
    });
  } catch (e) {
    return json(res, 400, { error: 'invalid_request' });
  }
};
