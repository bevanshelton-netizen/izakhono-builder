type Statement = {
  bind(...values: unknown[]): Statement;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
};
type Database = { prepare(sql: string): Statement };

const TENANT = 'izakhono-africa';
const MAX_MESSAGE = 12000;
const MAX_MEMORY = 8000;

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
function id(prefix: string) { return prefix + '_' + crypto.randomUUID().replaceAll('-', ''); }
function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
async function ensureSchema(db: Database) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS jarvis_conversations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'New conversation',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_jarvis_conversations_owner
      ON jarvis_conversations(tenant_id, owner_user_id, updated_at DESC)`,
    `CREATE TABLE IF NOT EXISTS jarvis_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES jarvis_conversations(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
      content TEXT NOT NULL,
      client_message_id TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_jarvis_message_idempotency
      ON jarvis_messages(conversation_id, client_message_id)
      WHERE client_message_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_jarvis_messages_conversation
      ON jarvis_messages(conversation_id, created_at ASC)`,
    `CREATE TABLE IF NOT EXISTS jarvis_memory (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      scope TEXT NOT NULL CHECK(scope IN ('company','project','private')),
      project_id TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'owner-entered',
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_jarvis_memory_scope
      ON jarvis_memory(tenant_id, owner_user_id, scope, project_id, updated_at DESC)`,
    `CREATE TABLE IF NOT EXISTS jarvis_audit_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      resource_id TEXT,
      detail_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ];
  for (const sql of statements) await db.prepare(sql).run();
}
async function audit(db: Database, owner: string, type: string, resource: string | null, detail: Record<string, unknown> = {}) {
  await db.prepare(`INSERT INTO jarvis_audit_events
    (id,tenant_id,owner_user_id,event_type,resource_id,detail_json)
    VALUES(?,?,?,?,?,?)`)
    .bind(id('jaud'), TENANT, owner, type, resource, JSON.stringify(detail)).run();
}
async function parseBody(req: Request): Promise<any | null> {
  if (!(req.headers.get('content-type') || '').toLowerCase().includes('application/json')) return null;
  try { return await req.json(); } catch { return null; }
}

/**
 * Initial owner-only persistence API. The auth callback must be the Builder's
 * existing owner authorization check; browser clients never receive admin keys.
 */
export async function jarvisRoute(
  req: Request,
  env: { DB: Database },
  url: URL,
  authorizeOwner: () => Promise<boolean>,
): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/jarvis/v1/')) return null;
  if (req.method === 'OPTIONS') return response({ ok: false, error: 'CORS is not enabled for this owner API.' }, 405);
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    return response({ ok: false, error: 'Method not allowed.' }, 405);
  }
  if (!(await authorizeOwner())) return response({ ok: false, error: 'Unauthorized' }, 401);
  await ensureSchema(env.DB);

  const owner = 'izakhono-owner';
  const path = url.pathname;

  if (path === '/api/jarvis/v1/status' && req.method === 'GET') {
    const counts = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM jarvis_conversations WHERE tenant_id=? AND owner_user_id=?) AS conversations,
      (SELECT COUNT(*) FROM jarvis_messages WHERE tenant_id=? ) AS messages,
      (SELECT COUNT(*) FROM jarvis_memory WHERE tenant_id=? AND owner_user_id=?) AS memory_items`)
      .bind(TENANT, owner, TENANT, TENANT, owner).first<any>();
    return response({
      ok: true,
      product: 'IZAKHONO J.A.R.V.I.S.',
      persistence: 'available',
      intelligence: 'not-connected',
      voice: 'browser-preview-only',
      tools: 'not-connected',
      counts: {
        conversations: Number(counts?.conversations || 0),
        messages: Number(counts?.messages || 0),
        memory_items: Number(counts?.memory_items || 0),
      },
      tenant: TENANT,
    });
  }

  if (path === '/api/jarvis/v1/conversations' && req.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT id,title,status,created_at,updated_at
      FROM jarvis_conversations WHERE tenant_id=? AND owner_user_id=?
      ORDER BY updated_at DESC LIMIT 100`).bind(TENANT, owner).all<any>();
    return response({ ok: true, items: rows.results || [] });
  }

  if (path === '/api/jarvis/v1/conversations' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body) return response({ ok: false, error: 'Expected valid application/json.' }, 400);
    const title = text(body.title, 120) || 'New conversation';
    const conversationId = id('jconv');
    await env.DB.prepare(`INSERT INTO jarvis_conversations
      (id,tenant_id,owner_user_id,title) VALUES(?,?,?,?)`)
      .bind(conversationId, TENANT, owner, title).run();
    await audit(env.DB, owner, 'conversation.created', conversationId);
    return response({ ok: true, conversation: { id: conversationId, title, status: 'active' } }, 201);
  }

  const messagesMatch = path.match(/^\/api\/jarvis\/v1\/conversations\/([a-zA-Z0-9_-]+)\/messages$/);
  if (messagesMatch) {
    const conversationId = messagesMatch[1];
    const conversation = await env.DB.prepare(`SELECT id,title,status FROM jarvis_conversations
      WHERE id=? AND tenant_id=? AND owner_user_id=?`)
      .bind(conversationId, TENANT, owner).first<any>();
    if (!conversation) return response({ ok: false, error: 'Conversation not found.' }, 404);

    if (req.method === 'GET') {
      const rows = await env.DB.prepare(`SELECT id,role,content,metadata_json,created_at
        FROM jarvis_messages WHERE conversation_id=? AND tenant_id=?
        ORDER BY created_at ASC LIMIT 500`).bind(conversationId, TENANT).all<any>();
      return response({ ok: true, conversation, items: (rows.results || []).map(row => ({
        id: row.id, role: row.role, content: row.content,
        metadata: (() => { try { return JSON.parse(row.metadata_json || '{}'); } catch { return {}; } })(),
        created_at: row.created_at,
      })) });
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      if (!body) return response({ ok: false, error: 'Expected valid application/json.' }, 400);
      const content = text(body.text, MAX_MESSAGE);
      if (!content) return response({ ok: false, error: 'Message text is required.' }, 400);
      const clientMessageId = text(body.client_message_id, 100) || null;
      if (clientMessageId) {
        const prior = await env.DB.prepare(`SELECT id,role,content,created_at FROM jarvis_messages
          WHERE conversation_id=? AND client_message_id=?`)
          .bind(conversationId, clientMessageId).first<any>();
        if (prior) return response({ ok: true, duplicate: true, message: prior, intelligence: 'not-connected' });
      }
      const messageId = id('jmsg');
      await env.DB.prepare(`INSERT INTO jarvis_messages
        (id,conversation_id,tenant_id,role,content,client_message_id,metadata_json)
        VALUES(?,?,?,'user',?,?,?)`)
        .bind(messageId, conversationId, TENANT, content, clientMessageId, JSON.stringify({ source: 'owner-ui' })).run();
      await env.DB.prepare(`UPDATE jarvis_conversations SET
        title=CASE WHEN title='New conversation' THEN ? ELSE title END,
        updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND owner_user_id=?`)
        .bind(content.slice(0, 72), conversationId, TENANT, owner).run();
      await audit(env.DB, owner, 'message.received', messageId, { conversation_id: conversationId, chars: content.length });
      return response({
        ok: true,
        message: { id: messageId, role: 'user', content },
        intelligence: 'not-connected',
        next_step: 'Connect the provider-neutral J.A.R.V.I.S. intelligence gateway before generating assistant responses.',
      }, 201);
    }
  }

  if (path === '/api/jarvis/v1/memory' && req.method === 'GET') {
    const scope = text(url.searchParams.get('scope'), 20);
    const projectId = text(url.searchParams.get('project_id'), 100);
    const where = ['tenant_id=?', 'owner_user_id=?'];
    const values: unknown[] = [TENANT, owner];
    if (scope && ['company','project','private'].includes(scope)) { where.push('scope=?'); values.push(scope); }
    if (projectId) { where.push('project_id=?'); values.push(projectId); }
    const rows = await env.DB.prepare(`SELECT id,scope,project_id,title,content,source,tags_json,created_at,updated_at
      FROM jarvis_memory WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT 250`)
      .bind(...values).all<any>();
    return response({ ok: true, items: (rows.results || []).map(row => ({
      ...row, tags: (() => { try { return JSON.parse(row.tags_json || '[]'); } catch { return []; } })(),
      tags_json: undefined,
    })) });
  }

  if (path === '/api/jarvis/v1/memory' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body) return response({ ok: false, error: 'Expected valid application/json.' }, 400);
    const scope = text(body.scope, 20);
    const title = text(body.title, 180);
    const content = text(body.content, MAX_MEMORY);
    const projectId = text(body.project_id, 100) || null;
    if (!['company','project','private'].includes(scope)) return response({ ok: false, error: 'scope must be company, project or private.' }, 400);
    if (!title || !content) return response({ ok: false, error: 'title and content are required.' }, 400);
    if (scope === 'project' && !projectId) return response({ ok: false, error: 'project_id is required for project memory.' }, 400);
    const tags = Array.isArray(body.tags) ? body.tags.filter((tag: unknown) => typeof tag === 'string').map((tag: string) => tag.trim().slice(0, 40)).filter(Boolean).slice(0, 20) : [];
    const memoryId = id('jmem');
    await env.DB.prepare(`INSERT INTO jarvis_memory
      (id,tenant_id,owner_user_id,scope,project_id,title,content,source,tags_json)
      VALUES(?,?,?,?,?,?,?,?,?)`)
      .bind(memoryId, TENANT, owner, scope, projectId, title, content, 'owner-entered', JSON.stringify(tags)).run();
    await audit(env.DB, owner, 'memory.created', memoryId, { scope, project_id: projectId });
    return response({ ok: true, item: { id: memoryId, scope, project_id: projectId, title, content, tags } }, 201);
  }

  if (path === '/api/jarvis/v1/memory/search' && req.method === 'GET') {
    const query = text(url.searchParams.get('q'), 160);
    if (query.length < 2) return response({ ok: false, error: 'Search query must contain at least two characters.' }, 400);
    const term = '%' + query.replace(/[\\%_]/g, ch => '\\' + ch) + '%';
    const rows = await env.DB.prepare(`SELECT id,scope,project_id,title,content,source,tags_json,updated_at
      FROM jarvis_memory WHERE tenant_id=? AND owner_user_id=?
      AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')
      ORDER BY updated_at DESC LIMIT 50`)
      .bind(TENANT, owner, term, term).all<any>();
    return response({ ok: true, query, items: rows.results || [] });
  }

  return response({ ok: false, error: 'J.A.R.V.I.S. route not found.' }, 404);
}
