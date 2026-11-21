const { json } = require('./_lib/supabase');

// This legacy route previously exposed a service-role RPC without proving
// checkout-session ownership. Provider orchestration is intentionally closed
// until it is moved behind an authenticated, server-to-server workflow.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Allow', 'POST');
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  return json(res, 410, {
    error: 'provider_attempt_endpoint_disabled',
    message: 'Payment provider attempts are not publicly callable.'
  });
};
