import test, { after, before } from "node:test";
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
let schema;
let withTransaction;
const resource = Object.freeze({ tenantId: "tenant-a", applicationId: "app-a", environmentId: "staging" });
const sourceCommit = "b".repeat(40);
const evidence = { source_commit: sourceCommit, policy_passed: true };
const qualified = name => '"' + schema + '"."' + name + '"';

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
  await pool.query(
    `INSERT INTO ${qualified("deployment_records")}
      (deployment_id, tenant_id, application_id, environment_id, record)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [deploymentId, scope.tenantId, scope.applicationId, scope.environmentId, JSON.stringify(record)]
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
  schema = "deploy_test_" + randomUUID().replaceAll("-", "");
  await pool.query(`CREATE SCHEMA "${schema}"`);
  await pool.query(`CREATE TABLE ${qualified("deployment_records")} (
    deployment_id text PRIMARY KEY, tenant_id text NOT NULL, application_id text NOT NULL,
    environment_id text NOT NULL, record jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, application_id, environment_id, deployment_id)
  )`);
  await pool.query(`CREATE TABLE ${qualified("idempotency_claims")} (
    tenant_id text NOT NULL, deployment_id text NOT NULL, idempotency_key text NOT NULL,
    request_hash text NOT NULL, claim_id uuid NOT NULL UNIQUE, response jsonb,
    created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
    PRIMARY KEY (tenant_id, deployment_id, idempotency_key)
  )`);
  await pool.query(`CREATE TABLE ${qualified("audit_events")} (
    event_id text PRIMARY KEY, tenant_id text NOT NULL, application_id text NOT NULL,
    environment_id text NOT NULL, deployment_id text NOT NULL, actor text NOT NULL,
    event_type text NOT NULL, event jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
  )`);
  withTransaction = createPostgresTransactionRunner(pool, { schema });
});

after(async () => {
  if (pool) {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
  }
});

const integration = (name, fn) => test(name, { skip: !enabled }, fn);

integration("persists deployment state, idempotency result and audit in one PostgreSQL transaction", async () => {
  const auth = await principal(), id = await seed();
  const result = await run(auth, id, "atomic-1");
  assert.equal(result.deployment.state, "VALIDATED");
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${qualified("audit_events")}`)).rows[0].n, 1);
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${qualified("idempotency_claims")} WHERE response IS NOT NULL`)).rows[0].n, 1);
});

integration("returns the committed result for exact replay without duplicating audit", async () => {
  const auth = await principal(), id = await seed(), key = "replay-1";
  const first = await run(auth, id, key);
  const replay = await run(auth, id, key);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.deployment, first.deployment);
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${qualified("audit_events")}`)).rows[0].n, 1);
});

integration("rejects a conflicting request hash for an already-used key", async () => {
  const auth = await principal(), id = await seed(), key = "conflict-1";
  await run(auth, id, key);
  await assert.rejects(run(auth, id, key, { evidence: { source_commit: sourceCommit, policy_passed: false } }), { code: "IDEMPOTENCY_CONFLICT" });
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${qualified("audit_events")}`)).rows[0].n, 1);
});

integration("rolls back deployment, claim and audit when audit insertion fails", async () => {
  const auth = await principal(), id = await seed(), key = "rollback-1";
  await pool.query(`CREATE FUNCTION "${schema}".reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected audit failure'; END $$`);
  await pool.query(`CREATE TRIGGER reject_audit BEFORE INSERT ON ${qualified("audit_events")} FOR EACH ROW EXECUTE FUNCTION "${schema}".reject_audit()`);
  await assert.rejects(run(auth, id, key), /injected audit failure/);
  const record = await pool.query(`SELECT record->>'state' AS state FROM ${qualified("deployment_records")} WHERE deployment_id = $1`, [id]);
  assert.equal(record.rows[0].state, "DISCOVERED");
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${qualified("idempotency_claims")} WHERE idempotency_key = $1`, [key])).rows[0].n, 0);
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${qualified("audit_events")}`)).rows[0].n, 0);
  await pool.query(`DROP TRIGGER reject_audit ON ${qualified("audit_events")}`);
  await pool.query(`DROP FUNCTION "${schema}".reject_audit()`);
});

integration("serializes concurrent identical claims to one transition and one audit event", async () => {
  const auth = await principal(), id = await seed(), key = "concurrent-same-1";
  const results = await Promise.all([run(auth, id, key), run(auth, id, key)]);
  assert.equal(results.filter(result => result.replayed === false).length, 1);
  assert.equal(results.filter(result => result.replayed === true).length, 1);
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${qualified("audit_events")}`)).rows[0].n, 1);
});

integration("rejects concurrent conflicting claims without a second mutation", async () => {
  const auth = await principal(), id = await seed(), key = "concurrent-conflict-1";
  const results = await Promise.allSettled([
    run(auth, id, key),
    run(auth, id, key, { evidence: { source_commit: sourceCommit, policy_passed: false } })
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected" && result.reason.code === "IDEMPOTENCY_CONFLICT").length, 1);
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${qualified("audit_events")}`)).rows[0].n, 1);
});

integration("scopes deployment lookup by tenant, application and environment", async () => {
  const auth = await principal(), id = await seed();
  await assert.rejects(
    run(auth, id, "scope-1", { resource: { ...resource, environmentId: "production" } }),
    { code: "DEPLOYMENT_NOT_FOUND" }
  );
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${qualified("idempotency_claims")}`)).rows[0].n, 0);
});
