import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const host = process.env.FLOWIQ_HOST || '0.0.0.0';
const port = Number(process.env.PORT || process.env.FLOWIQ_PORT || 9797);
const dbPath = process.env.IZAKHONO_FLOWIQ_DB || '/app/data/flowiq.sqlite';
const migrationPath = process.env.FLOWIQ_MIGRATION || '/app/migrations/0001_flowiq.sql';
const authToken = process.env.FLOWIQ_TOKEN || '';
const maxBody = Math.max(4096, Math.min(2 * 1024 * 1024, Number(process.env.FLOWIQ_MAX_BODY || 262144)));

mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
db.exec(readFileSync(migrationPath, 'utf8'));

const adapters = {
  delivery: {
    url: (process.env.FLOWIQ_DELIVERY_URL || '').replace(/\/$/, ''),
    token: process.env.FLOWIQ_DELIVERY_TOKEN || '',
  },
  crm: {
    url: (process.env.FLOWIQ_CRM_URL || '').replace(/\/$/, ''),
    token: process.env.FLOWIQ_CRM_TOKEN || '',
  },
  tasks: {
    url: (process.env.FLOWIQ_TASKS_URL || '').replace(/\/$/, ''),
    token: process.env.FLOWIQ_TASKS_TOKEN || '',
  },
};

const nowIso = () => new Date().toISOString();
const uid = prefix => prefix + '_' + crypto.randomUUID().replaceAll('-', '');
const clean = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const jsonText = value => JSON.stringify(value && typeof value === 'object' ? value : {}).slice(0, 20000);

function send(res, status, body) {
  const raw = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': raw.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  res.end(raw);
}

function authorized(req) {
  if (!authToken) return false;
  const header = clean(req.headers.authorization || '', 1024);
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const direct = clean(req.headers['x-flowiq-token'] || '', 1024);
  const supplied = bearer || direct;
  if (!supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(authToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function readJson(req) {
  const parts = [];
  let total = 0;
  for await (const part of req) {
    total += part.length;
    if (total > maxBody) throw new Error('body_too_large');
    parts.push(part);
  }
  if (!parts.length) return {};
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { throw new Error('invalid_json'); }
}

function canonicalEventKey(payload) {
  const explicit = clean(payload.idempotency_key, 180);
  if (explicit) return explicit;
  const seed = JSON.stringify({
    event_type: clean(payload.event_type, 120),
    source: clean(payload.source, 120),
    workspace_id: clean(payload.workspace_id, 120),
    legal_entity: clean(payload.legal_entity, 200),
    draft_id: clean(payload.draft_id, 160),
    subject_id: clean(payload.subject_id, 160),
    status: clean(payload.status, 80),
  });
  return 'auto_' + crypto.createHash('sha256').update(seed).digest('hex');
}

function createAudit(eventId, actionId, eventName, actor, detail = {}) {
  db.prepare(
    'INSERT INTO flowiq_audit(id,event_id,action_id,event_name,actor,detail_json) VALUES(?,?,?,?,?,?)'
  ).run(uid('aud'), eventId || null, actionId || null, eventName, clean(actor, 120) || 'system', jsonText(detail));
}

function createAction(eventId, actionType, adapterName, payload) {
  const cfg = adapters[adapterName] || { url: '', token: '' };
  const state = cfg.url ? 'queued' : 'awaiting_adapter';
  const id = uid('act');
  db.prepare(
    'INSERT INTO flowiq_actions(id,event_id,action_type,action_state,adapter_name,payload_json) VALUES(?,?,?,?,?,?)'
  ).run(id, eventId, actionType, state, adapterName, jsonText(payload));
  createAudit(eventId, id, 'action.created', 'flowiq', { action_type: actionType, adapter: adapterName, state });
  return id;
}

function projectActions(eventId, payload) {
  const type = clean(payload.event_type, 120);
  const base = {
    source: clean(payload.source, 120),
    event_type: type,
    workspace_id: clean(payload.workspace_id, 120),
    legal_entity: clean(payload.legal_entity, 200),
    draft_id: clean(payload.draft_id, 160),
    subject_id: clean(payload.subject_id, 160),
    status: clean(payload.status, 80),
  };
  const ids = [];

  if (type === 'docflow.approved') {
    ids.push(createAction(eventId, 'crm_sync', 'crm', base));
  }
  if (type === 'docflow.approve_and_send_requested') {
    ids.push(createAction(eventId, 'document_delivery', 'delivery', base));
    ids.push(createAction(eventId, 'crm_sync', 'crm', base));
    ids.push(createAction(eventId, 'delivery_followup_schedule', 'tasks', base));
  }
  return ids;
}

async function dispatchAdapter(row, cfg, payload) {
  if (row.adapter_name === 'tasks') {
    const entityId = clean(payload.workspace_id || 'izakhono-africa', 120);
    const subjectRef = clean(payload.draft_id || payload.subject_id, 200);
    if (!subjectRef) throw new Error('tasks_subject_ref_missing');
    const headers = {
      'content-type': 'application/json',
      'x-izakhono-entity-id': entityId,
      'x-platform-id': 'izakhono-docflow',
    };
    if (cfg.token) headers.authorization = 'Bearer ' + cfg.token;
    return fetch(cfg.url + '/api/flow', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action_id: row.id,
        run_id: row.event_id,
        action_type: 'followup.schedule.requested',
        payload: {
          subject_ref: subjectRef,
          metadata: {
            delay_minutes: 1440,
            legal_entity: clean(payload.legal_entity, 200),
            source_event_type: clean(payload.event_type, 120),
          },
        },
      }),
    });
  }

  if (row.adapter_name === 'crm') {
    const entityId = clean(payload.workspace_id || 'izakhono-africa', 120);
    const subjectRef = clean(payload.draft_id || payload.subject_id, 200);
    if (!subjectRef) throw new Error('crm_subject_ref_missing');
    const sourceEvent = clean(payload.event_type, 120);
    const actionType = sourceEvent === 'docflow.approved'
      ? 'crm.document.approved'
      : sourceEvent === 'docflow.approve_and_send_requested'
        ? 'crm.document.send_queued'
        : 'crm.document.approved';
    const headers = {
      'content-type': 'application/json',
      'x-entity-id': entityId,
      'x-platform-id': 'izakhono-docflow',
    };
    if (cfg.token) headers.authorization = 'Bearer ' + cfg.token;
    return fetch(cfg.url + '/api/flow', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action_id: row.id,
        run_id: row.event_id,
        action_type: actionType,
        payload: {
          subject_ref: subjectRef,
          metadata: {
            title: clean(payload.title, 240),
            legal_entity: clean(payload.legal_entity, 200),
            source_event_type: sourceEvent,
            status: clean(payload.status, 80),
          },
        },
      }),
    });
  }

  const headers = { 'content-type': 'application/json' };
  if (cfg.token) headers.authorization = 'Bearer ' + cfg.token;
  return fetch(cfg.url + '/v1/actions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action_id: row.id,
      action_type: row.action_type,
      event_id: row.event_id,
      payload,
    }),
  });
}

async function runAction(row) {
  const cfg = adapters[row.adapter_name];
  if (!cfg?.url) return { attempted: false, state: 'awaiting_adapter' };

  db.prepare(
    "UPDATE flowiq_actions SET action_state='running',attempts=attempts+1,updated_at=CURRENT_TIMESTAMP WHERE id=?"
  ).run(row.id);
  createAudit(row.event_id, row.id, 'action.running', 'flowiq', { adapter: row.adapter_name });

  try {
    const payload = JSON.parse(row.payload_json || '{}');
    const response = await dispatchAdapter(row, cfg, payload);
    if (!response.ok) throw new Error('adapter_http_' + response.status);
    db.prepare(
      "UPDATE flowiq_actions SET action_state='completed',last_error='',updated_at=CURRENT_TIMESTAMP WHERE id=?"
    ).run(row.id);
    createAudit(row.event_id, row.id, 'action.completed', 'flowiq', { adapter: row.adapter_name, status: response.status });
    return { attempted: true, state: 'completed' };
  } catch (error) {
    const detail = String(error?.message || error).slice(0, 300);
    db.prepare(
      "UPDATE flowiq_actions SET action_state='retry',last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?"
    ).run(detail, row.id);
    createAudit(row.event_id, row.id, 'action.retry', 'flowiq', { adapter: row.adapter_name, error: detail });
    return { attempted: true, state: 'retry' };
  }
}

let workerBusy = false;
async function processQueue() {
  if (workerBusy) return;
  workerBusy = true;
  try {
    const rows = db.prepare(
      "SELECT id,event_id,action_type,adapter_name,payload_json FROM flowiq_actions WHERE action_state IN ('queued','retry') ORDER BY created_at LIMIT 20"
    ).all();
    for (const row of rows) await runAction(row);
  } finally {
    workerBusy = false;
  }
}
setInterval(() => { processQueue().catch(() => {}); }, 3000).unref();

function eventView(id) {
  return db.prepare(
    'SELECT id,event_type,source,workspace_id,legal_entity,draft_id,subject_id,subject_type,status,idempotency_key,created_at FROM flowiq_events WHERE id=?'
  ).get(id);
}
function actionViews(eventId) {
  return db.prepare(
    'SELECT id,event_id,action_type,action_state,adapter_name,attempts,last_error,created_at,updated_at FROM flowiq_actions WHERE event_id=? ORDER BY created_at'
  ).all(eventId);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'));

    if (url.pathname === '/healthz' && req.method === 'GET') {
      return send(res, 200, {
        ok: true,
        service: 'IZAKHONO FLOWIQ',
        version: '1.2.0',
        adapters: Object.fromEntries(Object.entries(adapters).map(([k,v]) => [k, Boolean(v.url)])),
      });
    }

    if (url.pathname === '/readyz' && req.method === 'GET') {
      let database = false;
      try { database = db.prepare('SELECT 1 AS ok').get()?.ok === 1; } catch {}
      const ready = database && Boolean(authToken);
      return send(res, ready ? 200 : 503, {
        ok: ready,
        service: 'IZAKHONO FLOWIQ',
        database: database ? 'ready' : 'error',
        auth_configured: Boolean(authToken),
        adapters: Object.fromEntries(Object.entries(adapters).map(([k,v]) => [k, Boolean(v.url)])),
      });
    }

    if (!authorized(req)) return send(res, 401, { ok: false, error: 'unauthorized' });

    if (url.pathname === '/v1/events' && req.method === 'POST') {
      const payload = await readJson(req);
      const eventType = clean(payload.event_type, 120);
      const source = clean(payload.source, 120);
      if (!eventType || !source) return send(res, 422, { ok: false, error: 'event_type_and_source_required' });

      const idem = canonicalEventKey(payload);
      const existing = db.prepare(
        'SELECT id FROM flowiq_events WHERE idempotency_key=?'
      ).get(idem);
      if (existing?.id) {
        return send(res, 200, {
          ok: true,
          duplicate: true,
          event: eventView(existing.id),
          actions: actionViews(existing.id),
          delivery_claim: 'workflow_persisted_not_externally_delivered',
        });
      }

      const eventId = uid('evt');
      db.prepare(
        `INSERT INTO flowiq_events(
          id,event_type,source,workspace_id,legal_entity,draft_id,subject_id,subject_type,status,idempotency_key,payload_json
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        eventId, eventType, source, clean(payload.workspace_id,120), clean(payload.legal_entity,200),
        clean(payload.draft_id,160), clean(payload.subject_id,160), clean(payload.subject_type,80),
        clean(payload.status,80), idem, jsonText(payload)
      );
      createAudit(eventId, null, 'event.accepted', source, { event_type: eventType });
      projectActions(eventId, payload);
      processQueue().catch(() => {});

      return send(res, 202, {
        ok: true,
        duplicate: false,
        event: eventView(eventId),
        actions: actionViews(eventId),
        delivery_claim: 'workflow_persisted_not_externally_delivered',
      });
    }

    if (url.pathname === '/v1/events' && req.method === 'GET') {
      const rows = db.prepare(
        'SELECT id,event_type,source,workspace_id,legal_entity,draft_id,status,created_at FROM flowiq_events ORDER BY created_at DESC LIMIT 100'
      ).all();
      return send(res, 200, { ok: true, events: rows });
    }

    if (url.pathname === '/v1/actions' && req.method === 'GET') {
      const state = clean(url.searchParams.get('state') || '', 40);
      const rows = state
        ? db.prepare('SELECT id,event_id,action_type,action_state,adapter_name,attempts,last_error,created_at,updated_at FROM flowiq_actions WHERE action_state=? ORDER BY updated_at DESC LIMIT 100').all(state)
        : db.prepare('SELECT id,event_id,action_type,action_state,adapter_name,attempts,last_error,created_at,updated_at FROM flowiq_actions ORDER BY updated_at DESC LIMIT 100').all();
      return send(res, 200, { ok: true, actions: rows });
    }

    if (url.pathname === '/v1/run-due' && req.method === 'POST') {
      await processQueue();
      const pending = db.prepare(
        "SELECT action_state,COUNT(*) AS count FROM flowiq_actions GROUP BY action_state ORDER BY action_state"
      ).all();
      return send(res, 200, { ok: true, action_counts: pending });
    }

    return send(res, 404, { ok: false, error: 'not_found' });
  } catch (error) {
    const message = String(error?.message || error);
    const status = message === 'body_too_large' ? 413 : message === 'invalid_json' ? 400 : 500;
    return send(res, status, { ok: false, error: status === 500 ? 'flowiq_error' : message, detail: status === 500 ? message.slice(0,300) : undefined });
  }
});

server.listen(port, host, () => {
  console.log('[IZAKHONO FLOWIQ] listening on http://' + host + ':' + port);
  console.log('[IZAKHONO FLOWIQ] database=' + dbPath);
  console.log('[IZAKHONO FLOWIQ] adapters=' + JSON.stringify(Object.fromEntries(Object.entries(adapters).map(([k,v]) => [k, Boolean(v.url)]))));
});
