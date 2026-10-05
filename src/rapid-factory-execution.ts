type Stmt = {
  bind(...values: unknown[]): Stmt;
  first<T = any>(): Promise<T | null>;
  run(): Promise<unknown>;
};
type Env = { DB: { prepare(sql: string): Stmt } };

export type FactoryAttemptStatus = 'running' | 'completed' | 'failed';

export type FactoryAttempt = {
  id: string;
  jobId: string;
  phase: string;
  attempt: number;
  status: FactoryAttemptStatus;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}

function clean(value: unknown, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

async function ensureFactoryExecutionSchema(env: Env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS rapid_factory_attempts (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      attempt INTEGER NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TEXT,
      error TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      UNIQUE(job_id, phase, attempt)
    )
  `).run();
}

export async function startFactoryAttempt(env: Env, jobId: string, phase: string, metadata: Record<string, unknown> = {}) {
  await ensureFactoryExecutionSchema(env);
  const previous = await env.DB.prepare(
    'SELECT COALESCE(MAX(attempt),0) AS attempt FROM rapid_factory_attempts WHERE job_id=? AND phase=?'
  ).bind(jobId, phase).first<any>();
  const attempt = Number(previous?.attempt || 0) + 1;
  const attemptId = id('rfa');
  await env.DB.prepare(`
    INSERT INTO rapid_factory_attempts(id,job_id,phase,attempt,status,metadata_json)
    VALUES(?,?,?,?,?,?)
  `).bind(attemptId, jobId, phase, attempt, 'running', JSON.stringify(metadata)).run();
  return { id: attemptId, jobId, phase, attempt, status: 'running' as const };
}

export async function completeFactoryAttempt(env: Env, attemptId: string, metadata: Record<string, unknown> = {}) {
  await env.DB.prepare(`
    UPDATE rapid_factory_attempts
      SET status='completed',finished_at=CURRENT_TIMESTAMP,metadata_json=?
      WHERE id=? AND status='running'
  `).bind(JSON.stringify(metadata), attemptId).run();
}

export async function failFactoryAttempt(env: Env, attemptId: string, error: unknown, metadata: Record<string, unknown> = {}) {
  await env.DB.prepare(`
    UPDATE rapid_factory_attempts
      SET status='failed',finished_at=CURRENT_TIMESTAMP,error=?,metadata_json=?
      WHERE id=? AND status='running'
  `).bind(clean(error), JSON.stringify(metadata), attemptId).run();
}

export async function getLatestFactoryAttempt(env: Env, jobId: string, phase: string) {
  await ensureFactoryExecutionSchema(env);
  return env.DB.prepare(`
    SELECT id,job_id,phase,attempt,status,started_at,finished_at,error,metadata_json
      FROM rapid_factory_attempts
      WHERE job_id=? AND phase=?
      ORDER BY attempt DESC LIMIT 1
  `).bind(jobId, phase).first<any>();
}
