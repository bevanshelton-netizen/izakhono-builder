// Owner-only task queue; storage is enabled only after the reviewed D1 migration is applied.
export interface JarvisTaskDb {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
      run(): Promise<unknown>;
    };
  };
}
export interface JarvisTaskEnv { DB: JarvisTaskDb; }

function taskJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
const TASK_STATUSES = new Set(["open", "in_progress", "blocked", "done", "cancelled"]);
const TASK_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

export async function jarvisTasksRoute(
  req: Request,
  env: JarvisTaskEnv,
  ownerAuthorized: () => Promise<boolean>,
): Promise<Response | null> {
  const url = new URL(req.url);
  if (url.pathname !== "/api/jarvis/tasks") return null;
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, POST", "cache-control": "no-store" } });
  }
  if (!(await ownerAuthorized())) return taskJson({ ok: false, error: "Unauthorized" }, 401);

  if (req.method === "GET") {
    const rawLimit = url.searchParams.get("limit");
    const limit = rawLimit === null ? 25 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) return taskJson({ ok: false, error: "limit must be an integer from 1 to 50" }, 400);
    const status = url.searchParams.get("status");
    if (status && !TASK_STATUSES.has(status)) return taskJson({ ok: false, error: "Invalid task status" }, 400);
    const result = status
      ? await env.DB.prepare("SELECT id,title,description,status,priority,due_at,created_at,updated_at FROM jarvis_tasks WHERE owner_scope='owner' AND status=? ORDER BY updated_at DESC LIMIT ?").bind(status, limit).all()
      : await env.DB.prepare("SELECT id,title,description,status,priority,due_at,created_at,updated_at FROM jarvis_tasks WHERE owner_scope='owner' ORDER BY updated_at DESC LIMIT ?").bind(limit).all();
    return taskJson({ ok: true, tasks: result.results || [], limit, scope: "owner" });
  }

  let payload: any;
  try { payload = await req.json(); } catch { return taskJson({ ok: false, error: "Expected application/json" }, 400); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return taskJson({ ok: false, error: "Expected a task object" }, 400);
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const priority = payload.priority === undefined ? "normal" : payload.priority;
  const dueAt = payload.due_at === undefined || payload.due_at === null || payload.due_at === "" ? null : payload.due_at;
  if (!title || title.length > 160) return taskJson({ ok: false, error: "title is required and must be 1–160 characters" }, 400);
  if (description.length > 4000) return taskJson({ ok: false, error: "description must be 4000 characters or fewer" }, 400);
  if (typeof priority !== "string" || !TASK_PRIORITIES.has(priority)) return taskJson({ ok: false, error: "Invalid task priority" }, 400);
  if (dueAt !== null && (typeof dueAt !== "string" || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?)?$/.test(dueAt) || !Number.isFinite(Date.parse(dueAt)))) {
    return taskJson({ ok: false, error: "due_at must be a valid ISO date or datetime" }, 400);
  }
  const id = "tsk_" + crypto.randomUUID().replaceAll("-", "");
  await env.DB.prepare("INSERT INTO jarvis_tasks(id,owner_scope,title,description,status,priority,due_at) VALUES(?,'owner',?,?,'open',?,?)")
    .bind(id, title, description, priority, dueAt).run();
  return taskJson({ ok: true, task: { id, title, description, status: "open", priority, due_at: dueAt }, scope: "owner" }, 201);
}
