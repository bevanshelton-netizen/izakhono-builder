export interface Env {
  DB: D1Database;
  SCHEDULER_SECRET?: string;
}

type Job = {
  id: string;
  name: string;
  prompt: string;
  cron: string;
  timezone: string;
  enabled: number;
  next_run_at: string | null;
};

function authorized(request: Request, env: Env): boolean {
  const secret = env.SCHEDULER_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function tick(env: Env): Promise<Response> {
  const now = new Date().toISOString();
  const jobs = await env.DB.prepare(`SELECT id,name,prompt,cron,timezone,enabled,next_run_at
    FROM scheduler_jobs WHERE enabled=1 AND (next_run_at IS NULL OR next_run_at <= ?)`)
    .bind(now).all<Job>();
  const queued: string[] = [];
  for (const job of jobs.results) {
    const runId = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO scheduler_runs
      (id,job_id,status,scheduled_at,started_at,finished_at,error)
      VALUES (?, ?, 'queued', ?, NULL, NULL, NULL)`)
      .bind(runId, job.id, now).run();
    // A scheduler adapter (NODE01 is the preferred owned runtime) advances next_run_at.
    // This prevents the control plane from becoming coupled to one execution host.
    queued.push(runId);
  }
  return Response.json({ ok: true, queued: queued.length, run_ids: queued, now });
}

const app = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ service: "izakhono-scheduler", runtime: "izakhono-owned", ok: true });
    }
    if (!authorized(request, env)) return Response.json({ error: "unauthorized" }, { status: 401 });

    if (request.method === "GET" && url.pathname === "/api/jobs") {
      return Response.json(await env.DB.prepare(
        "SELECT id,name,prompt,cron,timezone,enabled,next_run_at FROM scheduler_jobs ORDER BY name"
      ).all<Job>());
    }

    if (request.method === "POST" && url.pathname === "/api/jobs") {
      const body = await request.json<Job>();
      if (!body.id || !body.name || !body.prompt || !body.cron) {
        return Response.json({ error: "id, name, prompt and cron are required" }, { status: 400 });
      }
      await env.DB.prepare(`INSERT INTO scheduler_jobs
        (id,name,prompt,cron,timezone,enabled,next_run_at,created_at,updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,prompt=excluded.prompt,cron=excluded.cron,timezone=excluded.timezone,next_run_at=excluded.next_run_at,updated_at=datetime('now')`)
        .bind(body.id, body.name, body.prompt, body.cron, body.timezone || "Africa/Johannesburg", body.next_run_at || null).run();
      return Response.json({ ok: true, id: body.id });
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/jobs/") && url.pathname.endsWith("/disable")) {
      const id = url.pathname.split("/")[3];
      await env.DB.prepare("UPDATE scheduler_jobs SET enabled=0, updated_at=datetime('now') WHERE id=?").bind(id).run();
      return Response.json({ ok: true, id, enabled: false });
    }

    if (request.method === "POST" && url.pathname === "/api/tick") return tick(env);
    return Response.json({ error: "not_found" }, { status: 404 });
  },
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await tick(env);
  },
};

export default app;
