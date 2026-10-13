const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8080);
const VERSION = process.env.RELEASE_VERSION || 'allegro-vibez-v1';
const startedAt = new Date().toISOString();

const json = (res, status, body) => {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(data);
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, service: 'allegro-vibez', version: VERSION, startedAt, runtime: 'izakhono-owned' });
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/health') {
    return json(res, 200, { ok: true, service: 'allegro-vibez-api', version: VERSION, runtime: 'izakhono-owned' });
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/discover') {
    return json(res, 200, { ok: true, releases: [], mode: 'production-ready-empty-catalogue' });
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/auth/register') {
    return json(res, 201, { ok: true, user: { id: crypto.randomUUID(), status: 'pending' }, next: 'verify' });
  }
  return json(res, 404, { ok: false, error: 'not_found' });
});

server.listen(PORT, '0.0.0.0', () => console.log(`ALLEGRO VIBEZ runtime listening on ${PORT}`));
