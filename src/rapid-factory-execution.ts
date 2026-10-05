type Stmt = {
  bind(...values: unknown[]): Stmt;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
};
type Env = { DB: { prepare(sql: string): Stmt } };

export const RAPID_FACTORY_PHASES = [
  'intake','architecture','content','brand','build','integration','validation','release_candidate','deployment_verification','handover',
] as const;
export type RapidFactoryPhase = typeof RAPID_FACTORY_PHASES[number];
export type FactoryAttemptStatus = 'running' | 'completed' | 'failed' | 'cancelled';

function id(prefix: string) { return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`; }
function clean(value: unknown, max = 2000) { return String(value ?? '').trim().slice(0, max); }
function phaseIndex(phase: string) { return RAPID_FACTORY_PHASES.indexOf(phase as RapidFactoryPhase); }

export async function ensureFactoryExecutionSchema(env: Env) {
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

export async function startFactoryAttempt(env: Env, jobId: string, phase: RapidFactoryPhase, metadata: Record<string, unknown> = {}) {
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

export async function checkpointFactoryAttempt(env: Env, attemptId: string, metadata: Record<string, unknown> = {}) {
  await env.DB.prepare(`
    UPDATE rapid_factory_attempts SET metadata_json=? WHERE id=? AND status='running'
  `).bind(JSON.stringify(metadata), attemptId).run();
}

export async function completeFactoryAttempt(env: Env, attemptId: string, metadata: Record<string, unknown> = {}) {
  await checkpointFactoryAttempt(env, attemptId, metadata);
  await env.DB.prepare(`
    UPDATE rapid_factory_attempts
      SET status='completed',finished_at=CURRENT_TIMESTAMP
      WHERE id=? AND status='running'
  `).bind(attemptId).run();
}

export async function failFactoryAttempt(env: Env, attemptId: string, error: unknown, metadata: Record<string, unknown> = {}) {
  await checkpointFactoryAttempt(env, attemptId, metadata);
  await env.DB.prepare(`
    UPDATE rapid_factory_attempts
      SET status='failed',finished_at=CURRENT_TIMESTAMP,error=?
      WHERE id=? AND status='running'
  `).bind(clean(error), attemptId).run();
}

export async function getLatestFactoryAttempt(env: Env, jobId: string, phase?: RapidFactoryPhase) {
  await ensureFactoryExecutionSchema(env);
  if (phase) {
    return env.DB.prepare(`
      SELECT id,job_id,phase,attempt,status,started_at,finished_at,error,metadata_json
        FROM rapid_factory_attempts WHERE job_id=? AND phase=? ORDER BY attempt DESC LIMIT 1
    `).bind(jobId, phase).first<any>();
  }
  return env.DB.prepare(`
    SELECT id,job_id,phase,attempt,status,started_at,finished_at,error,metadata_json
      FROM rapid_factory_attempts WHERE job_id=? ORDER BY started_at DESC,attempt DESC LIMIT 1
  `).bind(jobId).first<any>();
}

export async function planFactoryResume(env: Env, jobId: string, currentPhase: string, status: string) {
  await ensureFactoryExecutionSchema(env);
  const rows = await env.DB.prepare(`
    SELECT phase,MAX(attempt) AS attempt,
      MAX(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
      MAX(CASE WHEN status='running' THEN 1 ELSE 0 END) AS running
    FROM rapid_factory_attempts WHERE job_id=? GROUP BY phase
  `).bind(jobId).all<any>();
  const attempts = new Map((rows.results || []).map((row) => [row.phase, row]));
  const current = phaseIndex(currentPhase);
  const plan = RAPID_FACTORY_PHASES.map((phase, index) => {
    const row = attempts.get(phase);
    const completed = Number(row?.completed || 0) === 1;
    const running = Number(row?.running || 0) === 1;
    let action: 'skip' | 'resume' | 'run' = completed ? 'skip' : running ? 'resume' : 'run';
    if (status === 'handover_ready' && phase !== 'handover') action = 'skip';
    return { phase, index, action, attempt: Number(row?.attempt || 0), behind_current: index < current };
  });
  const next = plan.find((item) => item.action !== 'skip') || null;
  return { job_id: jobId, current_phase: currentPhase, resume_from: next?.phase || null, plan };
}

export async function recoverFactoryPhase(env: Env, jobId: string, currentPhase: string, status: string) {
  const plan = await planFactoryResume(env, jobId, currentPhase, status);
  if (!plan.resume_from) return { action: 'none' as const, plan };
  const phase = plan.resume_from as RapidFactoryPhase;
  const latest = await getLatestFactoryAttempt(env, jobId, phase);
  if (latest?.status === 'running') {
    return {
      action: 'resume' as const,
      phase,
      attempt_id: latest.id,
      attempt: latest.attempt,
      checkpoint: JSON.parse(latest.metadata_json || '{}'),
      plan,
    };
  }
  const attempt = await startFactoryAttempt(env, jobId, phase, { recovered: true, resumed_at: new Date().toISOString() });
  return { action: 'start' as const, phase, attempt_id: attempt.id, attempt: attempt.attempt, checkpoint: {}, plan };
}
