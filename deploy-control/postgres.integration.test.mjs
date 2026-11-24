import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createPostgresTransactionRunner } from "./postgres-adapter.mjs";
import { authenticateDeploymentRequest } from "./authorization.mjs";
import { createDeployment } from "./lifecycle.mjs";
import { transitionDeploymentAtomically } from "./transaction.mjs";

const connectionString = process.env.DEPLOY_TEST_DATABASE_URL;
const enabled = Boolean(connectionString);
let pool;
let withTransaction;
const resource = Object.freeze({ tenantId: "tenant-a", applicationId: "app-a", environmentId: "staging" });
const sourceCommit = "b".repeat(40);
const evidence = { source_commit: sourceCommit, policy_passed: true };

async function principal() {
  const iat = Math.floor(Date.now() / 1000) - 5;
  const exp = iat + 600;
  return authenticateDeploymentRequest({
    authorization: "Bearer integration-test-token",
    issuer: "https://identity.integration.invalid",
    audience: "izakhono-deploy",
    now: Date.now(),
    verifyAccessToken: async () => ({
      iss: "https://identity.integration.invalid", aud: "izakhono-deploy",
      iat, nbf: iat, exp, jti: "integration-session-" + randomUUID(),
      sub: "integration-operator", tenant_id: resource.tenantId,
      application_ids: [resource.applicationId], environment_ids: [resource.environmentId],
      scopes: ["deploy:write", "deploy:approve"]
    }),
    verifyActiveSession: async ({ jti, subject, tenantId }) => ({
      active: true, jti, subject, tenantId, expiresAt: exp
    })
  });
}

async function seed(deploymentId = "deployment-" + randomUUID(), scope = resource) {
  const record = createDeployment({
    deploymentId, applicationId: scope.applicationId,
    sourceCommit, createdAt: "2026-11-24T06:00:00.000Z"
  });
  const metadata = {
    tenant_id: scope.tenantId,
    application_id: scope.applicationId,
    environment_id: scope.environmentId,
    deploy_control: { record, idempotency: {} }
  };
  await pool.query(
    `INSERT INTO izakhono_runtime_deployments
      (deployment_id, workload, state, metadata)
     VALUES ($1, $2, 'DISCOVERED', $3::jsonb)`,
    [deploymentId, scope.applicationId, JSON.stringify(metadata)]
  );
  return deploymentId;
}

async function run(auth, deploymentId, key, overrides = {}) {
  return transitionDeploymentAtomically({
    principal: auth, resource, deploymentId, idempotencyKey: key,
    nextState: "VALIDATED", evidence, withTransaction,
    now: () => new Date("2026-11-24T06:00:01.000Z"),
    ...overrides
  });
}

before(async () => {
  if (!enabled) return;
  const parsed = new URL(connectionString);
  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) ||
      parsed.pathname !== "/deploy_control_test") {
    throw new Error("DEPLOY_TEST_DATABASE_URL must target a local disposable database named deploy_control_test.");
  }
  pool = new pg.Pool({ connectionString, max: 12 });
  await pool.query(`CREATE TABLE IF NOT EXISTS izakhono_runtime_deployments (
    deployment_id text PRIMARY KEY, workload text NOT NULL, state text NOT NULL,
    node text, checkpoint text, attempts integer NOT NULL DEFAULT 0,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS fortress_audit_events (
    event_id text PRIMARY KEY, job_id text NOT NULL, tenant_id text NOT NULL,
    operation_id text NOT NULL, event_type text NOT NULL, actor text NOT NULL,
    adapter text, state text NOT NULL, observed_at timestamptz NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (job_id, operation_id, event_type)
  )`);
  withTransaction = createPostgresTransactionRunner(pool);
});

beforeEach(async () => {
  if (!enabled) return;
  await pool.query("TRUNCATE fortress_audit_events, izakhono_runtime_deployments");
});

after(async () => {
  if (pool) await pool.end();
});

const integration = (name, fn) => test(name, { skip: !enabled }, fn);

integration("commits Runtime Fabric state, idempotency result and FORTRESS audit together", async () => {
  const auth = await principal(), id = await seed();
  const result = await run(auth, id, "atomic-1");
  assert.equal(result.deployment.state, "VALIDATED");
  const row = await pool.query(
    "SELECT metadata->'deploy_control'->'record'->>'state' AS state, (SELECT count(*)::int FROM jsonb_object_keys(metadata->'deploy_control'->'idempotency')) AS keys FROM izakhono_runtime_deployments WHERE deployment_id = $1",
    [id]
  );
  assert.equal(row.rows[0].state, "VALIDATED");
  assert.equal(row.rows[0].keys, 1);
  const audit = await pool.query("SELECT count(*)::int AS n, min(actor) AS actor FROM fortress_audit_events WHERE job_id = $1", [id]);
  assert.equal(audit.rows[0].n, 1);
  assert.equal(audit.rows[0].actor, "integration-operator");
});

integration("returns the committed result for exact replay without duplicating audit", async () => {
  const auth = await principal(), id = await seed(), key = "replay-1";
  const first = await run(auth, id, key);
  const replay = await run(auth, id, key);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.deployment, first.deployment);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM fortress_audit_events WHERE job_id = $1", [id])).rows[0].n, 1);
});

integration("rejects a conflicting request hash for an already-used key", async () => {
  const auth = await principal(), id = await seed(), key = "conflict-1";
  await run(auth, id, key);
  await assert.rejects(
    run(auth, id, key, { evidence: { source_commit: sourceCommit, policy_passed: false } }),
    { code: "IDEMPOTENCY_CONFLICT" }
  );
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM fortress_audit_events WHERE job_id = $1", [id])).rows[0].n, 1);
});

integration("rolls back Runtime Fabric state and idempotency metadata when FORTRESS audit append fails", async () => {
  const auth = await principal(), id = await seed(), key = "rollback-1";
  await pool.query(`CREATE FUNCTION reject_deploy_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected audit failure'; END $$`);
  await pool.query("CREATE TRIGGER reject_deploy_audit BEFORE INSERT ON fortress_audit_events FOR EACH ROW EXECUTE FUNCTION reject_deploy_audit()");
  await assert.rejects(run(auth, id, key), /injected audit failure/);
  const row = await pool.query(
    "SELECT metadata->'deploy_control'->'record'->>'state' AS state, metadata->'deploy_control'->'idempotency' AS idem FROM izakhono_runtime_deployments WHERE deployment_id = $1",
    [id]
  );
  assert.equal(row.rows[0].state, "DISCOVERED");
  assert.deepEqual(row.rows[0].idem, {});
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM fortress_audit_events")).rows[0].n, 0);
  await pool.query("DROP TRIGGER reject_deploy_audit ON fortress_audit_events");
  await pool.query("DROP FUNCTION reject_deploy_audit()");
});

integration("serializes concurrent identical requests to one transition and one audit event", async () => {
  const auth = await principal(), id = await seed(), key = "concurrent-same-1";
  const results = await Promise.all([run(auth, id, key), run(auth, id, key)]);
  assert.equal(results.filter(result => result.replayed === false).length, 1);
  assert.equal(results.filter(result => result.replayed === true).length, 1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM fortress_audit_events WHERE job_id = $1", [id])).rows[0].n, 1);
});

integration("rejects concurrent conflicting requests without a second mutation", async () => {
  const auth = await principal(), id = await seed(), key = "concurrent-conflict-1";
  const results = await Promise.allSettled([
    run(auth, id, key),
    run(auth, id, key, { evidence: { source_commit: sourceCommit, policy_passed: false } })
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected" && result.reason.code === "IDEMPOTENCY_CONFLICT").length, 1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM fortress_audit_events WHERE job_id = $1", [id])).rows[0].n, 1);
});

integration("enforces tenant, application and environment scope in the Runtime Fabric row lookup", async () => {
  const auth = await principal();
  const id = await seed("deployment-" + randomUUID(), { ...resource, environmentId: "production" });
  await assert.rejects(run(auth, id, "scope-1"), { code: "DEPLOYMENT_NOT_FOUND" });
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM fortress_audit_events")).rows[0].n, 0);
});
