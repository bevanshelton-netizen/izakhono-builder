export interface JarvisContextDb {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
      run(): Promise<unknown>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
}
export interface JarvisContextEnv { DB: JarvisContextDb; }

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
const SCOPES = new Set(["general", "company", "project"]);

export async function jarvisContextRoute(req: Request, env: JarvisContextEnv, ownerAuthorized: () => Promise<boolean>): Promise<Response | null> {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/api\/jarvis\/context(?:\/([^/]+))?$/);
  if (!match) return null;
  const contextId = match[1] ? decodeURIComponent(match[1]) : null;
  if (req.method !== "GET" && req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, POST", "cache-control": "no-store" } });
  if (!(await ownerAuthorized())) return response({ ok: false, error: "Unauthorized" }, 401);

  if (req.method === "GET") {
    const scopeType = url.searchParams.get("scope_type");
    const scopeId = url.searchParams.get("scope_id");
    const rawLimit = url.searchParams.get("limit");
    const limit = rawLimit === null ? 25 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) return response({ ok: false, error: "limit must be an integer from 1 to 50" }, 400);
    if (scopeType && !SCOPES.has(scopeType)) return response({ ok: false, error: "Invalid scope_type" }, 400);
    if ((scopeType === "company" || scopeType === "project") && (!scopeId || scopeId.length > 120)) return response({ ok: false, error: "A valid scope_id is required" }, 400);
    if (scopeType === "general" && scopeId && scopeId !== "general") return response({ ok: false, error: "General scope_id must be general" }, 400);
    if (contextId) {
      const item = await env.DB.prepare("SELECT id,scope_type,scope_id,title,content,source_label,created_at,updated_at FROM jarvis_context_items WHERE owner_scope='owner' AND id=?").bind(contextId).first();
      return item ? response({ ok: true, item, scope: "owner" }) : response({ ok: false, error: "Context item not found" }, 404);
    }
    const result = scopeType
      ? await env.DB.prepare("SELECT id,scope_type,scope_id,title,content,source_label,created_at,updated_at FROM jarvis_context_items WHERE owner_scope='owner' AND scope_type=? AND scope_id=? ORDER BY updated_at DESC LIMIT ?").bind(scopeType, scopeId || "general", limit).all()
      : await env.DB.prepare("SELECT id,scope_type,scope_id,title,content,source_label,created_at,updated_at FROM jarvis_context_items WHERE owner_scope='owner' ORDER BY updated_at DESC LIMIT ?").bind(limit).all();
    return response({ ok: true, items: result.results || [], limit, scope: "owner" });
  }

  if (contextId) return response({ ok: false, error: "POST only creates context; use the collection route" }, 405);
  let payload: any;
  try { payload = await req.json(); } catch { return response({ ok: false, error: "Expected application/json" }, 400); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return response({ ok: false, error: "Expected a context object" }, 400);
  const scopeType = payload.scope_type === undefined ? "general" : payload.scope_type;
  const scopeId = payload.scope_id === undefined ? (scopeType === "general" ? "general" : "") : payload.scope_id;
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const content = typeof payload.content === "string" ? payload.content.trim() : "";
  const sourceLabel = payload.source_label === undefined ? "owner-entered" : payload.source_label;
  if (typeof scopeType !== "string" || !SCOPES.has(scopeType)) return response({ ok: false, error: "Invalid scope_type" }, 400);
  if (typeof scopeId !== "string" || (scopeType === "general" ? scopeId !== "general" : !scopeId || scopeId.length > 120)) return response({ ok: false, error: "Invalid scope_id" }, 400);
  if (!title || title.length > 160) return response({ ok: false, error: "title is required and must be 1–160 characters" }, 400);
  if (!content || content.length > 12000) return response({ ok: false, error: "content is required and must be 1–12000 characters" }, 400);
  if (typeof sourceLabel !== "string" || sourceLabel.length > 120) return response({ ok: false, error: "source_label must be 120 characters or fewer" }, 400);
  if (scopeType === "project") {
    const project = await env.DB.prepare("SELECT id FROM builder_projects WHERE id=?").bind(scopeId).first();
    if (!project) return response({ ok: false, error: "Project not found" }, 404);
  }
  const id = "ctx_" + crypto.randomUUID().replaceAll("-", "");
  await env.DB.prepare("INSERT INTO jarvis_context_items(id,owner_scope,scope_type,scope_id,title,content,source_label) VALUES(?,'owner',?,?,?,?,?)").bind(id, scopeType, scopeId, title, content, sourceLabel).run();
  return response({ ok: true, item: { id, scope_type: scopeType, scope_id: scopeId, title, content, source_label: sourceLabel }, scope: "owner" }, 201);
}

export async function jarvisTaskContextRoute(req: Request, env: JarvisContextEnv, ownerAuthorized: () => Promise<boolean>): Promise<Response | null> {
  const match = new URL(req.url).pathname.match(/^\/api\/jarvis\/tasks\/([^/]+)\/context$/);
  if (!match) return null;
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
  if (!(await ownerAuthorized())) return response({ ok: false, error: "Unauthorized" }, 401);
  let payload: any;
  try { payload = await req.json(); } catch { return response({ ok: false, error: "Expected application/json" }, 400); }
  const contextId = typeof payload?.context_id === "string" ? payload.context_id : "";
  if (!contextId || contextId.length > 80) return response({ ok: false, error: "context_id is required" }, 400);
  const task = await env.DB.prepare("SELECT id FROM jarvis_tasks WHERE id=? AND owner_scope='owner'").bind(match[1]).first();
  if (!task) return response({ ok: false, error: "Task not found" }, 404);
  const context = await env.DB.prepare("SELECT id FROM jarvis_context_items WHERE id=? AND owner_scope='owner'").bind(contextId).first();
  if (!context) return response({ ok: false, error: "Context item not found" }, 404);
  await env.DB.prepare("INSERT OR IGNORE INTO jarvis_task_context(task_id,context_id,owner_scope) VALUES(?,?,'owner')").bind(match[1], contextId).run();
  return response({ ok: true, task_id: match[1], context_id: contextId, attached: true }, 201);
}
