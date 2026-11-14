import {D1Database} from './d1-store';

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
 evidence_json TEXT NOT NULL DEFAULT '{}', lease_token TEXT, lease_expires_at TEXT, claimed_by TEXT, event_actor TEXT, event_detail_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
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

export async function ensureSupervisorSchema(db:D1Database){
 for(const sql of splitSql(TABLES))await db.prepare(sql).run();
 for(const sql of ['ALTER TABLE supervisor_jobs ADD COLUMN lease_token TEXT','ALTER TABLE supervisor_jobs ADD COLUMN lease_expires_at TEXT','ALTER TABLE supervisor_jobs ADD COLUMN claimed_by TEXT','ALTER TABLE supervisor_jobs ADD COLUMN event_actor TEXT','ALTER TABLE supervisor_jobs ADD COLUMN event_detail_json TEXT']){try{await db.prepare(sql).run();}catch(error){if(!/duplicate column|already exists/i.test(String(error)))throw error;}}
 await db.prepare(`CREATE TRIGGER IF NOT EXISTS supervisor_job_status_audit AFTER UPDATE OF status ON supervisor_jobs WHEN OLD.status != NEW.status AND NEW.event_actor IS NOT NULL BEGIN INSERT INTO supervisor_job_events(id,job_id,at,from_status,to_status,actor,detail_json) VALUES(lower(hex(randomblob(16))),NEW.id,NEW.updated_at,OLD.status,NEW.status,NEW.event_actor,COALESCE(NEW.event_detail_json,'{}')); END`).run();
}

export async function upsertSupervisorJob(db:D1Database,job:SupervisorJob){
 await db.prepare(`INSERT INTO supervisor_jobs(id,source,source_id,title,worker_id,priority,risk,status,dependency_ids_json,human_gate,attempts,input_json,evidence_json,created_at,updated_at)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
 ON CONFLICT(source,source_id) DO UPDATE SET title=excluded.title,worker_id=excluded.worker_id,priority=excluded.priority,risk=excluded.risk,dependency_ids_json=excluded.dependency_ids_json,human_gate=excluded.human_gate,input_json=excluded.input_json,updated_at=excluded.updated_at`).bind(
  job.id,job.source,job.sourceId,job.title,job.workerId,job.priority,job.risk,job.status,JSON.stringify(job.dependencyIds),job.humanGate??null,job.attempts,JSON.stringify(job.input),JSON.stringify(job.evidence),job.createdAt,job.updatedAt
 ).run();
}

/** Atomic conditional claim; only one concurrent caller can move queued -> running. */
export async function claimSupervisorJob(db:D1Database,id:string,actor:string,leaseMs=120_000){
 const at=new Date();const claimedAt=at.toISOString();const leaseExpiresAt=new Date(at.getTime()+leaseMs).toISOString();const leaseToken=crypto.randomUUID();
 const row=await db.prepare("UPDATE supervisor_jobs SET status='running',attempts=attempts+1,updated_at=?,lease_token=?,lease_expires_at=?,claimed_by=?,event_actor=?,event_detail_json=? WHERE id=? AND status='queued' RETURNING id,status,attempts,updated_at,lease_token,lease_expires_at,claimed_by").bind(claimedAt,leaseToken,leaseExpiresAt,actor,actor,JSON.stringify({leaseExpiresAt,claim:'atomic'}),id).first<{id:string;status:SupervisorStatus;attempts:number;updated_at:string;lease_token:string;lease_expires_at:string;claimed_by:string}>();
 if(!row)return null;
 return {id:row.id,status:row.status,attempts:Number(row.attempts),updatedAt:row.updated_at,leaseToken:row.lease_token,leaseExpiresAt:row.lease_expires_at,claimedBy:row.claimed_by};
}
/** Extend a running lease only when the caller still owns the unexpired token. */
export async function renewSupervisorLease(db:D1Database,id:string,leaseToken:string,leaseMs=120_000){
 const at=new Date();const renewedAt=at.toISOString();const leaseExpiresAt=new Date(at.getTime()+leaseMs).toISOString();
 const result=await db.prepare("UPDATE supervisor_jobs SET lease_expires_at=?,updated_at=? WHERE id=? AND status='running' AND lease_token=? AND lease_expires_at>?").bind(leaseExpiresAt,renewedAt,id,leaseToken,renewedAt).run() as {meta?:{changes?:number}};
 if(Number(result.meta?.changes??0)!==1)throw new Error('Lease renewal rejected: token is stale, expired, or not owned by caller');
 return {id,leaseExpiresAt,renewedAt};
}
/** Record execution evidence only while the caller still owns the active, unexpired lease. */
export async function recordLeasedEvidence(db:D1Database,id:string,leaseToken:string,evidence:unknown){
 const at=new Date().toISOString();
 const result=await db.prepare("UPDATE supervisor_jobs SET evidence_json=?,updated_at=? WHERE id=? AND status='running' AND lease_token=? AND lease_expires_at>?").bind(JSON.stringify(evidence),at,id,leaseToken,at).run() as {meta?:{changes?:number}};
 if(Number(result.meta?.changes??0)!==1)throw new Error('Evidence write rejected: lease token is stale, expired, or not owned by caller');
 return {id,updatedAt:at};
}
/** Fail a job only if the executor still owns the active lease; stale workers cannot fail a reclaimed job. */
export async function failLeasedSupervisorJob(db:D1Database,id:string,leaseToken:string,actor:string,detail:unknown={}){
 const at=new Date().toISOString();
 const result=await db.prepare("UPDATE supervisor_jobs SET status='failed',updated_at=?,lease_token=NULL,lease_expires_at=NULL,claimed_by=NULL,event_actor=?,event_detail_json=? WHERE id=? AND status='running' AND lease_token=? AND lease_expires_at>?").bind(at,actor,JSON.stringify(detail),id,leaseToken,at).run() as {meta?:{changes?:number}};
 if(Number(result.meta?.changes??0)!==1)throw new Error('Failure transition rejected: lease token is stale, expired, or not owned by caller');
 return {id,status:'failed' as const,updatedAt:at};
}
/** Independent QA verification is an atomic compare-and-swap against the active lease. */
export async function verifyLeasedSupervisorJob(db:D1Database,id:string,leaseToken:string,evidence:unknown,actor:string){
 const at=new Date().toISOString();
 const result=await db.prepare("UPDATE supervisor_jobs SET status='verified',evidence_json=?,updated_at=?,lease_token=NULL,lease_expires_at=NULL,claimed_by=NULL,event_actor=?,event_detail_json=? WHERE id=? AND status='running' AND lease_token=? AND lease_expires_at>?").bind(JSON.stringify(evidence),at,actor,JSON.stringify({verification:'independent',leaseBound:true}),id,leaseToken,at).run() as {meta?:{changes?:number}};
 if(Number(result.meta?.changes??0)!==1)throw new Error('Verification rejected: lease token is stale, expired, or not owned by caller');
 return {id,status:'verified' as const,updatedAt:at};
}
/** Requeue expired leases with bounded retries; exhausted jobs move to failed for operator review. */
export async function recoverExpiredSupervisorLeases(db:D1Database,maxAttempts=3,limit=50){
 const at=new Date().toISOString();
 const rows=await db.prepare("UPDATE supervisor_jobs SET status=CASE WHEN attempts>=? THEN 'failed' ELSE 'queued' END,lease_token=NULL,lease_expires_at=NULL,claimed_by=NULL,updated_at=?,event_actor='lease-recovery',event_detail_json=json_object('reason','lease-expired','attempts',attempts,'retryLimit',?,'disposition',CASE WHEN attempts>=? THEN 'dead-letter-review' ELSE 'requeued' END) WHERE id IN (SELECT id FROM supervisor_jobs WHERE status='running' AND lease_expires_at IS NOT NULL AND lease_expires_at<=? ORDER BY priority DESC LIMIT ?) AND status='running' AND lease_expires_at<=? RETURNING id,source,source_id,worker_id,attempts,status").bind(maxAttempts,at,maxAttempts,maxAttempts,at,limit,at).all<{id:string;source:string;source_id:string;worker_id:string;attempts:number;status:SupervisorStatus}>();
 return {recovered:rows.results.filter(x=>x.status==='queued').length,deadLettered:rows.results.filter(x=>x.status==='failed').length,jobIds:rows.results.map(x=>x.id)};
}
export async function transitionSupervisorJob(db:D1Database,id:string,to:SupervisorStatus,actor:string,detail:unknown={}){
 const current=await db.prepare('SELECT status,attempts FROM supervisor_jobs WHERE id=?').bind(id).first<{status:SupervisorStatus;attempts:number}>();
 if(!current)throw new Error(`Unknown supervisor job: ${id}`);
 const allowed:Record<SupervisorStatus,SupervisorStatus[]>={queued:['running','blocked'],running:['verified','failed','blocked'],verified:['completed','failed'],completed:[],blocked:['queued','running'],failed:['queued']};
 if(!allowed[current.status].includes(to))throw new Error(`Invalid supervisor transition ${current.status} -> ${to}`);
 const attempts=to==='running'?Number(current.attempts||0)+1:Number(current.attempts||0);
 const at=new Date().toISOString();
 const result=await db.prepare("UPDATE supervisor_jobs SET status=?,attempts=?,updated_at=?,lease_token=CASE WHEN ?='running' THEN lease_token ELSE NULL END,lease_expires_at=CASE WHEN ?='running' THEN lease_expires_at ELSE NULL END,claimed_by=CASE WHEN ?='running' THEN claimed_by ELSE NULL END,event_actor=?,event_detail_json=? WHERE id=? AND status=?").bind(to,attempts,at,to,to,to,actor,JSON.stringify(detail),id,current.status).run() as {meta?:{changes?:number}};
 if(Number(result.meta?.changes??0)!==1)throw new Error('Supervisor transition rejected: job state changed concurrently');
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

/** Operator read-only dead-letter inspection. Failed jobs remain unchanged until an authorized recovery workflow is implemented. */
export async function listDeadLetterJobs(db:D1Database,limit=50){
 const bounded=Math.min(Math.max(Math.floor(limit),1),100);
 const jobs=await db.prepare("SELECT id,source,source_id,title,worker_id,priority,risk,attempts,input_json,evidence_json,created_at,updated_at FROM supervisor_jobs WHERE status='failed' ORDER BY updated_at DESC LIMIT ?").bind(bounded).all<Record<string,unknown>>();
 const results=[];
 for(const job of jobs.results){
  const events=await db.prepare("SELECT at,from_status,to_status,actor,detail_json FROM supervisor_job_events WHERE job_id=? ORDER BY at ASC").bind(String(job.id)).all<Record<string,unknown>>();
  results.push({id:String(job.id),source:String(job.source),sourceId:String(job.source_id),title:String(job.title),workerId:String(job.worker_id),priority:Number(job.priority),risk:String(job.risk),attempts:Number(job.attempts),input:parse(job.input_json,{}),evidence:parse(job.evidence_json,{}),createdAt:String(job.created_at),updatedAt:String(job.updated_at),events:events.results.map(e=>({at:String(e.at),fromStatus:e.from_status??null,toStatus:String(e.to_status),actor:String(e.actor),detail:parse(e.detail_json,{})}))});
 }
 return {count:results.length,jobs:results};
}

export async function supervisorCounts(db:D1Database){
 const r=await db.prepare('SELECT status,COUNT(*) as count FROM supervisor_jobs GROUP BY status').all<{status:SupervisorStatus;count:number}>();
 const counts={queued:0,running:0,verified:0,completed:0,blocked:0,failed:0};
 for(const row of r.results)counts[row.status]=Number(row.count); return counts;
}
