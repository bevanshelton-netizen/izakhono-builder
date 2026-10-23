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
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function listJobs(env: Env) {
  return env.DB.prepare(
    "SELECT id,name,prompt,cron,timezone,enabled,next_run_at FROM scheduler_jobs ORDER BY name"
  ).all<Job>();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ service: "izakhono-scheduler", runtime: "izakhono-owned", ok: true });
    }

    if (!authorized(request, env)) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    if (request.method === "GET" && url.pathname === "/api/jobs") {
      return Response.json(await listJobs(env));
    }

    if (request.method === "POST" && url.pathname === "/api/jobs") {
      const body = await request.json<Job>();
      if (!body.id || !body.name || !body.prompt || !body.cron) {
        return Response.json({ error: "id, name, prompt and cron are required" }, { status: 400 });
      }
      await env.DB.prepare(`INSERT INTO scheduler_jobs
        (id,name,prompt,cron,timezone,enabled,next_run_at,created_at,updated_at)
        VALUES (?, ?, ?, ?, ?, 1, NULL, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,prompt=excluded.prompt,cron=excluded.cron,timezone=excluded.timezone,updated_at=datetime('now')`)
        .bind(body.id, body.name, body.prompt, body.cron, body.timezone || "Africa/Johannesburg")
        .run();
      return Response.json({ ok: true, id: body.id });
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/jobs/") && url.pathname.endsWith("/disable")) {
      const id = url.pathname.split("/")[3];
      await env.DB.prepare("UPDATE scheduler_jobs SET enabled=0, updated_at=datetime('now') WHERE id=?").bind(id).run();
      return Response.json({ ok: true, id, enabled: false });
    }

    if (request.method === "POST" && url.pathname === "/api/tick") {
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
        // The execution contract is intentionally separate from the scheduler.
        // NODE01/worker agents claim queued runs and report completion.
        await env.DB.prepare("UPDATE scheduler_jobs SET next_run_at=NULL, updated_at=datetime('now') WHERE id=?").bind(job.id).run();
        queued.push(runId);
      }
      return Response.json({ ok: true, queued: queued.length, run_ids: queued });
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  },
};

export async function scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
  // The platform trigger is only a wake-up mechanism. Durable scheduling state lives in D1.
  const request = new Request("https://scheduler.internal/api/tick", { method: "POST", headers: { authorization: `Bearer ${env.SCHEDULER_SECRET || ""}` } });
  await (this as unknown as { fetch: (request: Request, env: Env) => Promise<Response> }).fetch(request, env);
}
