const { json, rpc } = require('./_lib/supabase');

const ACTIONS = new Set(['provision','activate','suspend','resume','terminate','retry']);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = String(body.action || '').trim().toLowerCase();
    const serviceId = String(body.serviceId || '').trim();
    const idempotencyKey = String(req.headers['x-idempotency-key'] || body.idempotencyKey || '').trim();

    if (!ACTIONS.has(action)) return json(res, 400, { error: 'unsupported_action' });
    if (!serviceId) return json(res, 400, { error: 'service_id_required' });
    if (!idempotencyKey) return json(res, 400, { error: 'idempotency_key_required' });

    const result = await rpc(req, res, 'ic_transition_connectivity_service', {
      p_service_id: serviceId,
      p_action: action,
      p_idempotency_key: idempotencyKey,
      p_metadata: body.metadata || {}
    });

    return result;
  } catch (e) {
    return json(res, 400, { error: 'invalid_request' });
  }
};
