const ROLE_MATRIX = {
  owner: ['org:read','org:write','users:write','services:write','billing:read','audit:read'],
  admin: ['org:read','org:write','users:write','services:write','billing:read','audit:read'],
  manager: ['org:read','users:read','services:read','billing:read','audit:read'],
  agent: ['org:read','services:read'],
  dispatcher: ['org:read','services:read'],
  finance: ['org:read','billing:read'],
  viewer: ['org:read','services:read']
};

module.exports = (req, res) => {
  if (req.method === 'GET') {
    return res.status(200).json({
      service: 'I-CONNECT Identity',
      version: '1.0',
      model: 'multi-tenant',
      roles: ROLE_MATRIX,
      services: ['voice','contact_centre','mobile','connectivity','wifi','fleet','secure_fleet','provisioner'],
      auth: 'SUPABASE_AUTH_REQUIRED_FOR_PRODUCTION'
    });
  }
  res.setHeader('Allow', 'GET');
  return res.status(405).json({ error: 'Method not allowed' });
};
