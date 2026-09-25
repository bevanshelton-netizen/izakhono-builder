import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const port = Number(process.env.PORT || 8781);
const registry = JSON.parse(await readFile(join(root, 'registry.json'), 'utf8'));
const bySlug = new Map(registry.services.map(service => [service.slug, service]));

const json = (res, status, body) => {
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(JSON.stringify(body));
};

const mime = path => ({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'}[extname(path)] || 'application/octet-stream');

function search(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return registry.services;
  return registry.services.filter(service =>
    [service.name, service.slug, service.category, service.description].join(' ').toLowerCase().includes(q)
  );
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/health') return json(res, 200, {status:'ok',platform:'IZAKHONO ONE',engine:registry.engine,services:registry.services.length,noTracking:true});
  if (url.pathname === '/api/search') return json(res, 200, {results:search(url.searchParams.get('q'))});
  if (url.pathname.startsWith('/api/resolve/')) {
    const slug = decodeURIComponent(url.pathname.slice('/api/resolve/'.length));
    const service = bySlug.get(slug);
    return service ? json(res, 200, service) : json(res, 404, {error:'service_not_found'});
  }
  if (url.pathname.startsWith('/api/route/')) {
    const slug = decodeURIComponent(url.pathname.slice('/api/route/'.length));
    const service = bySlug.get(slug);
    if (!service) return json(res, 404, {error:'service_not_found'});
    if (!service.publicUrl || !['verified','external-resilience'].includes(service.status)) return json(res, 409, {error:'route_not_publicly_verified',service});
    return json(res, 200, {slug,route:service.publicUrl,status:service.status});
  }

  let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  pathname = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = join(root, pathname);
  if (!filePath.startsWith(root)) return json(res, 403, {error:'forbidden'});
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {'content-type':mime(filePath),'cache-control':pathname.endsWith('.html')?'no-cache':'public, max-age=300','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
    res.end(body);
  } catch {
    json(res, 404, {error:'not_found'});
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log('IZAKHONO_ONE_ENGINE=READY');
  console.log('PORT=' + port);
});
