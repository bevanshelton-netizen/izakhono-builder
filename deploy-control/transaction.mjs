/**
 * Transaction coordinator for IZAKHONO DEPLOY state transitions.
 *
 * This module deliberately contains no database schema or driver. The injected
 * withTransaction adapter must provide ONE database transaction/connection for
 * the idempotency claim, deployment row lock/write, and immutable audit append.
 * It must commit only after the callback resolves and roll back on every error.
 *
 * This is an executable transaction contract, not a production database adapter.
 * Do not wire it to a production DSN until the Runtime Fabric database owner,
 * migration authority, and environment binding are verified.
 */
import { createHash } from "node:crypto";
import { authorizeDeploymentAccess } from "./authorization.mjs";
import { transitionDeployment } from "./lifecycle.mjs";

export class DeploymentTransactionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DeploymentTransactionError";
    this.code = code;
  }
}

const nonEmpty = value => typeof value === "string" && value.trim().length > 0;

function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object" ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new DeploymentTransactionError("REQUEST_NOT_JSON", "The deployment request must contain only plain JSON values.");
  }
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (["__proto__", "prototype", "constructor"].includes(key)) {
      throw new DeploymentTransactionError("REQUEST_KEY_INVALID", "The deployment request contains a prohibited object key.");
    }
    if (/(secret|token|password|authorization|private.?key|credential)/i.test(key)) {
      throw new DeploymentTransactionError("SECRET_EVIDENCE_REJECTED", "Secret or credential material must never enter a deployment request.");
    }
    result[key] = canonicalize(value[key]);
  }
  return result;
}

function hashRequest(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function assertTransactionAdapter(tx) {
  const required = ["claimIdempotency", "lockDeployment", "saveDeployment", "appendAudit", "completeIdempotency"];
  if (!tx || required.some(name => typeof tx[name] !== "function")) {
    throw new DeploymentTransactionError("TRANSACTION_ADAPTER_INVALID",
      "The transaction must expose idempotency, row-lock, deployment-write and audit operations.");
  }
}

function assertScope(locked, requested) {
  const actual = locked?.resource;
  if (!locked?.record || !actual ||
      actual.tenantId !== requested.tenantId ||
      actual.applicationId !== requested.applicationId ||
      actual.environmentId !== requested.environmentId) {
    // Do not reveal whether a deployment exists in another tenant or environment.
    throw new DeploymentTransactionError("DEPLOYMENT_NOT_FOUND", "The deployment was not found in the authorized resource scope.");
  }
}

/**
 * Execute one authorized lifecycle transition.
 *
 * Resource identifiers are locators, not authority: authorization is checked
 * against the verified principal before any database operation. The adapter
 * must scope lockDeployment to all four resource identifiers and use a row lock.
 */
export async function transitionDeploymentAtomically({
  principal,
  resource,
  deploymentId,
  idempotencyKey,
  nextState,
  evidence,
  withTransaction,
  now = () => new Date()
} = {}) {
  if (typeof withTransaction !== "function") {
    throw new DeploymentTransactionError("TRANSACTION_RUNNER_REQUIRED", "A trusted single-connection transaction runner is required.");
  }
  if (!nonEmpty(deploymentId) || !nonEmpty(idempotencyKey) || idempotencyKey.length > 256) {
    throw new DeploymentTransactionError("REQUEST_IDENTITY_INVALID", "Deployment ID and an idempotency key of at most 256 characters are required.");
  }
  if (!resource || !nonEmpty(resource.tenantId) || !nonEmpty(resource.applicationId) ||
      !nonEmpty(resource.environmentId)) {
    throw new DeploymentTransactionError("RESOURCE_SCOPE_REQUIRED", "Tenant, application and environment resource scope are required.");
  }

  const action = nextState === "APPROVED" ? "approve" : "mutate";
  authorizeDeploymentAccess(principal, resource, action);

  const requestHash = hashRequest({
    deploymentId,
    resource,
    nextState,
    evidence,
    actor: principal.subject
  });

  return withTransaction(async tx => {
    assertTransactionAdapter(tx);
    // Lock and verify the persisted resource before claiming idempotency.
    // This also lets the PostgreSQL adapter keep the small idempotency ledger
    // inside the existing deployment row without a second table.
    const locked = await tx.lockDeployment({ deploymentId, ...resource });
    assertScope(locked, resource);

    const claim = await tx.claimIdempotency({
      tenantId: resource.tenantId,
      deploymentId,
      idempotencyKey,
      requestHash
    });

    if (!claim || !["claimed", "replay", "conflict"].includes(claim.status)) {
      throw new DeploymentTransactionError("IDEMPOTENCY_ADAPTER_INVALID", "The idempotency adapter returned an invalid claim result.");
    }
    if (claim.status === "conflict") {
      throw new DeploymentTransactionError("IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different deployment request.");
    }
    if (claim.status === "replay") {
      if (claim.requestHash !== requestHash || !claim.response) {
        throw new DeploymentTransactionError("IDEMPOTENCY_REPLAY_INVALID", "The prior idempotency result is incomplete or does not match this request.");
      }
      return Object.freeze({ ...claim.response, replayed: true });
    }
    if (!nonEmpty(claim.claimId)) {
      throw new DeploymentTransactionError("IDEMPOTENCY_CLAIM_INVALID", "A newly claimed idempotency record must return its claim ID.");
    }

    const timestamp = now();
    const at = timestamp instanceof Date ? timestamp.toISOString() : String(timestamp);
    if (!Number.isFinite(Date.parse(at))) {
      throw new DeploymentTransactionError("TIMESTAMP_INVALID", "The transaction timestamp must be a valid ISO-compatible timestamp.");
    }

    const updated = transitionDeployment(locked.record, nextState, evidence, {
      actor: principal.subject,
      at,
      idempotencyKey
    });
    const transition = updated.history[updated.history.length - 1];
    const auditEvent = Object.freeze({
      eventId: "deploy-" + requestHash,
      tenantId: resource.tenantId,
      applicationId: resource.applicationId,
      environmentId: resource.environmentId,
      deploymentId,
      actor: principal.subject,
      eventType: "deployment.transition",
      fromState: transition.from,
      toState: transition.to,
      observedAt: at,
      idempotencyKey,
      requestHash,
      evidence: transition.evidence
    });
    const response = Object.freeze({
      deployment: updated,
      auditEventId: auditEvent.eventId,
      requestHash
    });

    // Every call below receives the same tx object; adapters must not open or
    // commit independent connections from these methods.
    await tx.saveDeployment({ resource, deployment: updated });
    await tx.appendAudit({ event: auditEvent });
    await tx.completeIdempotency({ claimId: claim.claimId, response });
    return Object.freeze({ ...response, replayed: false });
  });
}
