import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { executeLeasedSupervisorJob } from "./worker-executor";
import type { D1Database, D1Statement } from "./d1-store";
import type { SupervisorLease } from "./supervisor-store";

class Statement implements D1Statement {
  values: unknown[] = [];
  constructor(private db: FakeDb, private sql: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  first<T>() { return this.db.first<T>(this.sql, this.values); }
  all<T>() { return this.db.all<T>(this.sql, this.values); }
  run() { return this.db.run(this.sql, this.values); }
}
class FakeDb implements D1Database {
  job: any = { id:"job-1", source:"test", source_id:"1", title:"Test build", worker_id:"build-worker", priority:1, risk:"low", status:"running", dependency_ids_json:"[]", human_gate:null, attempts:1, input_json:"{}", evidence_json:"{}", created_at:"now", updated_at:"now" };
  leaseHash = createHash("sha256").update("secret-token").digest("hex");
  prepare(sql:string) { return new Statement(this, sql); }
  async all<T>(sql:string):Promise<{results:T[]}> {
    if (sql.includes("FROM supervisor_jobs")) return {results:[this.job] as T[]};
    return {results:[]};
  }
  async first<T>(sql:string, values:unknown[]):Promise<T|null> {
    if (sql.includes("FROM supervisor_execution_leases")) {
      if (values[0] === "job-1" && values[1] === "build-worker" && values[2] === this.leaseHash) return {job_id:"job-1"} as T;
    }
    if (sql.includes("FROM supervisor_jobs")) return {status:this.job.status} as T;
    return null;
  }
  async run(sql:string, values:unknown[]) {
    if (sql.includes("UPDATE supervisor_execution_leases SET heartbeat_at")) return {meta:{changes:1}};
    if (sql.includes("UPDATE supervisor_jobs SET status=?,updated_at=?,evidence_json=?")) {
      this.job.status = values[0]; this.job.evidence_json = values[2]; return {meta:{changes:1}};
    }
    return {meta:{changes:1}};
  }
}
const lease:SupervisorLease = {jobId:"job-1",workerId:"build-worker",leaseToken:"secret-token",expiresAt:"2099-01-01T00:00:00.000Z",attempt:1,idempotencyKey:"idem-1"};
async function main() {
  const db = new FakeDb();
  const success = await executeLeasedSupervisorJob(db, lease, {
    "build-worker": async (_job, context) => {
      assert.equal(context.idempotencyKey,"idem-1");
      return {summary:"Build validated",checks:[{name:"typecheck",passed:true,detail:"No type errors"}]};
    }
  });
  assert.equal(success.ok,true);
  assert.equal(db.job.status,"verified");
  const failedDb = new FakeDb();
  const failed = await executeLeasedSupervisorJob(failedDb, lease, {
    "build-worker": async () => ({summary:"Tests failed",checks:[{name:"tests",passed:false,detail:"One assertion failed"}]})
  });
  assert.equal(failed.ok,false);
  assert.equal(failedDb.job.status,"failed");
  const missingDb = new FakeDb();
  const missing = await executeLeasedSupervisorJob(missingDb, lease, {});
  assert.equal(missing.outcome,"blocked");
  const thrownDb = new FakeDb();
  const thrown = await executeLeasedSupervisorJob(thrownDb, lease, {
    "build-worker": async () => { throw new Error("processor crash"); }
  });
  assert.equal(thrown.outcome,"failed");
  console.log("worker executor tests: ok (verified evidence, failed checks, missing handler, handler exception)");
}
void main();
