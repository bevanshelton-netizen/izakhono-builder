import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const TLD_RE = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function send(res, status, data, type='application/json; charset=utf-8') {
  const body = type.startsWith('application/json') ? JSON.stringify(data) : data;
  res.writeHead(status, {
    'content-type': type,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'DENY',
    'cache-control': type.startsWith('text/html') ? 'no-cache' : 'no-store'
  });
  res.end(body);
}

async function checkDomain(domain) {
  try {
    const r = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { accept: 'application/rdap+json, application/json' }, redirect: 'follow'
    });
    if (r.status === 404) return { domain, status: 'possibly_available', source: 'RDAP' };
    if (r.ok) return { domain, status: 'registered', source: 'RDAP' };
    return { domain, status: 'unknown', source: 'RDAP', code: r.status };
  } catch {
    return { domain, status: 'unknown', source: 'RDAP' };
  }
}

async function parseBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health') return send(res, 200, { ok: true, service: 'IZAKHONO DOMAINS', mode: 'starter' });

  if (url.pathname === '/api/provider-status') {
    const registrar = Boolean(process.env.DOMAIN_REGISTRAR_API_URL && process.env.DOMAIN_REGISTRAR_API_TOKEN);
    const payment = Boolean(process.env.IKHOKHA_CHECKOUT_URL);
    return send(res, 200, { ok:true, registrar_connected:registrar, payment_connected:payment, mode:registrar?'registrar-api':'rdap-discovery', registration_live:registrar && payment });
  }

  if (url.pathname === '/api/domain-check' && req.method === 'GET') {
    const raw = String(url.searchParams.get('domain') || '').trim().toLowerCase().replace(/^https?:\/\//,'').split('/')[0];
    if (!TLD_RE.test(raw) || raw.length > 253) return send(res, 400, { ok:false, error:'Enter a valid domain name.' });
    const result = await checkDomain(raw);
    return send(res, 200, {
      ok:true, ...result, authoritative:false,
      note: result.status === 'possibly_available'
        ? 'RDAP found no current registration record. Final availability and price must be confirmed with the connected registrar before payment.'
        : 'Status is a discovery check. The connected registrar is the authoritative source for registration and pricing.'
    });
  }

  if (url.pathname === '/api/checkout' && req.method === 'POST') {
    let body = {};
    try { body = await parseBody(req); } catch { return send(res, 400, { ok:false, error:'Invalid JSON body.' }); }
    if (!body.domain) return send(res, 400, { ok:false, error:'Domain is required.' });
    if (!process.env.DOMAIN_REGISTRAR_API_URL || !process.env.DOMAIN_REGISTRAR_API_TOKEN) {
      return send(res, 409, { ok:false, code:'REGISTRAR_NOT_CONNECTED', error:'Registrar provisioning is not connected yet. Do not take payment until authoritative availability and price are confirmed.' });
    }
    if (!process.env.IKHOKHA_CHECKOUT_URL) {
      return send(res, 409, { ok:false, code:'PAYMENT_NOT_CONNECTED', error:'iKhokha checkout link is not configured for domain sales yet.' });
    }
    return send(res, 200, { ok:true, checkout_url:process.env.IKHOKHA_CHECKOUT_URL, domain:String(body.domain) });
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const html = await readFile(path.join(__dirname, 'index.html'), 'utf8');
    return send(res, 200, html, 'text/html; charset=utf-8');
  }

  return send(res, 404, { ok:false, error:'Not found' });
});

server.listen(PORT, '0.0.0.0', () => console.log(`IZAKHONO DOMAINS listening on :${PORT}`));
