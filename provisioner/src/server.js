import http from 'node:http';
import { health } from './health.js';

const port = Number(process.env.PORT || 8080);
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, health());
  if (req.method === 'GET' && req.url === '/') return json(res, 200, { service: 'izakhono-provisioner', status: 'ready' });
  return json(res, 404, { error: 'not_found' });
});
server.listen(port, '0.0.0.0', () => console.log(`IZAKHONO Provisioner listening on ${port}`));
