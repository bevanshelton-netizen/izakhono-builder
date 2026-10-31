import { createServer } from 'node:http';
import { SUPER_ENGINE } from './engine.js';

const port = Number(process.env.PORT ?? 8787);

const server = createServer((req, res) => {
  res.setHeader('content-type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  if (req.url === '/health' || req.url === '/') {
    const health = SUPER_ENGINE.health();
    res.statusCode = health.ready ? 200 : 503;
    res.end(JSON.stringify({ ok: health.ready, service: SUPER_ENGINE.id, version: SUPER_ENGINE.version, health }));
    return;
  }

  if (req.url === '/modules') {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, service: SUPER_ENGINE.id, modules: SUPER_ENGINE.modules }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ ok: false, error: 'not_found' }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`IZAKHONO Super Engine listening on ${port}`);
});
