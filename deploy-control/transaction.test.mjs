import test from "node:test";
import assert from "node:assert/strict";
import {
  authenticateDeploymentRequest,
  DeploymentAuthorizationError
} from "./authorization.mjs";
import {
  transitionDeploymentAtomically,
  DeploymentTransactionError
} from "./transaction.mjs";
import { createDeployment } from "./lifecycle.mjs";

const commit = "a".repeat(40);
const resource = Object.freeze({ tenantId: "tenant-1", applicationId: "app-1", environmentId: "staging" });
const baseRecord = () => createDeployment({
  deploymentId: "dep-1", applicationId: resource.applicationId,
  sourceCommit: commit, createdAt: "2026-11-24T06:00:00.000Z"
});
const validationEvidence = { source_commit: commit, policy_passed: true };

async function principal(scopes = ["deploy:write", "deploy:approve"], tenantId = resource.tenantId) {
  return authenticateDeploymentRequest({
    authorization: "Bearer test-token",
    issuer: "https://identity.example.invalid",
    audience: "izakhono-deploy",
    now: Date.parse("2026-11-24T06:00:00.000Z"),
    verifyAccessToken: async () => ({
      iss: "https://identity.example.invalid",
      aud: "izakhono-deploy",
      iat: 1795500000,
      nbf: 1795500000,
      exp: 1795500600,
      jti: "session-1",
      sub: "operator-1",
      tenant_id: tenantId,
      application_ids: [resource.applicationId],
      environment_ids: [resource.environmentId],
      scopes
    }),
    verifyActiveSession: async ({ jti, subject, tenantId: tid, expiresAt }) => ({
      active: true, jti, subject, tenantId: tid, expiresAt
    })
  });
}

class FakeDatabase {
  constructor(record = baseRecord()) {
    this.state = {
      record,
      claims: new Map(),
      audits: [],
      commits: 0,
      rollbacks: 0,
      txHandles: []
    };
    this.failAudit = false;
  }

  async withTransaction(work) {
    const working = {
      record: this.state.record,
      claims: new Map(this.state.claims),
      audits: [...this.state.audits]
    };
    const tx = {
      claimIdempotency: async ({ tenantId, deploymentId, idempotencyKey, requestHash }) => {
        const key = [tenantId, deploymentId, idempotencyKey].join(":");
        const existing = working.claims.get(key);
        if (existing) {
          if (existing.requestHash !== requestHash) return { status: "conflict" };
          return { status: "replay", requestHash: existing.requestHash, response: existing.response };
        }
        const claimId = "claim-" + (working.claims.size + 1);
        working.claims.set(key, { claimId, requestHash, response: null });
        return { status: "claimed", claimId };
      },
      lockDeployment: async ({ deploymentId, tenantId, applicationId, environmentId }) => ({
        record: working.record.deployment_id === deploymentId ? working.record : null,
        resource: working.record.deployment_id === deploymentId
          ? { tenantId, applicationId, environmentId } : null
      }),
      saveDeployment: async ({ deployment }) => { working.record = deployment; },
      appendAudit: async ({ event }) => {
        if (this.failAudit) throw new Error("audit store unavailable");
        working.audits.push(event);
      },
      completeIdempotency: async ({ claimId, response }) => {
        const entry = [...working.claims.values()].find(item => item.claimId === claimId);
        assert.ok(entry);
        entry.response = response;
      }
    };
    this.state.txHandles.push(tx);
    try {
      const result = await work(tx);
      this.state.record = working.record;
      this.state.claims = working.claims;
      this.state.audits = working.audits;
      this.state.commits += 1;
      return result;
    } catch (error) {
      this.state.rollbacks += 1;
      throw error;
    }
  }
}

const run = (db, auth, overrides = {}) => transitionDeploymentAtomically({
  principal: auth,
  resource,
  deploymentId: "dep-1",
  idempotencyKey: "request-1",
  nextState: "VALIDATED",
  evidence: validationEvidence,
  withTransaction: db.withTransaction.bind(db),
  now: () => new Date("2026-11-24T06:00:01.000Z"),
  ...overrides
});

test("commits state, idempotency result and audit through the same transaction handle", async () => {
  const db = new FakeDatabase();
  const auth = await principal();
  const result = await run(db, auth);
  assert.equal(result.deployment.state, "VALIDATED");
  assert.equal(result.replayed, false);
  assert.equal(db.state.commits, 1);
  assert.equal(db.state.rollbacks, 0);
  assert.equal(db.state.audits.length, 1);
  assert.equal(db.state.claims.size, 1);
  assert.equal(new Set(db.state.txHandles).size, 1);
});

test("returns the exact prior result for an identical idempotent replay", async () => {
  const db = new FakeDatabase();
  const auth = await principal();
  const first = await run(db, auth);
  const replay = await run(db, auth, { now: () => new Date("2026-11-24T06:05:00.000Z") });
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.deployment, first.deployment);
  assert.equal(db.state.commits, 2);
  assert.equal(db.state.audits.length, 1);
});

test("rejects reuse of an idempotency key with a different request body", async () => {
  const db = new FakeDatabase();
  const auth = await principal();
  await run(db, auth);
  await assert.rejects(
    run(db, auth, { evidence: { source_commit: commit, policy_passed: false } }),
    error => error instanceof DeploymentTransactionError && error.code === "IDEMPOTENCY_CONFLICT"
  );
  assert.equal(db.state.audits.length, 1);
  assert.equal(db.state.rollbacks, 1);
});

test("rejects cross-tenant access before opening a database transaction", async () => {
  const db = new FakeDatabase();
  const auth = await principal(["deploy:write"], "tenant-2");
  await assert.rejects(
    run(db, auth),
    error => error instanceof DeploymentAuthorizationError && error.code === "TENANT_FORBIDDEN"
  );
  assert.equal(db.state.commits, 0);
  assert.equal(db.state.txHandles.length, 0);
});

test("rolls back deployment, idempotency and audit work when audit append fails", async () => {
  const db = new FakeDatabase();
  db.failAudit = true;
  const auth = await principal();
  await assert.rejects(run(db, auth), /audit store unavailable/);
  assert.equal(db.state.record.state, "DISCOVERED");
  assert.equal(db.state.claims.size, 0);
  assert.equal(db.state.audits.length, 0);
  assert.equal(db.state.rollbacks, 1);
});

test("rolls back a claim when the scoped deployment row is absent", async () => {
  const db = new FakeDatabase();
  db.state.record = createDeployment({
    deploymentId: "other-deployment", applicationId: resource.applicationId,
    sourceCommit: commit, createdAt: "2026-11-24T06:00:00.000Z"
  });
  const auth = await principal();
  await assert.rejects(
    run(db, auth),
    error => error instanceof DeploymentTransactionError && error.code === "DEPLOYMENT_NOT_FOUND"
  );
  assert.equal(db.state.claims.size, 0);
  assert.equal(db.state.rollbacks, 1);
});

test("requires approval scope for the APPROVED transition", async () => {
  const db = new FakeDatabase();
  const auth = await principal(["deploy:write"]);
  await assert.rejects(
    run(db, auth, { nextState: "APPROVED", evidence: {} }),
    error => error instanceof DeploymentAuthorizationError && error.code === "SCOPE_FORBIDDEN"
  );
  assert.equal(db.state.txHandles.length, 0);
});

test("rejects secret-bearing evidence before any database transaction", async () => {
  const db = new FakeDatabase();
  const auth = await principal();
  await assert.rejects(
    run(db, auth, { evidence: { source_commit: commit, policy_passed: true, nested: { access_token: "never-store" } } }),
    error => error?.code === "SECRET_EVIDENCE_REJECTED"
  );
  assert.equal(db.state.txHandles.length, 0);
});
