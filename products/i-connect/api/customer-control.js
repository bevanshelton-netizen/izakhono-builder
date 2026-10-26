const { json, rpc } = require('./_lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const organizationId = String(body.organizationId || '').trim();
    if (!organizationId) return json(res, 400, { error: 'organization_id_required' });

    return rpc(req, res, 'ic_get_customer_control_centre', {
      p_organization_id: organizationId
    });
  } catch (e) {
    return json(res, 400, { error: 'invalid_request' });
  }
};
