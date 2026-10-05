type Stmt = {
  bind(...values: unknown[]): Stmt;
  first<T = any>(): Promise<T | null>;
  run(): Promise<unknown>;
};
type Env = { DB: { prepare(sql: string): Stmt } };

export type FactoryIdempotencyResult =
  | { kind: 'new'; key: string; requestHash: string }
  | { kind: 'replay'; status: number; body: string; key: string }
  | { kind: 'conflict'; key: string; requestHash: string; existingHash: string }
  | { kind: 'in_progress'; key: string; jobId?: string };

function clean(value: unknown, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stable(value[key]);
      return out;
    }, {} as Record<string, any>);
  }
  return value;
}

export async function hashFactoryRequest(payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(stable(payload)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function ensureFactoryIdempotencySchema(env: Env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS rapid_factory_idempotency (
      idempotency_key TEXT PRIMARY KEY,
      request_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      job_id TEXT,
      response_status INTEGER,
      response_body TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

export async function claimFactoryIdempotency(
  env: Env,
  key: string,
  requestHash: string,
): Promise<FactoryIdempotencyResult> {
  const normalized = clean(key, 200);
  if (!normalized) return { kind: 'new', key: '', requestHash };

  await ensureFactoryIdempotencySchema(env);
  await env.DB.prepare(`
    INSERT OR IGNORE INTO rapid_factory_idempotency(idempotency_key,request_hash,status)
    VALUES(?,?,'processing')
  `).bind(normalized, requestHash).run();

  const row = await env.DB.prepare(
    'SELECT idempotency_key,request_hash,status,job_id,response_status,response_body FROM rapid_factory_idempotency WHERE idempotency_key=?'
  ).bind(normalized).first<any>();

  if (!row) return { kind: 'new', key: normalized, requestHash };
  if (row.request_hash !== requestHash) {
    return { kind: 'conflict', key: normalized, requestHash, existingHash: row.request_hash };
  }
  if (row.status === 'completed' && typeof row.response_body === 'string') {
    return { kind: 'replay', status: Number(row.response_status || 200), body: row.response_body, key: normalized };
  }
  return { kind: 'in_progress', key: normalized, jobId: clean(row.job_id, 120) || undefined };
}

export async function bindFactoryIdempotencyJob(env: Env, key: string, jobId: string) {
  if (!key) return;
  await env.DB.prepare(`
    UPDATE rapid_factory_idempotency
      SET job_id=?,updated_at=CURRENT_TIMESTAMP
      WHERE idempotency_key=?
  `).bind(jobId, key).run();
}

export async function completeFactoryIdempotency(
  env: Env,
  key: string,
  status: number,
  body: string,
) {
  if (!key) return;
  await env.DB.prepare(`
    UPDATE rapid_factory_idempotency
      SET status='completed',response_status=?,response_body=?,updated_at=CURRENT_TIMESTAMP
      WHERE idempotency_key=?
  `).bind(status, body.slice(0, 1000000), key).run();
}
