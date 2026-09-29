interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}
interface D1Database { prepare(query: string): D1PreparedStatement; }
interface Fetcher { fetch(request: Request): Promise<Response>; }
interface ScheduledController {}
interface ExecutionContext {}
interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  PA_ADMIN_SECRET?: string;
  PA_DEFAULT_TENANT?: string;
  PA_OWNER_WHATSAPP?: string;
  PA_OWNER_NAME?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_GRAPH_VERSION?: string;
  WHATSAPP_ALLOWED_WA_IDS?: string;
  WHATSAPP_BRIEF_TEMPLATE_NAME?: string;
  WHATSAPP_TEMPLATE_LANGUAGE?: string;
  APP_ENV?: string;
}

type AnyRow = Record<string, any>;
const DEFAULT_TENANT = 'izakhono';
const CATEGORIES = new Set(['today','money','waiting_for_us','waiting_on_them','decision','deadline','meeting','risk','follow_up','general']);
const PRIORITIES = new Set(['urgent','high','normal','low']);
const STATUSES = new Set(['open','in_progress','waiting','done','cancelled']);

function uid(prefix: string) { return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`; }
function clean(value: unknown, max = 500) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function tenant(env: Env) { return clean(env.PA_DEFAULT_TENANT || DEFAULT_TENANT, 80) || DEFAULT_TENANT; }
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function fail(message: string, status = 400) { return json({ ok: false, error: message }, status); }
function isAdmin(req: Request, env: Env) {
  const supplied = req.headers.get('x-pa-secret') || '';
  return Boolean(env.PA_ADMIN_SECRET && supplied && supplied === env.PA_ADMIN_SECRET);
}
async function readJson(req: Request) {
  if (!(req.headers.get('content-type') || '').includes('application/json')) throw new Error('Expected application/json');
  return req.json() as Promise<any>;
}
function allowedWhatsAppIds(env: Env) {
  return new Set((env.WHATSAPP_ALLOWED_WA_IDS || '').split(',').map(v => v.trim()).filter(Boolean));
}
function whatsappConfigured(env: Env) {
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_GRAPH_VERSION);
}
async function audit(env: Env, tenantId: string, eventType: string, detail = '') {
  await env.DB.prepare('INSERT INTO pa_audit_events(id,tenant_id,event_type,detail) VALUES(?,?,?,?)')
    .bind(uid('evt'), tenantId, eventType, detail.slice(0, 1200)).run();
}

async function upsertContactFromWhatsapp(env: Env, tenantId: string, waId: string, name = '') {
  const existing = await env.DB.prepare('SELECT id FROM pa_contacts WHERE tenant_id=? AND whatsapp_wa_id=?').bind(tenantId, waId).first<AnyRow>();
  if (existing?.id) {
    if (name) await env.DB.prepare('UPDATE pa_contacts SET name=COALESCE(NULLIF(?,\'\'),name),updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(name, existing.id).run();
    return existing.id as string;
  }
  const id = uid('con');
  await env.DB.prepare('INSERT INTO pa_contacts(id,tenant_id,name,phone,whatsapp_wa_id,status) VALUES(?,?,?,?,?,?)')
    .bind(id, tenantId, name || waId, waId, waId, 'active').run();
  return id;
}

async function createTask(env: Env, tenantId: string, input: any, source = 'dashboard') {
  const title = clean(input?.title, 300);
  if (!title) throw new Error('Task title is required');
  const category = CATEGORIES.has(clean(input?.category, 40)) ? clean(input.category, 40) : 'general';
  const priority = PRIORITIES.has(clean(input?.priority, 20)) ? clean(input.priority, 20) : 'normal';
  const status = STATUSES.has(clean(input?.status, 20)) ? clean(input.status, 20) : 'open';
  const id = uid('tsk');
  const dueAt = clean(input?.due_at, 40) || null;
  const owner = clean(input?.owner, 120) || null;
  const notes = clean(input?.notes, 3000) || null;
  const contactId = clean(input?.contact_id, 120) || null;
  const currency = clean(input?.currency, 8) || 'ZAR';
  const value = Number.isFinite(Number(input?.value_amount)) ? Number(input.value_amount) : null;
  await env.DB.prepare(`INSERT INTO pa_tasks
    (id,tenant_id,title,category,priority,status,due_at,owner,value_amount,currency,contact_id,source,notes)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, tenantId, title, category, priority, status, dueAt, owner, value, currency, contactId, source, notes).run();
  await audit(env, tenantId, 'task.created', `${id} ${category} ${title}`);
  return { id, title, category, priority, status, due_at: dueAt, owner, value_amount: value, currency, contact_id: contactId, source, notes };
}

async function listTasks(env: Env, tenantId: string, includeDone = false) {
  const sql = includeDone
    ? 'SELECT * FROM pa_tasks WHERE tenant_id=? ORDER BY CASE priority WHEN \'urgent\' THEN 0 WHEN \'high\' THEN 1 WHEN \'normal\' THEN 2 ELSE 3 END, COALESCE(due_at,\'9999-12-31\'), created_at DESC LIMIT 250'
    : 'SELECT * FROM pa_tasks WHERE tenant_id=? AND status NOT IN (\'done\',\'cancelled\') ORDER BY CASE priority WHEN \'urgent\' THEN 0 WHEN \'high\' THEN 1 WHEN \'normal\' THEN 2 ELSE 3 END, COALESCE(due_at,\'9999-12-31\'), created_at DESC LIMIT 250';
  const rows = await env.DB.prepare(sql).bind(tenantId).all<AnyRow>();
  return rows.results || [];
}

function compact(items: AnyRow[], limit = 5) {
  if (!items.length) return 'None';
  return items.slice(0, limit).map((t, i) => `${i + 1}. ${t.title}${t.due_at ? ` (${t.due_at})` : ''}`).join('\n');
}

async function buildBrief(env: Env, tenantId: string) {
  const tasks = await listTasks(env, tenantId, false);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const by = (category: string) => tasks.filter(t => t.category === category);
  const todayItems = tasks.filter(t => t.category === 'today' || (t.due_at && String(t.due_at).slice(0, 10) <= today));
  const money = tasks.filter(t => t.category === 'money' || Number(t.value_amount || 0) > 0);
  const waitingForUs = by('waiting_for_us');
  const waitingOnThem = by('waiting_on_them');
  const decisions = by('decision');
  const deadlines = tasks.filter(t => ['deadline','meeting'].includes(t.category));
  const risks = tasks.filter(t => t.category === 'risk' || t.priority === 'urgent');
  const next = tasks.slice(0, 8);
  const moneyTotal = money.reduce((sum, t) => sum + Number(t.value_amount || 0), 0);
  const text = [
    'EXECUTIVE PA BRIEF',
    `Date: ${today}`,
    '',
    'TODAY', compact(todayItems), '',
    'MONEY', money.length ? `${compact(money)}\nTracked value: ZAR ${moneyTotal.toFixed(2)}` : 'None', '',
    'PEOPLE WAITING FOR US', compact(waitingForUs), '',
    'WE ARE WAITING FOR THEM', compact(waitingOnThem), '',
    'CEO DECISIONS', compact(decisions), '',
    'DEADLINES & MEETINGS', compact(deadlines), '',
    'URGENT RISKS', compact(risks), '',
    'NEXT ACTIONS', compact(next, 8)
  ].join('\n');
  const briefId = uid('brf');
  await env.DB.prepare('INSERT INTO pa_briefs(id,tenant_id,brief_date,body,open_tasks,money_value,decision_count,risk_count) VALUES(?,?,?,?,?,?,?,?)')
    .bind(briefId, tenantId, today, text, tasks.length, moneyTotal, decisions.length, risks.length).run();
  return { id: briefId, date: today, text, stats: { open_tasks: tasks.length, money_value: moneyTotal, decisions: decisions.length, risks: risks.length } };
}

async function sendWhatsAppText(env: Env, tenantId: string, to: string, textBody: string, contactId: string | null = null) {
  if (!whatsappConfigured(env)) throw new Error('WhatsApp Cloud API is not configured');
  const version = clean(env.WHATSAPP_GRAPH_VERSION, 20);
  const phoneId = clean(env.WHATSAPP_PHONE_NUMBER_ID, 80);
  const endpoint = `https://graph.facebook.com/${version}/${phoneId}/messages`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body: textBody.slice(0, 3900) } })
  });
  const payload: any = await resp.json().catch(() => ({}));
  const providerId = payload?.messages?.[0]?.id || null;
  const status = resp.ok ? 'sent' : 'failed';
  await env.DB.prepare('INSERT INTO pa_messages(id,tenant_id,contact_id,direction,channel,provider_message_id,body,status,raw_json) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(uid('msg'), tenantId, contactId, 'outbound', 'whatsapp', providerId, textBody.slice(0, 3900), status, JSON.stringify(payload).slice(0, 8000)).run();
  await audit(env, tenantId, `whatsapp.${status}`, `${to} ${providerId || ''}`);
  if (!resp.ok) throw new Error(`WhatsApp send failed (${resp.status})`);
  return { provider_message_id: providerId, payload };
}

async function sendWhatsAppTemplate(env: Env, tenantId: string, to: string, templateName: string, params: string[] = []) {
  if (!whatsappConfigured(env)) throw new Error('WhatsApp Cloud API is not configured');
  const version = clean(env.WHATSAPP_GRAPH_VERSION, 20);
  const phoneId = clean(env.WHATSAPP_PHONE_NUMBER_ID, 80);
  const language = clean(env.WHATSAPP_TEMPLATE_LANGUAGE || 'en', 20) || 'en';
  const components = params.length ? [{ type: 'body', parameters: params.map(text => ({ type: 'text', text: clean(text, 900) })) }] : undefined;
  const payload: any = { messaging_product: 'whatsapp', to, type: 'template', template: { name: templateName, language: { code: language } } };
  if (components) payload.template.components = components;
  const resp = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result: any = await resp.json().catch(() => ({}));
  const providerId = result?.messages?.[0]?.id || null;
  await env.DB.prepare('INSERT INTO pa_messages(id,tenant_id,direction,channel,provider_message_id,body,status,raw_json) VALUES(?,?,?,?,?,?,?,?)')
    .bind(uid('msg'), tenantId, 'outbound', 'whatsapp', providerId, `[template:${templateName}]`, resp.ok ? 'sent' : 'failed', JSON.stringify(result).slice(0, 8000)).run();
  if (!resp.ok) throw new Error(`WhatsApp template send failed (${resp.status})`);
  return { provider_message_id: providerId, payload: result };
}

function parseCommand(textBody: string) {
  const text = textBody.trim();
  const match = text.match(/^(TASK|TODAY|MONEY|DECISION|WAITING|FOLLOWUP|FOLLOW-UP|RISK)\s*:\s*(.+)$/i);
  if (!match) return null;
  const map: Record<string, string> = { TASK: 'general', TODAY: 'today', MONEY: 'money', DECISION: 'decision', WAITING: 'waiting_on_them', FOLLOWUP: 'follow_up', 'FOLLOW-UP': 'follow_up', RISK: 'risk' };
  return { category: map[match[1].toUpperCase()] || 'general', title: match[2].trim() };
}

async function handleWhatsappWebhook(req: Request, env: Env) {
  const payload: any = await req.json().catch(() => null);
  if (!payload) return fail('Invalid webhook payload');
  const tenantId = tenant(env);
  const allowed = allowedWhatsAppIds(env);
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const nameByWa = new Map<string, string>();
      for (const c of value.contacts || []) nameByWa.set(String(c.wa_id || ''), clean(c.profile?.name, 200));
      for (const message of value.messages || []) {
        const from = clean(message.from, 80);
        if (!from) continue;
        const contactId = await upsertContactFromWhatsapp(env, tenantId, from, nameByWa.get(from) || '');
        const textBody = clean(message.text?.body || message.button?.text || message.interactive?.button_reply?.title || '', 4000);
        await env.DB.prepare('INSERT INTO pa_messages(id,tenant_id,contact_id,direction,channel,provider_message_id,body,status,raw_json) VALUES(?,?,?,?,?,?,?,?,?)')
          .bind(uid('msg'), tenantId, contactId, 'inbound', 'whatsapp', clean(message.id, 200) || null, textBody || `[${clean(message.type, 40) || 'message'}]`, 'received', JSON.stringify(message).slice(0, 8000)).run();
        await audit(env, tenantId, 'whatsapp.received', `${from} ${clean(message.id, 200)}`);

        const authorisedPrincipal = allowed.size === 0 || allowed.has(from);
        if (authorisedPrincipal && textBody) {
          if (textBody.trim().toUpperCase() === 'BRIEF') {
            const brief = await buildBrief(env, tenantId);
            await sendWhatsAppText(env, tenantId, from, brief.text, contactId);
            continue;
          }
          const cmd = parseCommand(textBody);
          if (cmd) {
            await createTask(env, tenantId, { title: cmd.title, category: cmd.category, priority: cmd.category === 'risk' ? 'urgent' : 'normal' }, 'whatsapp');
            await sendWhatsAppText(env, tenantId, from, `Captured: ${cmd.title}\nCategory: ${cmd.category.replaceAll('_',' ')}`, contactId);
          }
        }
      }
    }
  }
  return json({ ok: true });
}

async function api(req: Request, env: Env, url: URL) {
  const tenantId = tenant(env);
  if (url.pathname === '/api/health' && req.method === 'GET') {
    const db = await env.DB.prepare('SELECT 1 AS ok').first<AnyRow>();
    return json({ ok: db?.ok === 1, service: 'IZAKHONO EXECUTIVE PA', version: '0.1.0', env: env.APP_ENV || 'production', whatsapp: { configured: whatsappConfigured(env), webhook_verify_configured: Boolean(env.WHATSAPP_VERIFY_TOKEN), owner_target_configured: Boolean(env.PA_OWNER_WHATSAPP), template_configured: Boolean(env.WHATSAPP_BRIEF_TEMPLATE_NAME) } });
  }
  if (url.pathname === '/api/whatsapp/webhook' && req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge') || '';
    if (mode === 'subscribe' && env.WHATSAPP_VERIFY_TOKEN && token === env.WHATSAPP_VERIFY_TOKEN) return new Response(challenge, { status: 200 });
    return new Response('Forbidden', { status: 403 });
  }
  if (url.pathname === '/api/whatsapp/webhook' && req.method === 'POST') return handleWhatsappWebhook(req, env);

  if (!isAdmin(req, env)) return fail(env.PA_ADMIN_SECRET ? 'Unauthorized' : 'PA admin secret is not configured', 401);

  if (url.pathname === '/api/integrations' && req.method === 'GET') {
    return json({ ok: true, whatsapp: { configured: whatsappConfigured(env), verify_token: Boolean(env.WHATSAPP_VERIFY_TOKEN), owner_target: Boolean(env.PA_OWNER_WHATSAPP), allowed_principals: allowedWhatsAppIds(env).size, brief_template: env.WHATSAPP_BRIEF_TEMPLATE_NAME || null, graph_version: env.WHATSAPP_GRAPH_VERSION || null } });
  }
  if (url.pathname === '/api/tasks' && req.method === 'GET') return json({ ok: true, tasks: await listTasks(env, tenantId, url.searchParams.get('all') === '1') });
  if (url.pathname === '/api/tasks' && req.method === 'POST') return json({ ok: true, task: await createTask(env, tenantId, await readJson(req)) }, 201);
  const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && req.method === 'PATCH') {
    const input = await readJson(req);
    const existing = await env.DB.prepare('SELECT * FROM pa_tasks WHERE id=? AND tenant_id=?').bind(taskMatch[1], tenantId).first<AnyRow>();
    if (!existing) return fail('Task not found', 404);
    const status = STATUSES.has(clean(input.status, 20)) ? clean(input.status, 20) : existing.status;
    const priority = PRIORITIES.has(clean(input.priority, 20)) ? clean(input.priority, 20) : existing.priority;
    const dueAt = input.due_at === null ? null : (clean(input.due_at, 40) || existing.due_at);
    const notes = input.notes === null ? null : (clean(input.notes, 3000) || existing.notes);
    await env.DB.prepare('UPDATE pa_tasks SET status=?,priority=?,due_at=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?')
      .bind(status, priority, dueAt, notes, taskMatch[1], tenantId).run();
    await audit(env, tenantId, 'task.updated', `${taskMatch[1]} ${status}`);
    return json({ ok: true, id: taskMatch[1], status, priority, due_at: dueAt, notes });
  }
  if (url.pathname === '/api/contacts' && req.method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM pa_contacts WHERE tenant_id=? ORDER BY updated_at DESC LIMIT 250').bind(tenantId).all<AnyRow>();
    return json({ ok: true, contacts: rows.results || [] });
  }
  if (url.pathname === '/api/contacts' && req.method === 'POST') {
    const input = await readJson(req); const name = clean(input.name, 200); if (!name) return fail('Contact name is required');
    const id = uid('con');
    await env.DB.prepare('INSERT INTO pa_contacts(id,tenant_id,name,organization,email,phone,whatsapp_wa_id,status,next_action_at,notes) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .bind(id, tenantId, name, clean(input.organization, 200) || null, clean(input.email, 200) || null, clean(input.phone, 80) || null, clean(input.whatsapp_wa_id, 80) || null, 'active', clean(input.next_action_at, 40) || null, clean(input.notes, 3000) || null).run();
    return json({ ok: true, id }, 201);
  }
  if (url.pathname === '/api/messages' && req.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT m.*,c.name AS contact_name FROM pa_messages m LEFT JOIN pa_contacts c ON c.id=m.contact_id WHERE m.tenant_id=? ORDER BY m.created_at DESC LIMIT 100`).bind(tenantId).all<AnyRow>();
    return json({ ok: true, messages: rows.results || [] });
  }
  if (url.pathname === '/api/brief' && req.method === 'GET') return json({ ok: true, brief: await buildBrief(env, tenantId) });
  if (url.pathname === '/api/brief/send-whatsapp' && req.method === 'POST') {
    const input = await readJson(req); const to = clean(input.to || env.PA_OWNER_WHATSAPP, 80); if (!to) return fail('WhatsApp recipient is required');
    const brief = await buildBrief(env, tenantId);
    if (input.mode === 'template') {
      const templateName = clean(input.template_name || env.WHATSAPP_BRIEF_TEMPLATE_NAME, 200); if (!templateName) return fail('Approved template name is required');
      const sent = await sendWhatsAppTemplate(env, tenantId, to, templateName, [clean(env.PA_OWNER_NAME || 'Executive', 100), `Open ${brief.stats.open_tasks}; decisions ${brief.stats.decisions}; risks ${brief.stats.risks}. Reply BRIEF for details.`]);
      return json({ ok: true, mode: 'template', brief_id: brief.id, sent });
    }
    return json({ ok: true, mode: 'freeform', brief_id: brief.id, sent: await sendWhatsAppText(env, tenantId, to, brief.text) });
  }
  if (url.pathname === '/api/whatsapp/send' && req.method === 'POST') {
    const input = await readJson(req); const to = clean(input.to, 80); const message = clean(input.text, 3900); if (!to || !message) return fail('Recipient and text are required');
    return json({ ok: true, sent: await sendWhatsAppText(env, tenantId, to, message, clean(input.contact_id, 120) || null) });
  }
  if (url.pathname === '/api/intake' && req.method === 'POST') {
    const input = await readJson(req);
    const title = clean(input.title, 300); if (!title) return fail('Intake title is required');
    const category = CATEGORIES.has(clean(input.category, 40)) ? clean(input.category, 40) : 'general';
    const task = await createTask(env, tenantId, { ...input, title, category }, clean(input.source, 80) || 'integration');
    return json({ ok: true, task }, 201);
  }
  return fail('Not found', 404);
}

async function scheduled(env: Env) {
  const tenantId = tenant(env);
  const brief = await buildBrief(env, tenantId);
  if (!env.PA_OWNER_WHATSAPP) { await audit(env, tenantId, 'brief.delivery.skipped', 'PA_OWNER_WHATSAPP not configured'); return; }
  if (!whatsappConfigured(env)) { await audit(env, tenantId, 'brief.delivery.skipped', 'WhatsApp Cloud API not configured'); return; }
  if (env.WHATSAPP_BRIEF_TEMPLATE_NAME) {
    await sendWhatsAppTemplate(env, tenantId, env.PA_OWNER_WHATSAPP, env.WHATSAPP_BRIEF_TEMPLATE_NAME, [clean(env.PA_OWNER_NAME || 'Executive', 100), `Open ${brief.stats.open_tasks}; decisions ${brief.stats.decisions}; risks ${brief.stats.risks}. Reply BRIEF for details.`]);
    await audit(env, tenantId, 'brief.template.sent', brief.id);
  } else {
    await audit(env, tenantId, 'brief.delivery.skipped', 'Approved WhatsApp brief template not configured; stored brief only');
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await api(req, env, url); }
      catch (error) { return fail(error instanceof Error ? error.message : 'Unexpected error', 500); }
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    try { await scheduled(env); } catch (error) { await audit(env, tenant(env), 'brief.delivery.failed', error instanceof Error ? error.message : 'Unknown error'); }
  }
};
