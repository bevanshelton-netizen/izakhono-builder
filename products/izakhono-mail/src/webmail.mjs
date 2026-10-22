import http from 'node:http';
import { listInbox, ensureIdentity } from './mail-core-sqlite.mjs';
import { authenticate, bearer, login, revoke } from './auth.mjs';

const host = process.env.MAIL_WEBMAIL_LISTEN_HOST || '127.0.0.1';
const port = Number(process.env.MAIL_WEBMAIL_LISTEN_PORT || 8088);
const address = (process.env.MAIL_WEBMAIL_IDENTITY || 'bevan@izakhono').toLowerCase();

function escape(value) {
  return String(value ?? '').replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[c]));
}
function cookieToken(req) {
  const raw = String(req.headers.cookie || '');
  const match = raw.match(/(?:^|;\s*)izakhono_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}
function session(req) {
  return authenticate(bearer(req) || cookieToken(req));
}
function shell(body, title = 'IZAKHONO MAIL') {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{margin:0;background:#eef4f5;font-family:system-ui,-apple-system,sans-serif;color:#102326}.shell{max-width:1000px;margin:auto;padding:24px}.brand{font-size:28px;font-weight:800}.sub{color:#5a6b70;margin:4px 0 24px}.panel{background:#fff;border:1px solid #d8e2e4;border-radius:18px;overflow:hidden}.toolbar{padding:16px 20px;border-bottom:1px solid #e1e8e9;font-weight:700}input,button{font:inherit;padding:12px;border:1px solid #cbd8da;border-radius:10px}button{cursor:pointer;font-weight:700}.form{display:grid;gap:12px;padding:24px}.message{padding:20px;border-bottom:1px solid #e8eeee}.message:last-child{border:0}.meta{display:flex;justify-content:space-between;gap:12px;color:#5a6b70;font-size:14px}.message h2{margin:8px 0}.message pre{white-space:pre-wrap;font:inherit;line-height:1.55}.empty{padding:50px;text-align:center;color:#65777b}.error{color:#a32222}.logout{float:right}</style></head><body><main class="shell"><div class="brand">IZAKHONO MAIL</div>${body}</main></body></html>`;
}
function loginPage(error='') {
  return shell(`<div class="sub">Private IZAKHONO Namespace</div><section class="panel"><div class="toolbar">Secure sign in</div><form class="form" method="post" action="/login"><input name="address" type="email" value="${escape(address)}" autocomplete="username" required><input name="password" type="password" placeholder="Password" autocomplete="current-password" required><button type="submit">Sign in</button>${error ? `<div class="error">${escape(error)}</div>` : ''}</form></section>`, 'Sign in · IZAKHONO MAIL');
}
function inboxPage(identity) {
  ensureIdentity(identity.address);
  const messages = listInbox(identity.address);
  const rows = messages.map((m, i) => `<article class="message"><div class="meta"><strong>${escape(m.sender)}</strong><span>${escape(m.created_at)}</span></div><h2>${escape(m.subject || '(No subject)')}</h2><pre>${escape(m.body)}</pre><small>Message ${i + 1} · ${escape(m.message_id)}</small></article>`).join('');
  return shell(`<div class="sub">${escape(identity.address)} · Private IZAKHONO Namespace <form class="logout" method="post" action="/logout"><button type="submit">Sign out</button></form></div><section class="panel"><div class="toolbar">Inbox · ${messages.length} message${messages.length === 1 ? '' : 's'}</div>${rows || '<div class="empty">Your inbox is empty.</div>'}</section>`);
}
async function formBody(req, max = 16384) {
  const chunks=[]; let size=0;
  for await (const chunk of req) { size += chunk.length; if (size > max) throw new Error('body_too_large'); chunks.push(chunk); }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

export function startWebmail() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ ok: true, service: 'izakhono-webmail' }));
    }
    try {
      if (req.method === 'GET' && url.pathname === '/') {
        const identity = session(req);
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        return res.end(identity ? inboxPage(identity) : loginPage());
      }
      if (req.method === 'POST' && url.pathname === '/login') {
        const form = await formBody(req);
        const identity = (form.get('address') || address).toLowerCase();
        const password = form.get('password') || '';
        try {
          const result = login({ address: identity, password });
          res.writeHead(303, { location: '/', 'set-cookie': `izakhono_session=${encodeURIComponent(result.token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200` });
          return res.end();
        } catch {
          res.writeHead(401, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
          return res.end(loginPage('Invalid credentials.'));
        }
      }
      if (req.method === 'POST' && url.pathname === '/logout') {
        const token = cookieToken(req);
        if (token) revoke(token);
        res.writeHead(303, { location: '/', 'set-cookie': 'izakhono_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
        return res.end();
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    } catch (error) {
      res.writeHead(error.message === 'body_too_large' ? 413 : 500, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      res.end(error.message === 'body_too_large' ? 'Request too large' : 'Webmail error');
    }
  });
  server.listen(port, host, () => console.log(`[IZAKHONO MAIL] webmail listening on ${host}:${port}`));
  return server;
}

if (process.argv[1]?.endsWith('webmail.mjs')) startWebmail();
