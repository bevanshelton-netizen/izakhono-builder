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
