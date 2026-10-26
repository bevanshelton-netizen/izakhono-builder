import http from 'node:http';
import { syncBuiltinESMExports } from 'node:module';

import { bearerToken, hashToken, safeEqualText } from './security.js';
import { query } from './db.js';
import { discoveryHttp } from './discovery-http.js';

const OWNER_KEY = process.env.CONNECTA_OWNER_KEY || '';
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

async function accountFromRequest(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const result = await query(
    `select a.id, a.email, a.status, p.handle, p.display_name, p.visibility
       from sessions s
       join accounts a on a.id=s.account_id
       join profiles p on p.account_id=a.id
      where s.token_hash=$1
        and s.revoked_at is null
        and s.expires_at > now()
        and a.status='active'
      limit 1`,
    [tokenHash],
  );
  if (!result.rowCount) return null;
  await query('update sessions set last_seen_at=now() where token_hash=$1', [tokenHash]);
  return { ...result.rows[0], tokenHash };
}

function ownerAuthorized(req) {
  return Boolean(OWNER_KEY && safeEqualText(req.headers['x-connecta-owner-key'], OWNER_KEY));
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
    res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
    res.setHeader('access-control-allow-headers', 'authorization,content-type,x-connecta-owner-key');
  }
}

const originalCreateServer = http.createServer.bind(http);
http.createServer = function createServerWithDiscovery(options, listener) {
  if (typeof options === 'function') {
    listener = options;
    options = undefined;
  }

  return originalCreateServer(options, async (req, res) => {
    const url = new URL(req.url, 'http://connecta.local');
    if (!url.pathname.startsWith('/v1/discovery')) {
      return listener(req, res);
    }

    applyCors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    try {
      const handled = await discoveryHttp(req, res, {
        account: await accountFromRequest(req),
        ownerAuthorized: ownerAuthorized(req),
      });
      if (handled !== false) return handled;
    } catch (error) {
      console.error('CONNECTA discovery request failed:', error?.message || error);
      if (!res.headersSent) {
        const status = Number(error?.status || 500);
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        return res.end(JSON.stringify({
          ok: false,
          error: status < 500 ? error.message : 'Internal server error',
        }));
      }
      return res.end();
    }

    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ ok: false, error: 'Discovery route not found' }));
  });
};

syncBuiltinESMExports();

await import('./server.js');
