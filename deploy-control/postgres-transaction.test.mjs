import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { authenticateDeploymentRequest } from "./authorization.mjs";
import { createDeployment } from "./lifecycle.mjs";
import { transitionDeploymentAtomically } from "./transaction.mjs";
import { createPostgresTransactionRunner } from "./postgres-adapter.mjs";

const databaseUrl = process.env.DEPLOY_TEST_DATABASE_URL;
const resource = Object.freeze({
  tenantId: "tenant-1",
  applicationId: "app-1",
  environmentId: "staging"
});
const commit = "a".repeat(40);
const evidence = { source_commit: commit, policy_passed: true };

async function makePrincipal(tenantId = resource.tenantId) {
  const issuedAt = Math.floor(Date.now() / 1000) - 5;
  const expiresAt = issuedAt + 600;
  return authenticateDeploymentRequest({
    authorization: "Bearer postgres-test-token",
    issuer: "https://identity.example.invalid",
    audience: "izakhono-deploy",
    now: Date.now(),
    verifyAccessToken: async () => ({
      iss: "https://identity.example.invalid",
      aud: "izakhono-deploy",
      iat: issuedAt,
      nbf: issuedAt,
      exp: expiresAt,
      jti: "postgres-test-session",
      sub: "operator-1",
      tenant_id: tenantId,
      application_ids: [resource.applicationId],
      environment_ids: [resource.environmentId],
      scopes: ["deploy:write", "deploy:approve"]
    }),
    verifyActiveSession: async ({ jti, subject, tenantId: tid }) => ({
      active: true, jti, subject, tenantId: tid, expiresAt
    })
  });
}

test("PostgreSQL adapter commits state, FORTRESS audit and idempotency atomically", {
  skip: !databaseUrl
}, async () => {
  const { Pool } = await import("pg");
  const admin = new Pool({ connectionString: databaseUrl });
  let pool;
  try {
    await admin.query("DROP SCHEMA IF EXISTS deploy_test CASCADE");
    await admin.query("CREATE SCHEMA deploy_test");
    pool = new Pool({
      connectionString: databaseUrl,
      options: "-c search_path=deploy_test,public",
      max: 5
    });
    const schema = await readFile(new URL("./test-support/postgres-schema.sql", import.meta.url), "utf8");
    await pool.query(schema);

    let connectionCount = 0;
    const countedPool = {
      connect: async () => {
        connectionCount += 1;
        return pool.connect();
      }
    };
    const withTransaction = createPostgresTransactionRunner(countedPool);
    const principal = await makePrincipal();

    async function seed(deploymentId, tenantId = resource.tenantId) {
      const record = createDeployment({
        deploymentId,
        applicationId: resource.applicationId,
        sourceCommit: commit,
        createdAt: new Date().toISOString()
      });
      const metadata = {
        tenant_id: tenantId,
        application_id: resource.applicationId,
        environment_id: resource.environmentId,
        deploy_control: { record, idempotency: {} }
      };
      await pool.query(
        `INSERT INTO izakhono_runtime_deployments
          (deployment_id, workload, state, metadata)
         VALUES ($1, 'web-application', 'CREATED', $2::jsonb)`,
        [deploymentId, JSON.stringify(metadata)]
      );
    }

    const run = (deploymentId, idempotencyKey, requestEvidence = evidence, requestResource = resource) =>
      transitionDeploymentAtomically({
        principal,
        resource: requestResource,
        deploymentId,
        idempotencyKey,
        nextState: "VALIDATED",
        evidence: requestEvidence,
        withTransaction,
        now: () => new Date()
      });

    await seed("dep-1");
    const beforeConnections = connectionCount;
    const first = await run("dep-1", "key-1");
    assert.equal(connectionCount - beforeConnections, 1, "one transaction must acquire exactly one PostgreSQL client");
    assert.equal(first.deployment.state, "VALIDATED");
    assert.equal(first.replayed, false);

    const persisted = await pool.query(
      "SELECT metadata FROM izakhono_runtime_deployments WHERE deployment_id = $1",
      ["dep-1"]
    );
    const metadata = persisted.rows[0].metadata;
    assert.equal(metadata.deploy_control.record.state, "VALIDATED");
    assert.equal(Object.keys(metadata.deploy_control.idempotency).length, 1);

    const audit = await pool.query(
      "SELECT tenant_id, job_id, operation_id, event_type, actor, state, data FROM fortress_audit_events WHERE job_id = $1",
      ["dep-1"]
    );
    assert.equal(audit.rowCount, 1);
    assert.equal(audit.rows[0].tenant_id, resource.tenantId);
    assert.equal(audit.rows[0].event_type, "deployment.transition");
    assert.equal(audit.rows[0].state, "VALIDATED");
    assert.equal(audit.rows[0].data.application_id, resource.applicationId);

    const replay = await run("dep-1", "key-1");
    assert.equal(replay.replayed, true);
    assert.deepEqual(replay.deployment, first.deployment);
    assert.equal((await pool.query("SELECT 1 FROM fortress_audit_events WHERE job_id = $1", ["dep-1"])).rowCount, 1);

    await assert.rejects(
      run("dep-1", "key-1", { source_commit: commit, policy_passed: false }),
      error => error?.code === "IDEMPOTENCY_CONFLICT"
    );
    assert.equal((await pool.query("SELECT 1 FROM fortress_audit_events WHERE job_id = $1", ["dep-1"])).rowCount, 1);

    await seed("dep-concurrent");
    const concurrent = await Promise.all([
      run("dep-concurrent", "same-key"),
      run("dep-concurrent", "same-key")
    ]);
    assert.equal(concurrent.filter(item => item.replayed === false).length, 1);
    assert.equal(concurrent.filter(item => item.replayed === true).length, 1);
    assert.equal((await pool.query("SELECT 1 FROM fortress_audit_events WHERE job_id = $1", ["dep-concurrent"])).rowCount, 1);

    await seed("dep-cross-tenant", "tenant-2");
    await assert.rejects(
      run("dep-cross-tenant", "cross-key"),
      error => error?.code === "DEPLOYMENT_NOT_FOUND"
    );
    assert.equal((await pool.query("SELECT 1 FROM fortress_audit_events WHERE job_id = $1", ["dep-cross-tenant"])).rowCount, 0);

    await seed("dep-audit-fail");
    await assert.rejects(run("dep-audit-fail", "audit-key"), /test audit append failure/);
    const rolledBack = await pool.query(
      "SELECT metadata FROM izakhono_runtime_deployments WHERE deployment_id = $1",
      ["dep-audit-fail"]
    );
    assert.equal(rolledBack.rows[0].metadata.deploy_control.record.state, "DISCOVERED");
    assert.deepEqual(rolledBack.rows[0].metadata.deploy_control.idempotency, {});
    assert.equal((await pool.query("SELECT 1 FROM fortress_audit_events WHERE job_id = $1", ["dep-audit-fail"])).rowCount, 0);
  } finally {
    if (pool) await pool.end();
    await admin.query("DROP SCHEMA IF EXISTS deploy_test CASCADE");
    await admin.end();
  }
});
