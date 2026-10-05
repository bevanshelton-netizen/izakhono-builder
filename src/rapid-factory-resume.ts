type Stmt = {
  bind(...values: unknown[]): Stmt;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
};

type Env = { DB: { prepare(sql: string): Stmt } };

export const RAPID_FACTORY_RESUMABLE_PHASES = [
  'intake',
  'architecture',
  'content',
  'brand',
  'build',
  'integration',
  'validation',
  'release_candidate',
  'deployment_verification',
  'handover',
] as const;

export type RapidFactoryResumablePhase = typeof RAPID_FACTORY_RESUMABLE_PHASES[number];
export type RapidFactoryAttemptStatus = 'running' | 'completed' | 'failed' | 'cancelled';

function id(prefix: string) {
  return prefix + '_' + crypto.randomUUID().replaceAll('-', '');
}

function phaseIndex(phase: string) {
  return RAPID_FACTORY_RESUMABLE_PHASES.indexOf(phase as RapidFactoryResumablePhase);
}

export async function ensureRapidFactoryAttemptSchema(env: Env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS rapid_factory_attempts (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      attempt INTEGER NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      error TEXT,
      checkpoint_json TEXT NOT NULL DEFAULT '{}',
      UNIQUE(job_id, phase, attempt)
    )
  `).run();
}

export async function beginRapidFactoryAttempt(env: Env, jobId: string, phase: RapidFactoryResumablePhase) {
  await ensureRapidFactoryAttemptSchema(env);
  const row = await env.DB.prepare(
    'SELECT COALESCE(MAX(attempt),0) AS last_attempt FROM rapid_factory_attempts WHERE job_id=? AND phase=?'
  ).bind(jobId, phase).first<{ last_attempt: number }>();
  const attempt = Number(row?.last_attempt || 0) + 1;
  const attemptId = id('rfa');
  await env.DB.prepare(`
    INSERT INTO rapid_factory_attempts(id,job_id,phase,attempt,status,checkpoint_json)
    VALUES(?,?,?,?,?,'{}')
  `).bind(attemptId, jobId, phase, attempt, 'running').run();
  return { id: attemptId, jobId, phase, attempt, status: 'running' as const };
}

export async function finishRapidFactoryAttempt(
  env: Env,
  attemptId: string,
  status: Exclude<RapidFactoryAttemptStatus, 'running'>,
  checkpoint: unknown = {},
  error = '',
) {
  await ensureRapidFactoryAttemptSchema(env);
  await env.DB.prepare(`
    UPDATE rapid_factory_attempts
    SET status=?,completed_at=CURRENT_TIMESTAMP,error=?,checkpoint_json=?
    WHERE id=? AND status='running'
  `).bind(status, String(error || '').slice(0, 2000), JSON.stringify(checkpoint ?? {}), attemptId).run();
}

export async function latestRapidFactoryAttempt(env: Env, jobId: string, phase?: RapidFactoryResumablePhase) {
  await ensureRapidFactoryAttemptSchema(env);
  if (phase) {
    return env.DB.prepare(`
      SELECT * FROM rapid_factory_attempts
      WHERE job_id=? AND phase=?
      ORDER BY attempt DESC LIMIT 1
    `).bind(jobId, phase).first<any>();
  }
  return env.DB.prepare(`
    SELECT * FROM rapid_factory_attempts
    WHERE job_id=?
    ORDER BY started_at DESC, attempt DESC LIMIT 1
  `).bind(jobId).first<any>();
}

export async function resumableRapidFactoryPlan(env: Env, jobId: string, currentPhase: string, status: string) {
  await ensureRapidFactoryAttemptSchema(env);
  const current = phaseIndex(currentPhase);
  const rows = await env.DB.prepare(`
    SELECT phase,MAX(attempt) AS attempt,
      MAX(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
      MAX(CASE WHEN status='running' THEN 1 ELSE 0 END) AS running
    FROM rapid_factory_attempts
    WHERE job_id=?
    GROUP BY phase
  `).bind(jobId).all<any>();
  const attempts = new Map((rows.results || []).map((row) => [row.phase, row]));
  const plan = RAPID_FACTORY_RESUMABLE_PHASES.map((phase, index) => {
    const row = attempts.get(phase);
    const completed = Number(row?.completed || 0) === 1;
    const running = Number(row?.running || 0) === 1;
    let action: 'skip' | 'resume' | 'run' | 'blocked' = 'run';
    if (completed) action = 'skip';
    else if (running) action = 'resume';
    else if (index < current) action = 'run';
    if (status === 'handover_ready' && phase !== 'handover') action = 'skip';
    return { phase, index, action, attempt: Number(row?.attempt || 0) };
  });
  const resumeFrom = plan.find((item) => item.action === 'resume' || item.action === 'run') || null;
  return { job_id: jobId, current_phase: currentPhase, resume_from: resumeFrom?.phase || null, plan };
}

export async function recordRapidFactoryCheckpoint(
  env: Env,
  attemptId: string,
  checkpoint: unknown,
) {
  await ensureRapidFactoryAttemptSchema(env);
  await env.DB.prepare(`
    UPDATE rapid_factory_attempts
    SET checkpoint_json=?
    WHERE id=? AND status='running'
  `).bind(JSON.stringify(checkpoint ?? {}), attemptId).run();
}
