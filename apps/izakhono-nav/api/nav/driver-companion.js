/* IZAKHONO NAV — driver companion API endpoint. */
const { handleDriverCompanionChat } = require('../../driver-companion-ai-route');

module.exports = async function handler(req, res) {
  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const result = await handleDriverCompanionChat({ method: req.method, body });
  res.statusCode = result.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.end(JSON.stringify(result.body));
};

function safeJson(value) {
  try { return JSON.parse(value); } catch (_) { return {}; }
}
