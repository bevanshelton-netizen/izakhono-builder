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

type CronPart = { any: boolean; values: Set<number> };

function authorized(request: Request, env: Env): boolean {
  const secret = env.SCHEDULER_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function parsePart(value: string, min: number, max: number): CronPart {
  const values = new Set<number>();
  if (value === "*") return { any: true, values };
  for (const token of value.split(",")) {
    const [rangePart, stepText] = token.split("/");
    const step = Number(stepText || "1");
    if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid cron step: ${token}`);
    if (rangePart === "*") {
      for (let n = min; n <= max; n += step) values.add(n);
      continue;
    }
    const [aText, bText] = rangePart.split("-");
    const a = Number(aText);
    const b = bText === undefined ? a : Number(bText);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < min || b > max || a > b) {
      throw new Error(`Invalid cron range: ${token}`);
    }
    for (let n = a; n <= b; n += step) values.add(n);
  }
  return { any: false, values };
}

function parseCron(cron: string) {
  const p = cron.trim().split(/\s+/);
  if (p.length !== 5) throw new Error("Cron must contain 5 fields: minute hour day-of-month month day-of-week");
  return {
    minute: parsePart(p[0], 0, 59),
    hour: parsePart(p[1], 0, 23),
    day: parsePart(p[2], 1, 31),
    month: parsePart(p[3], 1, 12),
    weekday: parsePart(p[4], 0, 6),
  };
}

function matchesCron(cron: ReturnType<typeof parseCron>, parts: { minute: number; hour: number; day: number; month: number; weekday: number }) {
  const hit = (p: CronPart, value: number) => p.any || p.values.has(value);
  const dayMatches = hit(cron.day, parts.day);
  const weekdayMatches = hit(cron.weekday, parts.weekday);
  // Standard cron semantics: when both DOM and DOW are restricted, either may match.
  const dayOk = cron.day.any || cron.weekday.any ? dayMatches && weekdayMatches : dayMatches || weekdayMatches;
  return hit(cron.minute, parts.minute) && hit(cron.hour, parts.hour) && hit(cron.month, parts.month) && dayOk;
}

function zonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short",
  });
  const map = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(map.weekday);
  return {
    minute: Number(map.minute), hour: Number(map.hour), day: Number(map.day),
    month: Number(map.month), weekday,
  };
}

function nextRunAt(cronText: string, timezone: string, after: Date): string {
  const cron = parseCron(cronText);
  const cursor = new Date(after);
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  // Search up to 370 days. This handles normal recurring schedules without
  // relying on server-local timezone settings.
  for (let i = 0; i < 535000; i++) {
    if (matchesCron(cron, zonedParts(cursor, timezone))) return cursor.toISOString();
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  throw new Error(`Could not find next run for cron ${cronText}`);
}

async function tick(env: Env): Promise<Response> {
  const now = new Date();
  const nowIso = now.toISOString();
  const jobs = await env.DB.prepare(`SELECT id,name,prompt,cron,timezone,enabled,next_run_at
    FROM scheduler_jobs WHERE enabled=1 AND (next_run_at IS NULL OR next_run_at <= ?)`)
    .bind(nowIso).all<Job>();
  const queued: string[] = [];

  for (const job of jobs.results) {
    const scheduledAt = job.next_run_at || nowIso;
    const next = nextRunAt(job.cron, job.timezone || "Africa/Johannesburg", new Date(scheduledAt));
    const runId = crypto.randomUUID();
    const results = await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO scheduler_runs
        (id,job_id,status,scheduled_at,started_at,finished_at,error)
        VALUES (?, ?, 'queued', ?, NULL, NULL, NULL)`)
        .bind(runId, job.id, scheduledAt),
      env.DB.prepare(`UPDATE scheduler_jobs SET next_run_at=?,updated_at=datetime('now')
        WHERE id=? AND enabled=1 AND (next_run_at IS NULL OR next_run_at <= ?)`)
        .bind(next, job.id, nowIso),
    ]);
    if (results[0].meta.changes) queued.push(runId);
  }
  return Response.json({ ok: true, queued: queued.length, run_ids: queued, now: nowIso });
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
      if (!body.id || !body.name || !body.prompt || !body.cron) return Response.json({ error: "id, name, prompt and cron are required" }, { status: 400 });
      let next = body.next_run_at || null;
      try {
        parseCron(body.cron);
        if (!next) next = nextRunAt(body.cron, body.timezone || "Africa/Johannesburg", new Date());
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "invalid cron" }, { status: 400 });
      }
      await env.DB.prepare(`INSERT INTO scheduler_jobs
        (id,name,prompt,cron,timezone,enabled,next_run_at,created_at,updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,prompt=excluded.prompt,cron=excluded.cron,timezone=excluded.timezone,next_run_at=excluded.next_run_at,enabled=1,updated_at=datetime('now')`)
        .bind(body.id, body.name, body.prompt, body.cron, body.timezone || "Africa/Johannesburg", next).run();
      return Response.json({ ok: true, id: body.id, next_run_at: next });
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/jobs/") && url.pathname.endsWith("/disable")) {
      const id = url.pathname.split("/")[3];
      await env.DB.prepare("UPDATE scheduler_jobs SET enabled=0, updated_at=datetime('now') WHERE id=?").bind(id).run();
      return Response.json({ ok: true, id, enabled: false });
    }

    if (request.method === "POST" && url.pathname === "/api/tick") return tick(env);

    if (request.method === "POST" && url.pathname === "/api/runs/claim") {
      const run = await env.DB.prepare(`SELECT r.id,r.job_id,j.name,j.prompt,j.cron,j.timezone
        FROM scheduler_runs r JOIN scheduler_jobs j ON j.id=r.job_id
        WHERE r.status='queued' ORDER BY r.scheduled_at LIMIT 1`).first();
      if (!run) return Response.json({ run: null });
      const result = await env.DB.prepare("UPDATE scheduler_runs SET status='running',started_at=datetime('now') WHERE id=? AND status='queued'").bind(run.id).run();
      if (!result.meta.changes) return Response.json({ run: null });
      return Response.json({ run });
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/runs/") && url.pathname.endsWith("/complete")) {
      const id = url.pathname.split("/")[3];
      const body = await request.json<{ status?: string; error?: string }>();
      const status = body.status === "failed" ? "failed" : "completed";
      await env.DB.prepare("UPDATE scheduler_runs SET status=?,finished_at=datetime('now'),error=? WHERE id=?").bind(status, body.error || null, id).run();
      return Response.json({ ok: true, id, status });
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  },
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> { await tick(env); },
};

export default app;
