import {D1Database,D1Statement} from './d1-store';

export type SupervisorStatus='queued'|'running'|'verified'|'completed'|'failed'|'blocked';
export type SupervisorJob={id:string;workerId:string;input:unknown;status:SupervisorStatus;attempts:number;priority:number;risk:'low'|'medium'|'high';gate?:string;source?:string;createdAt:string;updatedAt:string;evidence?:unknown;lastError?:string};

const stmt=(db:D1Database,sql:string,...values:unknown[]):D1Statement=>db.prepare(sql).bind(...values);

export class WorkerJobStore{
 constructor(private db:D1Database){}
 async init(){await this.db.prepare(`CREATE TABLE IF NOT EXISTS worker_jobs(id TEXT PRIMARY KEY,worker_id TEXT NOT NULL,input_json TEXT NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,priority INTEGER NOT NULL DEFAULT 50,risk TEXT NOT NULL,gate TEXT,source TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,evidence_json TEXT,last_error TEXT)`).run();}
 async put(job:SupervisorJob){await stmt(this.db,`INSERT INTO worker_jobs(id,worker_id,input_json,status,attempts,priority,risk,gate,source,created_at,updated_at,evidence_json,last_error) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,attempts=excluded.attempts,updated_at=excluded.updated_at,evidence_json=excluded.evidence_json,last_error=excluded.last_error`,job.id,job.workerId,JSON.stringify(job.input),job.status,job.attempts,job.priority,job.risk,job.gate||null,job.source||null,job.createdAt,job.updatedAt,job.evidence===undefined?null:JSON.stringify(job.evidence),job.lastError||null).run();}
 async get(id:string){const r=await stmt(this.db,'SELECT * FROM worker_jobs WHERE id=?',id).first<Record<string,unknown>>();return r?this.map(r):undefined;}
 async list(status?:SupervisorStatus){const r=status?await stmt(this.db,'SELECT * FROM worker_jobs WHERE status=? ORDER BY priority ASC,created_at ASC',status).all<Record<string,unknown>>():await this.db.prepare('SELECT * FROM worker_jobs ORDER BY priority ASC,created_at ASC').all<Record<string,unknown>>();return r.results.map(x=>this.map(x));}
 async counts(){const r=await this.db.prepare('SELECT status,COUNT(*) AS count FROM worker_jobs GROUP BY status').all<{status:SupervisorStatus;count:number}>();return Object.fromEntries(r.results.map(x=>[x.status,Number(x.count)]));}
 private map(r:Record<string,unknown>):SupervisorJob{return{id:String(r.id),workerId:String(r.worker_id),input:JSON.parse(String(r.input_json||'{}')),status:r.status as SupervisorStatus,attempts:Number(r.attempts),priority:Number(r.priority),risk:r.risk as SupervisorJob['risk'],gate:r.gate?String(r.gate):undefined,source:r.source?String(r.source):undefined,createdAt:String(r.created_at),updatedAt:String(r.updated_at),evidence:r.evidence_json?JSON.parse(String(r.evidence_json)):undefined,lastError:r.last_error?String(r.last_error):undefined};}
}
