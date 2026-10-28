const { json } = require('./_lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { selectProvider, failover, listProviders } = await import('../network/provider-router.mjs');
    if (req.method === 'GET') return json(res, 200, { service: 'I-CONNECT Network Router', providers: listProviders(), production: false, note: 'Selection uses supplied telemetry; it does not claim live carrier availability.' });
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return json(res, 405, { error: 'method_not_allowed' }); }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const mode = body.mode === 'failover' ? 'failover' : 'select';
    const result = mode === 'failover'
      ? failover({ currentProviderId: body.currentProviderId, requirements: body.requirements || {}, telemetry: body.telemetry || {} })
      : selectProvider({ requirements: body.requirements || {}, telemetry: body.telemetry || {}, exclude: body.exclude || [] });
    return json(res, 200, { ok: true, mode, result, customerIdentity: { preserved: true, providerIdentifierIsInternalOnly: true }, auditRequired: mode === 'failover' });
  } catch (error) {
    return json(res, 422, { error: error.message || 'network_selection_failed' });
  }
};
