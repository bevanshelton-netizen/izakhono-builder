import http from 'node:http';
import path from 'node:path';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import worker from '../dist/index.js';

const port = Number(process.env.PORT || process.env.DOCFLOW_PORT || 8787);
const host = process.env.DOCFLOW_HOST || '0.0.0.0';
const dbPath = process.env.IZAKHONO_DOCFLOW_DB || '/app/data/docflow.sqlite';
const publicRoot = path.resolve(process.env.DOCFLOW_PUBLIC_DIR || '/app/public');
const migrationDir = process.env.DOCFLOW_MIGRATION_DIR || '/app/migrations';

mkdirSync(path.dirname(dbPath), { recursive: true });
const sqlite = new DatabaseSync(dbPath);
sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
for (const file of readdirSync(migrationDir).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
  try {
    sqlite.exec(readFileSync(path.join(migrationDir, file), 'utf8'));
  } catch (error) {
    const message = String(error?.message || error);
    if (!/duplicate column name/i.test(message)) throw error;
  }
}

class D1Statement {
  constructor(db, sql, values = []) { this.db = db; this.sql = sql; this.values = values; }
  bind(...values) { return new D1Statement(this.db, this.sql, values); }
  async first() { return this.db.prepare(this.sql).get(...this.values) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.values) }; }
  async run() { return this.db.prepare(this.sql).run(...this.values); }
}
const DB = { prepare(sql) { return new D1Statement(sqlite, sql); } };

const mime = {
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
  '.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'
};
const ASSETS = {
  async fetch(request) {
    const url = new URL(request.url);
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return new Response('Bad request', { status: 400 }); }
    if (pathname === '/') pathname = '/index.html';
    if (pathname.includes('..')) return new Response('Forbidden', { status: 403 });
    const target = path.resolve(publicRoot, '.' + pathname);
    if (target !== publicRoot && !target.startsWith(publicRoot + path.sep)) return new Response('Forbidden', { status: 403 });
    try {
      const bytes = await readFile(target);
      return new Response(bytes, { headers: { 'content-type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream', 'cache-control':'no-store' } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  }
};

function superAiAdapter(base, internalKey, workflowKey) {
  if (!base || !internalKey || !workflowKey) return undefined;
  const root = base.replace(/\/$/, '');
  return {
    async fetch(request) {
      const incoming = new URL(request.url);
      const headers = new Headers(request.headers);
      headers.set('x-izakhono-ai-key', internalKey);
      headers.set('x-izakhono-ai-workflow-key', workflowKey);
      const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
      return fetch(root + incoming.pathname + incoming.search, { method: request.method, headers, body });
    }
  };
}

function bearerAdapter(base, token) {
  if (!base) return undefined;
  const root = base.replace(/\/$/, '');
  return {
    async fetch(request) {
      const incoming = new URL(request.url);
      const headers = new Headers(request.headers);
      if (token) headers.set('authorization', 'Bearer ' + token);
      const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
      return fetch(root + incoming.pathname + incoming.search, { method: request.method, headers, body });
    }
  };
}

const env = {
  DB,
  ASSETS,
  APP_ENV: process.env.APP_ENV || 'production',
  DOCFLOW_ADMIN_SECRET: process.env.DOCFLOW_ADMIN_SECRET || '',
  SUPER_AI: superAiAdapter(
    process.env.SUPER_AI_URL || '',
    process.env.SUPER_AI_INTERNAL_KEY || process.env.SUPER_AI_TOKEN || '',
    process.env.SUPER_AI_WORKFLOW_KEY || ''
  ),
  FLOWIQ: bearerAdapter(process.env.FLOWIQ_URL || '', process.env.FLOWIQ_TOKEN || ''),
};

async function readIncoming(req) {
  const parts=[]; let size=0;
  for await (const part of req) {
    size += part.length;
    if (size > 2 * 1024 * 1024) throw new Error('Request too large');
    parts.push(part);
  }
  return Buffer.concat(parts);
}

const server = http.createServer(async (req, res) => {
  try {
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const authority = req.headers.host || ('127.0.0.1:' + port);
    const url = proto + '://' + authority + (req.url || '/');
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) value.forEach(v => headers.append(key, v));
      else if (value !== undefined) headers.set(key, value);
    }
    const method = req.method || 'GET';
    const body = method === 'GET' || method === 'HEAD' ? undefined : await readIncoming(req);
    const request = new Request(url, { method, headers, body });
    const response = await worker.fetch(request, env);
    res.statusCode = response.status;
    for (const [key, value] of response.headers) res.setHeader(key, value);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('content-type','application/json; charset=utf-8');
    res.end(JSON.stringify({ ok:false, error:'DOCFLOW owned runtime error', detail:String(error?.message || error).slice(0,300) }));
  }
});

server.listen(port, host, () => {
  console.log('[IZAKHONO DOCFLOW] owned runtime listening on http://' + host + ':' + port);
  console.log('[IZAKHONO DOCFLOW] database=' + dbPath);
  console.log('[IZAKHONO DOCFLOW] SUPER_AI=' + (env.SUPER_AI ? 'bound' : 'fallback'));
  console.log('[IZAKHONO DOCFLOW] FLOWIQ=' + (env.FLOWIQ ? 'bound' : 'not-bound'));
});
