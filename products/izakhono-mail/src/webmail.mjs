import http from 'node:http';
import { listInbox, ensureIdentity } from './mail-core-sqlite.mjs';

const host = process.env.MAIL_WEBMAIL_LISTEN_HOST || '127.0.0.1';
const port = Number(process.env.MAIL_WEBMAIL_LISTEN_PORT || 8088);
const address = (process.env.MAIL_WEBMAIL_IDENTITY || 'bevan@izakhono').toLowerCase();

function escape(value) {
  return String(value ?? '').replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[c]));
}

function page() {
  ensureIdentity(address);
  const messages = listInbox(address);
  const rows = messages.map((m, i) => `<article class="message"><div class="meta"><strong>${escape(m.sender)}</strong><span>${escape(m.created_at)}</span></div><h2>${escape(m.subject || '(No subject)')}</h2><pre>${escape(m.body)}</pre><small>Message ${i + 1} · ${escape(m.message_id)}</small></article>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IZAKHONO MAIL</title><style>body{margin:0;background:#eef4f5;font-family:system-ui,-apple-system,sans-serif;color:#102326}.shell{max-width:1000px;margin:auto;padding:24px}.brand{font-size:28px;font-weight:800}.account{color:#5a6b70;margin:4px 0 24px}.panel{background:#fff;border:1px solid #d8e2e4;border-radius:18px;overflow:hidden}.toolbar{padding:16px 20px;border-bottom:1px solid #e1e8e9;font-weight:700}.message{padding:20px;border-bottom:1px solid #e8eeee}.message:last-child{border:0}.meta{display:flex;justify-content:space-between;gap:12px;color:#5a6b70;font-size:14px}.message h2{margin:8px 0}.message pre{white-space:pre-wrap;font:inherit;line-height:1.55}.empty{padding:50px;text-align:center;color:#65777b}</style></head><body><main class="shell"><div class="brand">IZAKHONO MAIL</div><div class="account">${escape(address)} · Private IZAKHONO Namespace</div><section class="panel"><div class="toolbar">Inbox · ${messages.length} message${messages.length === 1 ? '' : 's'}</div>${rows || '<div class="empty">Your inbox is empty.</div>'}</section></main></body></html>`;
}

export function startWebmail() {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, service: 'izakhono-webmail' }));
    }
    if (req.method !== 'GET') { res.writeHead(405); return res.end('Method Not Allowed'); }
    try { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page()); }
    catch (error) { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }); res.end(error.message); }
  });
  server.listen(port, host, () => console.log(`[IZAKHONO MAIL] webmail listening on ${host}:${port}`));
  return server;
}

if (process.argv[1]?.endsWith('webmail.mjs')) startWebmail();
