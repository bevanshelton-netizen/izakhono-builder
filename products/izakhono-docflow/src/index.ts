interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}
interface D1Database { prepare(query: string): D1PreparedStatement; }
interface Fetcher { fetch(request: Request): Promise<Response>; }

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SUPER_AI?: Fetcher;
  FLOWIQ?: Fetcher;
  DOCFLOW_ADMIN_SECRET?: string;
  APP_ENV?: string;
}

type Json = Record<string, unknown>;

const STATUSES = new Set(['review','approved','send_queued','sent','archived','rejected']);
const ALLOWED_TYPES = new Set(['nda','proposal','quotation','sla','employment_letter','supplier_agreement']);

function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}
function clean(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
function isOwner(req: Request, env: Env) {
  const supplied = req.headers.get('x-docflow-secret') || '';
  return Boolean(env.DOCFLOW_ADMIN_SECRET && supplied === env.DOCFLOW_ADMIN_SECRET);
}
async function readBody(req: Request): Promise<any> {
  if (!(req.headers.get('content-type') || '').includes('application/json')) {
    throw new Error('Expected application/json');
  }
  return req.json();
}
async function audit(env: Env, draftId: string | null, eventType: string, actor: string, detail: Json = {}) {
  await env.DB.prepare(
    'INSERT INTO docflow_audit_events(id,draft_id,event_type,actor,detail_json) VALUES(?,?,?,?,?)'
  ).bind(uid('evt'), draftId, eventType, clean(actor, 120) || 'system', JSON.stringify(detail).slice(0, 8000)).run();
}

function fallbackDraft(input: any): string {
  const type = clean(input.document_type, 60);
  const title = clean(input.title, 160) || 'Document Draft';
  const a = clean(input.party_a, 200) || '[Party A]';
  const b = clean(input.party_b, 200) || '[Party B]';
  const date = clean(input.effective_date, 40) || '[Effective date]';
  const jurisdiction = clean(input.jurisdiction, 120) || '[Jurisdiction]';
  const brief = clean(input.instructions, 1200);
  const heading = type === 'nda' ? 'NON-DISCLOSURE AGREEMENT'
    : type === 'sla' ? 'SERVICE LEVEL AGREEMENT'
    : type === 'quotation' ? 'QUOTATION'
    : type === 'proposal' ? 'BUSINESS PROPOSAL'
    : type === 'employment_letter' ? 'EMPLOYMENT LETTER'
    : 'SUPPLIER AGREEMENT';

  return [
    `# ${heading}`,
    '',
    `**Working title:** ${title}`,
    `**Party A:** ${a}`,
    `**Party B:** ${b}`,
    `**Effective date:** ${date}`,
    `**Jurisdiction:** ${jurisdiction}`,
    '',
    '> HUMAN REVIEW REQUIRED — This is a structured working draft, not final legal advice.',
    '',
    '## Purpose',
    brief || '[Describe the purpose, commercial objective and intended outcome.]',
    '',
    '## Scope',
    '[Insert the precise goods, services, information, obligations or relationship covered.]',
    '',
    '## Responsibilities',
    '- [Party A responsibilities]',
    '- [Party B responsibilities]',
    '',
    '## Commercial and operational terms',
    '- [Pricing / consideration / fees if applicable]',
    '- [Delivery or performance timelines]',
    '- [Service levels / quality requirements if applicable]',
    '',
    '## Confidentiality, data and IP',
    '[Confirm confidentiality, personal-information handling, ownership, licences and permitted use.]',
    '',
    '## Term, termination and disputes',
    '[Insert duration, termination rights, notice periods, remedies and dispute process.]',
    '',
    '## Signatures',
    `${a}: ____________________   Date: __________`,
    '',
    `${b}: ____________________   Date: __________`,
  ].join('\n');
}

async function callSuperAI(env: Env, input: any): Promise<{content: string; status: string}> {
  if (!env.SUPER_AI) return { content: fallbackDraft(input), status: 'fallback_template' };

  const facts = {
    document_type: clean(input.document_type, 60),
    title: clean(input.title, 160),
    workspace_id: clean(input.workspace_id || 'izakhono-africa', 100),
    legal_entity: clean(input.legal_entity || 'IZAKHONO AFRICA (PTY) LTD', 200),
    party_a: clean(input.party_a, 200),
    party_b: clean(input.party_b, 200),
    effective_date: clean(input.effective_date, 40),
    jurisdiction: clean(input.jurisdiction, 120),
    brief: clean(input.instructions, 1200),
    known_fields: input.known_fields && typeof input.known_fields === 'object' ? input.known_fields : {},
  };

  const req = new Request('https://super-ai.izakhono.internal/api/v1/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      entity_id: facts.workspace_id,
      subject: 'docflow-workflow',
      product: 'izakhono-docflow',
      access_mode: 'workflow',
      data_classification: 'internal',
      messages: [
        {
          role: 'system',
          content: [
            'You are the document-drafting capability for IZAKHONO DOCFLOW.',
            'Create a professional working draft in Markdown from supplied facts only.',
            'Do not invent missing names, dates, prices, obligations, legal registrations, signatures or jurisdiction-specific claims.',
            'Use clearly marked placeholders where a material fact is missing.',
            'Preserve the named legal entity and parties exactly.',
            'State that human review is required before signature or sending.',
            'Do not claim that the document has been legally reviewed, signed, delivered or accepted.',
            'Return only the document draft; do not include commentary outside the draft.'
          ].join(' ')
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Draft the requested business document.',
            document: facts,
            safety: {
              human_approval_required: true,
              no_autonomous_signature: true,
              no_invented_material_facts: true
            }
          })
        }
      ]
    }),
  });

  try {
    const res = await env.SUPER_AI.fetch(req);
    if (!res.ok) return { content: fallbackDraft(input), status: 'ai_adapter_error_fallback' };
    const data: any = await res.json();
    const content = clean(data?.answer || data?.output?.text, 60000);
    return content
      ? { content, status: 'super_ai_draft' }
      : { content: fallbackDraft(input), status: 'ai_empty_fallback' };
  } catch {
    return { content: fallbackDraft(input), status: 'ai_unreachable_fallback' };
  }
}

async function notifyFlowIQ(env: Env, eventType: string, draft: any, extra: Json = {}) {
  if (!env.FLOWIQ) return { queued: false, reason: 'flowiq_adapter_not_bound' };
  try {
    const res = await env.FLOWIQ.fetch(new Request('https://flowiq.izakhono.internal/v1/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event_type: eventType,
        source: 'IZAKHONO DOCFLOW',
        draft_id: draft.id,
        workspace_id: draft.workspace_id,
        legal_entity: draft.legal_entity,
        status: draft.status,
        ...extra,
      }),
    }));
    return { queued: res.ok, status: res.status };
  } catch {
    return { queued: false, reason: 'flowiq_unreachable' };
  }
}

async function getDraft(env: Env, id: string) {
  return env.DB.prepare(
    'SELECT id,workspace_id,legal_entity,document_type,title,party_a,party_b,effective_date,jurisdiction,content_markdown,ai_status,status,approved_by,approved_at,send_status,created_at,updated_at FROM docflow_drafts WHERE id=?'
  ).bind(id).first<any>();
}

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname === '/api/health' && req.method === 'GET') {
    let database = 'unbound';
    if (env.DB) {
      try {
        const probe = await env.DB.prepare('SELECT 1 AS ok').first<any>();
        database = probe?.ok === 1 ? 'ready' : 'error';
      } catch {
        database = 'error';
      }
    }
    return json({
      ok: true,
      service: 'IZAKHONO DOCFLOW',
      version: '0.1.1',
      environment: env.APP_ENV || 'production',
      database,
      adapters: { super_ai: Boolean(env.SUPER_AI), flowiq: Boolean(env.FLOWIQ) },
      public_live: false,
    });
  }

  if (url.pathname === '/api/ready' && req.method === 'GET') {
    if (!env.DB) return json({ ok: false, service: 'IZAKHONO DOCFLOW', database: 'unbound' }, 503);
    try {
      const probe = await env.DB.prepare('SELECT 1 AS ok').first<any>();
      const ready = probe?.ok === 1;
      return json({
        ok: ready,
        service: 'IZAKHONO DOCFLOW',
        database: ready ? 'ready' : 'error',
        owner_secret_configured: Boolean(env.DOCFLOW_ADMIN_SECRET),
        adapters: { super_ai: Boolean(env.SUPER_AI), flowiq: Boolean(env.FLOWIQ) },
      }, ready ? 200 : 503);
    } catch {
      return json({ ok: false, service: 'IZAKHONO DOCFLOW', database: 'error' }, 503);
    }
  }

  if (url.pathname === '/api/templates' && req.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT document_type,label,description,schema_json FROM docflow_templates WHERE active=1 ORDER BY label'
    ).all<any>();
    return json({ ok: true, templates: (rows.results || []).map(r => ({ ...r, schema: JSON.parse(r.schema_json || '{}') })) });
  }

  if (!env.DOCFLOW_ADMIN_SECRET) return json({ ok: false, error: 'DOCFLOW owner secret is not configured' }, 503);
  if (!isOwner(req, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

  if (url.pathname === '/api/drafts' && req.method === 'GET') {
    const workspace = clean(url.searchParams.get('workspace') || 'izakhono-africa', 100);
    const rows = await env.DB.prepare(
      'SELECT id,workspace_id,legal_entity,document_type,title,party_a,party_b,status,ai_status,send_status,created_at,updated_at FROM docflow_drafts WHERE workspace_id=? ORDER BY updated_at DESC LIMIT 100'
    ).bind(workspace).all<any>();
    return json({ ok: true, drafts: rows.results || [] });
  }

  if (url.pathname === '/api/drafts' && req.method === 'POST') {
    let input: any;
    try { input = await readBody(req); } catch (e) { return json({ ok: false, error: e instanceof Error ? e.message : 'Invalid request' }, 400); }

    const documentType = clean(input.document_type, 60);
    if (!ALLOWED_TYPES.has(documentType)) return json({ ok: false, error: 'Unsupported document type' }, 400);

    const workspaceId = clean(input.workspace_id || 'izakhono-africa', 100);
    const legalEntity = clean(input.legal_entity || 'IZAKHONO AFRICA (PTY) LTD', 200);
    const title = clean(input.title, 160) || documentType.replaceAll('_',' ').toUpperCase();
    const draftId = uid('doc');
    const ai = await callSuperAI(env, { ...input, document_type: documentType, title });

    await env.DB.prepare(
      `INSERT INTO docflow_drafts(
        id,workspace_id,legal_entity,document_type,title,instructions,party_a,party_b,effective_date,jurisdiction,
        known_fields_json,content_markdown,ai_status,status,created_by
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'review',?)`
    ).bind(
      draftId, workspaceId, legalEntity, documentType, title,
      clean(input.instructions, 1200), clean(input.party_a, 200), clean(input.party_b, 200),
      clean(input.effective_date, 40), clean(input.jurisdiction, 120),
      JSON.stringify(input.known_fields && typeof input.known_fields === 'object' ? input.known_fields : {}).slice(0, 12000),
      ai.content, ai.status, clean(input.created_by || 'owner', 120)
    ).run();

    await audit(env, draftId, 'draft.created', clean(input.created_by || 'owner', 120), {
      document_type: documentType,
      ai_status: ai.status,
      workspace_id: workspaceId,
      legal_entity: legalEntity,
    });
    const created = await getDraft(env, draftId);
    await notifyFlowIQ(env, 'docflow.draft_created', created || { id: draftId, workspace_id: workspaceId, legal_entity: legalEntity, status: 'review' });
    return json({ ok: true, draft: created, human_approval_required: true }, 201);
  }

  const match = url.pathname.match(/^\/api\/drafts\/([^/]+)(?:\/(approve|approve-and-send|reject|archive|audit))?$/);
  if (match) {
    const draftId = decodeURIComponent(match[1]);
    const action = match[2] || '';
    const draft = await getDraft(env, draftId);
    if (!draft) return json({ ok: false, error: 'Draft not found' }, 404);

    if (!action && req.method === 'GET') return json({ ok: true, draft });

    if (action === 'audit' && req.method === 'GET') {
      const rows = await env.DB.prepare(
        'SELECT id,event_type,actor,detail_json,created_at FROM docflow_audit_events WHERE draft_id=? ORDER BY created_at'
      ).bind(draftId).all<any>();
      return json({ ok: true, events: (rows.results || []).map(r => ({ ...r, detail: JSON.parse(r.detail_json || '{}') })) });
    }

    if (['approve','approve-and-send','reject','archive'].includes(action) && req.method === 'POST') {
      let input: any = {};
      try { input = await readBody(req); } catch { input = {}; }
      const actor = clean(input.approver || input.actor || 'owner', 120);
      const note = clean(input.note, 1200);

      if (action === 'archive') {
        await env.DB.prepare("UPDATE docflow_drafts SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(draftId).run();
        await audit(env, draftId, 'draft.archived', actor, { note });
        return json({ ok: true, draft: await getDraft(env, draftId) });
      }

      if (draft.status !== 'review') return json({ ok: false, error: 'Only a document in review can be approved or rejected' }, 409);

      if (action === 'reject') {
        await env.DB.prepare("UPDATE docflow_drafts SET status='rejected',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(draftId).run();
        await env.DB.prepare('INSERT INTO docflow_approvals(id,draft_id,approver,note,decision) VALUES(?,?,?,?,?)')
          .bind(uid('apr'), draftId, actor, note, 'rejected').run();
        await audit(env, draftId, 'draft.rejected', actor, { note });
        return json({ ok: true, draft: await getDraft(env, draftId) });
      }

      if (input.confirm !== true) return json({ ok: false, error: 'Human confirmation is required' }, 400);
      const nextStatus = action === 'approve-and-send' ? 'send_queued' : 'approved';
      const sendStatus = action === 'approve-and-send' ? 'queued' : 'not_queued';
      await env.DB.prepare(
        'UPDATE docflow_drafts SET status=?,approved_by=?,approved_at=CURRENT_TIMESTAMP,send_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?'
      ).bind(nextStatus, actor, sendStatus, draftId).run();
      await env.DB.prepare('INSERT INTO docflow_approvals(id,draft_id,approver,note,decision) VALUES(?,?,?,?,?)')
        .bind(uid('apr'), draftId, actor, note, 'approved').run();
      await audit(env, draftId, action === 'approve-and-send' ? 'draft.approved_send_requested' : 'draft.approved', actor, { note });

      const updated = await getDraft(env, draftId);
      const flow = await notifyFlowIQ(env, action === 'approve-and-send' ? 'docflow.approve_and_send_requested' : 'docflow.approved', updated || draft, { actor });
      return json({
        ok: true,
        draft: updated,
        flowiq: flow,
        delivery_claim: action === 'approve-and-send' ? 'queued_not_sent' : 'not_requested',
      });
    }
  }

  return json({ ok: false, error: 'Not found' }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await api(req, env, url); }
      catch (e) { return json({ ok: false, error: e instanceof Error ? e.message : 'Unexpected error' }, 500); }
    }
    return env.ASSETS.fetch(req);
  }
};
