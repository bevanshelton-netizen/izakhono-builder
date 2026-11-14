import assert from "node:assert/strict";
import { jarvisWorkforceRoute } from "./workforce";

function req(method: string, path: string, body?: unknown) {
  return new Request("https://builder.example" + path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function main() {
  let reads = 0;
  let writes = 0;
  let stepStatus: "pending" | "in_progress" | "completed" = "pending";
  let approvalRequired = true;
  const env = {
    DB: {
      prepare(sql: string) {
        return {
          bind(..._values: unknown[]) {
            return {
              async all() {
                reads++;
                if (sql.includes("SELECT s.id,s.run_id,s.position")) return { results: [
                  { id: "lease-1", status: "in_progress", assigned_agent: "coordinator", owner_verification: null },
                  { id: "review-1", status: "completed", assigned_agent: "reporting", owner_verification: "pending" },
                  { id: "done-1", status: "completed", assigned_agent: "reporting", owner_verification: "verified" },
                ] };
                return { results: [] };
              },
              async first() {
                reads++;
                if (sql.includes("SELECT s.id,s.run_id,s.title")) {
                  return { id: "stp1", run_id: "orc1", attempts: 0, max_attempts: 3 };
                }
                return {
                  id: "stp1",
                  run_id: "orc1",
                  assigned_agent: "reporting",
                  status: stepStatus,
                  attempts: 1,
                  max_attempts: 3,
                  evidence_json: '{"evidence":"Internal validation report saved"}',
                  owner_verification: "pending",
                  approval_required: approvalRequired ? 1 : 0,
                };
              },
              async run() {
                writes++;
                if (sql.includes("SET approval_required=0")) approvalRequired = false;
                if (sql.includes("SET status='completed'")) stepStatus = "completed";
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };

  assert.equal(
    (await jarvisWorkforceRoute(req("GET", "/api/jarvis/workforce"), env, async () => false))?.status,
    401,
  );
  assert.equal(reads, 0);
  const dashboardResponse = await jarvisWorkforceRoute(req("GET", "/api/jarvis/workforce"), env, async () => true);
  assert.equal(dashboardResponse?.status, 200);
  const dashboard = await dashboardResponse!.json() as any;
  assert.deepEqual(dashboard.metrics, {
    scope: "visible_steps_only",
    visible_steps: 3,
    by_status: { in_progress: 1, completed: 2 },
    by_agent: { coordinator: 1, reporting: 2 },
    by_owner_verification: { not_applicable: 1, pending: 1, verified: 1 },
    active_leases: 1,
    awaiting_owner_review: 1,
    limit: 200,
  });
  assert.equal(
    (await jarvisWorkforceRoute(req("POST", "/api/jarvis/workforce/claim", { agent_id: "intruder" }), env, async () => true))?.status,
    400,
  );
  assert.equal(
    (await jarvisWorkforceRoute(req("POST", "/api/jarvis/workforce/claim", { agent_id: "reporting" }), env, async () => true))?.status,
    200,
  );
  assert.equal(
    (await jarvisWorkforceRoute(req("POST", "/api/jarvis/workforce/steps/stp1/approve", { reason: "short" }), env, async () => true))?.status,
    400,
  );
  assert.equal(
    (await jarvisWorkforceRoute(req("POST", "/api/jarvis/workforce/steps/stp1/approve", { reason: "Approved after owner risk review" }), env, async () => true))?.status,
    200,
  );
  stepStatus = "in_progress";
  assert.equal(
    (await jarvisWorkforceRoute(req("POST", "/api/jarvis/workforce/steps/stp1/complete", { agent_id: "reporting", evidence: "x" }), env, async () => true))?.status,
    400,
  );
  assert.equal(
    (await jarvisWorkforceRoute(req("POST", "/api/jarvis/workforce/steps/stp1/complete", { agent_id: "reporting", evidence: "Internal validation report saved" }), env, async () => true))?.status,
    200,
  );
  assert.equal(
    (await jarvisWorkforceRoute(req("POST", "/api/jarvis/workforce/steps/stp1/review", { decision: "verify" }), env, async () => true))?.status,
    200,
  );
  assert.equal(
    (await jarvisWorkforceRoute(req("POST", "/api/jarvis/workforce/steps/stp1/fail", { agent_id: "coordinator", error: "blocked" }), env, async () => true))?.status,
    409,
  );
  assert.equal(
    (await jarvisWorkforceRoute(req("POST", "/api/jarvis/workforce/steps/stp1/approve", { reason: "Approved after owner risk review" }), env, async () => true))?.status,
    409,
  );
  assert.ok(writes > 0);
  console.log("J.A.R.V.I.S. workforce queue and owner review tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
