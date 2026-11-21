import assert from "node:assert/strict";
import { Pool } from "pg";
import { createJarvisPostgresAdapter } from "./db.mjs";
import { jarvisWorkforceRoute } from "../src/workforce.ts";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false, max: 2 });
const db = createJarvisPostgresAdapter(pool);
const env = { DB: db };
const runId = "jarvis-pg-it-" + crypto.randomUUID();
const stepId = "jarvis-pg-step-" + crypto.randomUUID();

async function call(path, body) {
  return jarvisWorkforceRoute(
    new Request("http://jarvis.test" + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    env,
    async () => true,
  );
}

async function main() {
  try {
    await db.prepare(
      "INSERT INTO jarvis_orchestration_runs(id,instruction,objective,agent_id,status,risk_level) VALUES(?,?,?,?,?,?)",
    ).bind(runId, "CI integration", "Verify PostgreSQL route adapter", "coordinator", "planned", "low").run();
    await db.prepare(
      "INSERT INTO jarvis_orchestration_steps(id,run_id,position,title,description,assigned_agent,depends_on_json,status,approval_required) VALUES(?,?,?,?,?,?,?,?,?)",
    ).bind(stepId, runId, 1, "PostgreSQL integration", "Exercise claim, complete and owner review", "coordinator", "[]", "pending", 0).run();

    const claim = await call("/api/jarvis/workforce/claim", { agent_id: "coordinator" });
    assert.equal(claim.status, 200);
    const claimed = await claim.json();
    assert.equal(claimed.claimed, true);
    assert.equal(claimed.step.id, stepId);

    const complete = await call("/api/jarvis/workforce/steps/" + stepId + "/complete", {
      agent_id: "coordinator",
      evidence: "PostgreSQL-backed route integration passed.",
    });
    assert.equal(complete.status, 200);
    assert.equal((await complete.json()).status, "completed");

    const review = await call("/api/jarvis/workforce/steps/" + stepId + "/review", {
      decision: "verify",
      note: "Integration evidence verified by CI owner-review test.",
    });
    assert.equal(review.status, 200);
    assert.equal((await review.json()).owner_verification, "verified");

    const persisted = await db.prepare(
      "SELECT status,owner_verification FROM jarvis_orchestration_steps WHERE id=?",
    ).bind(stepId).first();
    assert.equal(persisted.status, "completed");
    assert.equal(persisted.owner_verification, "verified");
    console.log("J.A.R.V.I.S. PostgreSQL workforce integration passed");
  } finally {
    await db.prepare("DELETE FROM jarvis_orchestration_steps WHERE id=?").bind(stepId).run();
    await db.prepare("DELETE FROM jarvis_orchestration_runs WHERE id=?").bind(runId).run();
    await pool.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
