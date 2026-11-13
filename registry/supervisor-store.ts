import {D1Database} from './d1-store';
import {evaluateWorkerPolicy} from './workers';

export type SupervisorStatus='queued'|'running'|'verified'|'completed'|'blocked'|'failed';
export type SupervisorRisk='low'|'medium'|'high';
export type SupervisorJob={
  id:string; source:string; sourceId:string; title:string; workerId:string;
  priority:number; risk:SupervisorRisk; status:SupervisorStatus;
  dependencyIds:string[]; humanGate?:string; attempts:number;
  input:unknown; evidence:unknown; createdAt:string; updatedAt:string;
};

const TABLES=`
CREATE TABLE IF NOT EXISTS supervisor_jobs (
 id TEXT PRIMARY KEY, source TEXT NOT NULL, source_id TEXT NOT NULL, title TEXT NOT NULL,
 worker_id TEXT NOT NULL, priority INTEGER NOT NULL, risk TEXT NOT NULL,
 status TEXT NOT NULL, dependency_ids_json TEXT NOT NULL DEFAULT '[]',
 human_gate TEXT, attempts INTEGER NOT NULL DEFAULT 0, input_json TEXT NOT NULL DEFAULT '{}',
 evidence_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(source,source_id)
);
CREATE INDEX IF NOT EXISTS idx_supervisor_jobs_status_priority ON supervisor_jobs(status,priority);
CREATE TABLE IF NOT EXISTS supervisor_job_events (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL, at TEXT NOT NULL, from_status TEXT,
 to_status TEXT NOT NULL, actor TEXT NOT NULL, detail_json TEXT NOT NULL DEFAULT '{}'
);
`;

const splitSql=(sql:string)=>sql.split(';').map(s=>s.trim()).filter(Boolean);
const parse=(v:unknown,fallback:unknown)=>{try{return JSON.parse(String(v??''))}catch{return fallback}};

export async function ensureSupervisorSchema(db:D1Database){for(const sql of splitSql(TABLES))await db.prepare(sql).run();}

export async function upsertSupervisorJob(db:D1Database,job:SupervisorJob){
 await db.prepare(`INSERT INTO supervisor_jobs(id,source,source_id,title,worker_id,priority,risk,status,dependency_ids_json,human_gate,attempts,input_json,evidence_json,created_at,updated_at)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
 ON CONFLICT(source,source_id) DO UPDATE SET title=excluded.title,worker_id=excluded.worker_id,priority=excluded.priority,risk=excluded.risk,dependency_ids_json=excluded.dependency_ids_json,human_gate=excluded.human_gate,input_json=excluded.input_json,updated_at=excluded.updated_at`).bind(
  job.id,job.source,job.sourceId,job.title,job.workerId,job.priority,job.risk,job.status,JSON.stringify(job.dependencyIds),job.humanGate??null,job.attempts,JSON.stringify(job.input),JSON.stringify(job.evidence),job.createdAt,job.updatedAt
 ).run();
}

export async function transitionSupervisorJob(db:D1Database,id:string,to:SupervisorStatus,actor:string,detail:unknown={}){
 const current=await db.prepare('SELECT status,attempts FROM supervisor_jobs WHERE id=?').bind(id).first<{status:SupervisorStatus;attempts:number}>();
 if(!current)throw new Error(`Unknown supervisor job: ${id}`);
 const allowed:Record<SupervisorStatus,SupervisorStatus[]>={queued:['running','blocked'],running:['verified','failed','blocked'],verified:['completed','failed'],completed:[],blocked:['queued','running'],failed:['queued']};
 if(!allowed[current.status].includes(to))throw new Error(`Invalid supervisor transition ${current.status} -> ${to}`);
 const attempts=to==='running'?Number(current.attempts||0)+1:Number(current.attempts||0);
 const at=new Date().toISOString();
 await db.prepare('UPDATE supervisor_jobs SET status=?,attempts=?,updated_at=? WHERE id=?').bind(to,attempts,at,id).run();
 await db.prepare('INSERT INTO supervisor_job_events(id,job_id,at,from_status,to_status,actor,detail_json) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,at,current.status,to,actor,JSON.stringify(detail)).run();
 return {id,status:to,attempts,updatedAt:at};
}

export async function recordEvidence(db:D1Database,id:string,evidence:unknown){
 const at=new Date().toISOString();
 await db.prepare('UPDATE supervisor_jobs SET evidence_json=?,updated_at=? WHERE id=?').bind(JSON.stringify(evidence),at,id).run();
}

export async function listSupervisorJobs(db:D1Database,status?:SupervisorStatus){
 const q=status?'SELECT * FROM supervisor_jobs WHERE status=? ORDER BY priority DESC,created_at ASC':'SELECT * FROM supervisor_jobs ORDER BY priority DESC,created_at ASC';
 const r=status?await db.prepare(q).bind(status).all<Record<string,unknown>>():await db.prepare(q).all<Record<string,unknown>>();
 return r.results.map(x=>({id:String(x.id),source:String(x.source),sourceId:String(x.source_id),title:String(x.title),workerId:String(x.worker_id),priority:Number(x.priority),risk:x.risk as SupervisorRisk,status:x.status as SupervisorStatus,dependencyIds:parse(x.dependency_ids_json,[]),humanGate:x.human_gate?String(x.human_gate):undefined,attempts:Number(x.attempts),input:parse(x.input_json,{}),evidence:parse(x.evidence_json,{}),createdAt:String(x.created_at),updatedAt:String(x.updated_at)} as SupervisorJob));
}

export async function supervisorCounts(db:D1Database){
 const r=await db.prepare('SELECT status,COUNT(*) as count FROM supervisor_jobs GROUP BY status').all<{status:SupervisorStatus;count:number}>();
 const counts={queued:0,running:0,verified:0,completed:0,blocked:0,failed:0};
 for(const row of r.results)counts[row.status]=Number(row.count); return counts;
}

export type SupervisorLease = {
  jobId: string; workerId: string; leaseToken: string;
  expiresAt: string; attempt: number; idempotencyKey: string;
};

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Atomically reserves a queued, non-gated job. The lease row is the claim
 * authority: the conditional UPSERT succeeds only if no live lease exists.
 * A second worker racing for the same job receives changes=0.
 */
export async function claimSupervisorLease(
  db: D1Database,
  jobId: string,
  workerId: string,
  idempotencyKey: string,
  leaseSeconds = 90,
): Promise<SupervisorLease | null> {
  if (!jobId.trim() || !workerId.trim() || !idempotencyKey.trim()) throw new Error('jobId, workerId and idempotencyKey are required');
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 15 || leaseSeconds > 900) throw new Error('leaseSeconds must be between 15 and 900');
  const at = new Date();
  const leasedAt = at.toISOString();
  const expiresAt = new Date(at.getTime() + leaseSeconds * 1000).toISOString();
  const leaseToken = crypto.randomUUID() + crypto.randomUUID();
  const tokenHash = await sha256(leaseToken);
  const job = await db.prepare(
    "SELECT id, worker_id, status, risk, human_gate, attempts FROM supervisor_jobs WHERE id=?"
  ).bind(jobId).first<{id:string;worker_id:string;status:SupervisorStatus;risk:SupervisorRisk;human_gate:string|null;attempts:number}>();
  if (!job) throw new Error('Unknown supervisor job');
  if (job.worker_id !== workerId) throw new Error('Worker does not own this job');
  const policy = evaluateWorkerPolicy(workerId, job.risk, job.human_gate || undefined);
  if (!policy.allowed) return null;
  if (job.status !== 'queued') return null;
  const result = await db.prepare(`
    INSERT INTO supervisor_execution_leases(job_id,worker_id,lease_token_hash,leased_at,expires_at,heartbeat_at,attempt,idempotency_key)
    SELECT ?,?,?,?,?,?,?,?
    WHERE EXISTS (
      SELECT 1 FROM supervisor_jobs
      WHERE id=? AND status='queued' AND worker_id=? AND risk!='high' AND human_gate IS NULL
    )
    ON CONFLICT(job_id) DO UPDATE SET
      worker_id=excluded.worker_id,
      lease_token_hash=excluded.lease_token_hash,
      leased_at=excluded.leased_at,
      expires_at=excluded.expires_at,
      heartbeat_at=excluded.heartbeat_at,
      attempt=excluded.attempt,
      idempotency_key=excluded.idempotency_key
    WHERE supervisor_execution_leases.expires_at <= ?
  `).bind(jobId,workerId,tokenHash,leasedAt,expiresAt,leasedAt,Number(job.attempts)+1,idempotencyKey,jobId,workerId,leasedAt).run() as {meta?:{changes?:number}};
  if (result.meta?.changes !== 1) return null;
  const update = await db.prepare(
    "UPDATE supervisor_jobs SET status='running', attempts=attempts+1, updated_at=? WHERE id=? AND status='queued' AND worker_id=? AND risk!='high' AND human_gate IS NULL"
  ).bind(leasedAt,jobId,workerId).run() as {meta?:{changes?:number}};
  if (update.meta?.changes !== 1) {
    await db.prepare('DELETE FROM supervisor_execution_leases WHERE job_id=? AND lease_token_hash=?').bind(jobId,tokenHash).run();
    return null;
  }
  await db.prepare("INSERT INTO supervisor_execution_attempts(id,job_id,worker_id,attempt,outcome,detail_json,started_at) VALUES(?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),jobId,workerId,Number(job.attempts)+1,'running',JSON.stringify({idempotencyKey}),leasedAt).run();
  await db.prepare("INSERT INTO supervisor_job_events(id,job_id,at,from_status,to_status,actor,detail_json) VALUES(?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),jobId,leasedAt,'queued','running',workerId,JSON.stringify({leaseExpiresAt:expiresAt,idempotencyKey})).run();
  return {jobId,workerId,leaseToken,expiresAt,attempt:Number(job.attempts)+1,idempotencyKey};
}

export async function heartbeatSupervisorLease(db:D1Database, lease:SupervisorLease, leaseSeconds=90): Promise<boolean> {
  const at = new Date();
  const nowIso = at.toISOString();
  const expiresAt = new Date(at.getTime()+leaseSeconds*1000).toISOString();
  const hash = await sha256(lease.leaseToken);
  const result = await db.prepare(
    'UPDATE supervisor_execution_leases SET heartbeat_at=?,expires_at=? WHERE job_id=? AND worker_id=? AND lease_token_hash=? AND expires_at>?'
  ).bind(nowIso,expiresAt,lease.jobId,lease.workerId,hash,nowIso).run() as {meta?:{changes?:number}};
  return result.meta?.changes === 1;
}

export async function finishSupervisorLease(
  db:D1Database, lease:SupervisorLease, outcome:'verified'|'failed'|'blocked', detail:unknown
):Promise<boolean>{
  const at=new Date().toISOString();
  const hash=await sha256(lease.leaseToken);
  const owned=await db.prepare('SELECT job_id FROM supervisor_execution_leases WHERE job_id=? AND worker_id=? AND lease_token_hash=? AND expires_at>?')
    .bind(lease.jobId,lease.workerId,hash,at).first<{job_id:string}>();
  if(!owned)return false;
  const current=await db.prepare('SELECT status FROM supervisor_jobs WHERE id=?').bind(lease.jobId).first<{status:SupervisorStatus}>();
  if(!current || current.status!=='running')return false;
  const updated=await db.prepare('UPDATE supervisor_jobs SET status=?,updated_at=?,evidence_json=? WHERE id=? AND status=\'running\'')
    .bind(outcome,at,JSON.stringify(detail),lease.jobId).run() as {meta?:{changes?:number}};
  if(updated.meta?.changes!==1)return false;
  await db.prepare('UPDATE supervisor_execution_attempts SET outcome=?,detail_json=?,finished_at=? WHERE job_id=? AND attempt=? AND outcome=\'running\'')
    .bind(outcome,JSON.stringify(detail),at,lease.jobId,lease.attempt).run();
  await db.prepare('INSERT INTO supervisor_job_events(id,job_id,at,from_status,to_status,actor,detail_json) VALUES(?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),lease.jobId,at,'running',outcome,lease.workerId,JSON.stringify(detail)).run();
  await db.prepare('DELETE FROM supervisor_execution_leases WHERE job_id=? AND lease_token_hash=?').bind(lease.jobId,hash).run();
  return true;
}

/** Requeue only expired, ungated jobs below the retry ceiling; otherwise fail closed. */
export async function recoverExpiredSupervisorLeases(db:D1Database,maxAttempts=3):Promise<{requeued:number;failed:number}>{
  const at=new Date().toISOString();
  const expired=await db.prepare('SELECT l.job_id,l.worker_id,l.attempt FROM supervisor_execution_leases l WHERE l.expires_at<=?').bind(at).all<{job_id:string;worker_id:string;attempt:number}>();
  let requeued=0,failed=0;
  for(const lease of expired.results){
    const target=Number(lease.attempt)<maxAttempts?'queued':'failed';
    const updated=await db.prepare("UPDATE supervisor_jobs SET status=?,updated_at=? WHERE id=? AND status='running' AND risk!='high' AND human_gate IS NULL")
      .bind(target,at,lease.job_id).run() as {meta?:{changes?:number}};
    if(updated.meta?.changes===1){
      const outcome=target==='queued'?'lease_expired_requeued':'lease_expired_retry_limit';
      await db.prepare("UPDATE supervisor_execution_attempts SET outcome=?,detail_json=?,finished_at=? WHERE job_id=? AND attempt=? AND outcome='running'")
        .bind(outcome,JSON.stringify({reason:'worker lease expired'}),at,lease.job_id,lease.attempt).run();
      await db.prepare('INSERT INTO supervisor_job_events(id,job_id,at,from_status,to_status,actor,detail_json) VALUES(?,?,?,?,?,?,?)')
        .bind(crypto.randomUUID(),lease.job_id,at,'running',target,'lease-reaper',JSON.stringify({attempt:lease.attempt})).run();
      if(target==='queued')requeued++;else failed++;
    }
    await db.prepare('DELETE FROM supervisor_execution_leases WHERE job_id=? AND expires_at<=?').bind(lease.job_id,at).run();
  }
  return {requeued,failed};
}
