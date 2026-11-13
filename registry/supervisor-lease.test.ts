import {strict as assert} from 'node:assert';
import {claimSupervisorLease,heartbeatSupervisorLease,finishSupervisorLease,recoverExpiredSupervisorLeases,type SupervisorLease} from './supervisor-store';
import type {D1Database,D1Statement} from './d1-store';

type Row=Record<string,any>;
class FakeStatement implements D1Statement {
  private values:unknown[]=[];
  constructor(private db:FakeDb,private sql:string){}
  bind(...values:unknown[]){this.values=values;return this;}
  async first<T=unknown>():Promise<T|null>{return this.db.first<T>(this.sql,this.values);}
  async all<T=unknown>():Promise<{results:T[]}>{return this.db.all<T>(this.sql,this.values);}
  async run():Promise<unknown>{return this.db.run(this.sql,this.values);}
}
class FakeDb implements D1Database {
  jobs:Row[]=[{id:'job-a',worker_id:'builder',status:'queued',risk:'low',human_gate:null,attempts:0}];
  leases:Row[]=[]; attempts:Row[]=[]; events:Row[]=[];
  prepare(sql:string){return new FakeStatement(this,sql);}
  async first<T>(sql:string,v:unknown[]):Promise<T|null>{
    if(sql.includes('FROM supervisor_jobs'))return (this.jobs.find(x=>x.id===v[0]) as T)||null;
    if(sql.includes('FROM supervisor_execution_leases'))return (this.leases.find(x=>x.job_id===v[0]&&x.worker_id===v[1]&&x.lease_token_hash===v[2]&&x.expires_at>v[3]) as T)||null;
    return null;
  }
  async all<T>(sql:string,v:unknown[]):Promise<{results:T[]}>{
    if(sql.includes('FROM supervisor_execution_leases'))return {results:this.leases.filter(x=>x.expires_at<=v[0]) as T[]};
    return {results:[]};
  }
  async run(sql:string,v:unknown[]):Promise<unknown>{
    if(sql.includes('INSERT INTO supervisor_execution_leases')){
      const job=this.jobs.find(x=>x.id===v[8]&&x.worker_id===v[9]&&x.status==='queued'&&x.risk!=='high'&&!x.human_gate);
      const old=this.leases.find(x=>x.job_id===v[0]);
      if(!job|| (old&&old.expires_at>v[10]))return {meta:{changes:0}};
      const row={job_id:v[0],worker_id:v[1],lease_token_hash:v[2],leased_at:v[3],expires_at:v[4],heartbeat_at:v[5],attempt:v[6],idempotency_key:v[7]};
      if(old)Object.assign(old,row);else this.leases.push(row);
      return {meta:{changes:1}};
    }
    if(sql.includes("UPDATE supervisor_jobs SET status='running'")){
      const job=this.jobs.find(x=>x.id===v[1]&&x.status==='queued'&&x.worker_id===v[2]&&x.risk!=='high'&&!x.human_gate);
      if(!job)return {meta:{changes:0}};job.status='running';job.attempts++;return {meta:{changes:1}};
    }
    if(sql.includes('UPDATE supervisor_execution_leases SET heartbeat_at')){
      const lease=this.leases.find(x=>x.job_id===v[2]&&x.worker_id===v[3]&&x.lease_token_hash===v[4]&&x.expires_at>v[5]);
      if(!lease)return {meta:{changes:0}};lease.heartbeat_at=v[0];lease.expires_at=v[1];return {meta:{changes:1}};
    }
    if(sql.includes("UPDATE supervisor_jobs SET status=?,updated_at=?,evidence_json=?")){
      const job=this.jobs.find(x=>x.id===v[3]&&x.status==='running');if(!job)return {meta:{changes:0}};job.status=v[0];return {meta:{changes:1}};
    }
    if(sql.includes('DELETE FROM supervisor_execution_leases')){const before=this.leases.length;this.leases=this.leases.filter(x=>!(x.job_id===v[0]&&(!v[1]||x.lease_token_hash===v[1])&&(!v[1]||true)));return {meta:{changes:before-this.leases.length}};}
    if(sql.includes('UPDATE supervisor_jobs SET status=?,updated_at=? WHERE id=?')){const job=this.jobs.find(x=>x.id===v[2]&&x.status==='running');if(!job)return {meta:{changes:0}};job.status=v[0];return {meta:{changes:1}};}
    if(sql.includes('INSERT INTO supervisor_execution_attempts')){this.attempts.push({values:v});return {meta:{changes:1}};}
    if(sql.includes('UPDATE supervisor_execution_attempts')){return {meta:{changes:1}};}
    if(sql.includes('INSERT INTO supervisor_job_events')){this.events.push({values:v});return {meta:{changes:1}};}
    return {meta:{changes:1}};
  }
}
async function main(){
 const db=new FakeDb();
 const lease=await claimSupervisorLease(db,'job-a','builder','idem-1',60);
 assert.ok(lease);assert.equal(db.jobs[0].status,'running');
 const duplicate=await claimSupervisorLease(db,'job-a','builder','idem-2',60);
 assert.equal(duplicate,null,'active lease must block a second worker');
 assert.equal(await heartbeatSupervisorLease(db,lease!,60),true);
 assert.equal(await finishSupervisorLease(db,lease!,'verified',{checks:['contract']}),true);
 assert.equal(db.jobs[0].status,'verified');
 assert.equal(db.leases.length,0);
 const expiredDb=new FakeDb();
 const expired=await claimSupervisorLease(expiredDb,'job-a','builder','idem-expired',15);
 assert.ok(expired);
 expiredDb.leases[0].expires_at='2000-01-01T00:00:00.000Z';
 const recovery=await recoverExpiredSupervisorLeases(expiredDb,3);
 assert.deepEqual(recovery,{requeued:1,failed:0});
 assert.equal(expiredDb.jobs[0].status,'queued');
 const gatedDb=new FakeDb();gatedDb.jobs[0].human_gate='production_deploy';
 assert.equal(await claimSupervisorLease(gatedDb,'job-a','builder','gated'),null);
 console.log('supervisor lease tests: ok (claim exclusivity, heartbeat, finish, expiry recovery, human gate)');
}
void main();
