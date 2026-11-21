const { json } = require('./_lib/supabase');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Accept');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'method_not_allowed' });
  }
  const supabaseUrl = String(process.env.I_CONNECT_SUPABASE_URL || '').trim();
  const supabaseAnonKey = String(process.env.I_CONNECT_SUPABASE_ANON_KEY || '').trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return json(res, 503, { error: 'authentication_not_configured' });
  }
  return json(res, 200, {
    service: 'I-CONNECT',
    supabaseUrl,
    supabaseAnonKey
  });
};
