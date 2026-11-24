/**
 * PostgreSQL transaction adapter for IZAKHONO DEPLOY.
 *
 * Reuses the existing Runtime Fabric deployment row (metadata.deploy_control)
 * and the existing FORTRESS fortress_audit_events table. It creates no tables,
 * runs no DDL, and never opens a second connection inside a transaction.
 *
 * Both tables MUST be on the same approved PostgreSQL database. If the FORTRESS
 * audit table is absent or the database binding is wrong, the operation fails
 * and the Runtime Fabric row update rolls back. Do not use this adapter against
 * production until database ownership, migration authority and DSN binding are
 * verified by the infrastructure owner.
 */
import { createHash } from "node:crypto";

export class PostgresAdapterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PostgresAdapterError";
    this.code = code;
  }
}

const nonEmpty = value => typeof value === "string" && value.trim().length > 0;

function objectValue(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function assertLocked(locked, resource, deploymentId) {
  if (!locked || locked.deploymentId !== deploymentId ||
      locked.resource?.tenantId !== resource.tenantId ||
      locked.resource?.applicationId !== resource.applicationId ||
      locked.resource?.environmentId !== resource.environmentId) {
    throw new PostgresAdapterError("DEPLOYMENT_SCOPE_MISMATCH",
      "A deployment row locked outside the authorized resource scope cannot be changed.");
  }
}

/**
 * Adapt a pg-compatible Pool to the transaction runner expected by
 * transitionDeploymentAtomically. The pool is used only to acquire one client;
 * every operation in the callback uses that exact client until COMMIT/ROLLBACK.
 */
export function createPostgresTransactionRunner(pool) {
  if (!pool || typeof pool.connect !== "function") {
    throw new PostgresAdapterError("POOL_REQUIRED", "A trusted pg Pool with connect() is required.");
  }

  return async function withPostgresTransaction(work) {
    if (typeof work !== "function") {
      throw new PostgresAdapterError("CALLBACK_REQUIRED", "A transaction callback is required.");
    }
    const client = await pool.connect();
    let began = false;
    try {
      await client.query("BEGIN");
      began = true;
      let locked = null;
      let pendingClaim = null;

      const tx = Object.freeze({
        async lockDeployment({ deploymentId, tenantId, applicationId, environmentId }) {
          const result = await client.query(
            `SELECT deployment_id, metadata
               FROM izakhono_runtime_deployments
              WHERE deployment_id = $1
                AND metadata->>'tenant_id' = $2
                AND metadata->>'application_id' = $3
                AND metadata->>'environment_id' = $4
              FOR UPDATE`,
            [deploymentId, tenantId, applicationId, environmentId]
          );
          if (result.rowCount !== 1) {
            locked = null;
            return { record: null, resource: null };
          }
          const metadata = objectValue(result.rows[0].metadata);
          const deployControl = objectValue(metadata.deploy_control);
          const resource = {
            tenantId: metadata.tenant_id,
            applicationId: metadata.application_id,
            environmentId: metadata.environment_id
          };
          locked = { deploymentId, resource, metadata, deployControl };
          return {
            record: objectValue(deployControl.record),
            resource
          };
        },

        async claimIdempotency({ tenantId, deploymentId, idempotencyKey, requestHash }) {
          assertLocked(locked, {
            tenantId,
            applicationId: locked?.resource?.applicationId,
            environmentId: locked?.resource?.environmentId
          }, deploymentId);
          if (!nonEmpty(idempotencyKey) || !/^[a-f0-9]{64}$/.test(requestHash || "")) {
            throw new PostgresAdapterError("IDEMPOTENCY_INPUT_INVALID",
              "A non-empty idempotency key and SHA-256 request hash are required.");
          }
          const keyDigest = createHash("sha256").update(idempotencyKey).digest("hex");
          const idempotency = objectValue(locked.deployControl.idempotency);
          const existing = idempotency[keyDigest];
          if (existing) {
            if (existing.request_hash !== requestHash) return { status: "conflict" };
            return {
              status: "replay",
              requestHash: existing.request_hash,
              response: existing.response
            };
          }
          pendingClaim = { claimId: keyDigest, requestHash, idempotencyKey };
          return { status: "claimed", claimId: keyDigest };
        },

        async saveDeployment({ resource, deployment }) {
          assertLocked(locked, resource, locked?.deploymentId);
          const result = await client.query(
            `UPDATE izakhono_runtime_deployments
                SET metadata = COALESCE(metadata, '{}'::jsonb) ||
                  jsonb_build_object(
                    'deploy_control',
                    COALESCE(metadata->'deploy_control', '{}'::jsonb) ||
                    jsonb_build_object('record', $5::jsonb)
                  ),
                    updated_at = NOW()
              WHERE deployment_id = $1
                AND metadata->>'tenant_id' = $2
                AND metadata->>'application_id' = $3
                AND metadata->>'environment_id' = $4
              RETURNING deployment_id`,
            [locked.deploymentId, resource.tenantId, resource.applicationId,
              resource.environmentId, JSON.stringify(deployment)]
          );
          if (result.rowCount !== 1) {
            throw new PostgresAdapterError("DEPLOYMENT_WRITE_CONFLICT",
              "The locked deployment row was not updated exactly once.");
          }
          locked.deployControl.record = deployment;
        },

        async appendAudit({ event }) {
          assertLocked(locked, {
            tenantId: event.tenantId,
            applicationId: event.applicationId,
            environmentId: event.environmentId
          }, event.deploymentId);
          const data = {
            application_id: event.applicationId,
            environment_id: event.environmentId,
            from_state: event.fromState,
            to_state: event.toState,
            request_hash: event.requestHash,
            evidence: event.evidence
          };
          // Reuse the existing FORTRESS ledger. A missing table or uniqueness
          // conflict aborts this transaction; no second audit database is used.
          await client.query(
            `INSERT INTO fortress_audit_events
              (event_id, job_id, tenant_id, operation_id, event_type, actor,
               adapter, state, observed_at, data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
            [event.eventId, event.deploymentId, event.tenantId, event.idempotencyKey,
              event.eventType, event.actor, "izakhono-deploy", event.toState,
              event.observedAt, JSON.stringify(data)]
          );
        },

        async completeIdempotency({ claimId, response }) {
          if (!pendingClaim || pendingClaim.claimId !== claimId) {
            throw new PostgresAdapterError("IDEMPOTENCY_CLAIM_MISMATCH",
              "The idempotency result does not match the active transaction claim.");
          }
          const entry = {
            request_hash: pendingClaim.requestHash,
            response,
            created_at: new Date().toISOString()
          };
          const result = await client.query(
            `UPDATE izakhono_runtime_deployments
                SET metadata = COALESCE(metadata, '{}'::jsonb) ||
                  jsonb_build_object(
                    'deploy_control',
                    COALESCE(metadata->'deploy_control', '{}'::jsonb) ||
                    jsonb_build_object(
                      'idempotency',
                      COALESCE(metadata->'deploy_control'->'idempotency', '{}'::jsonb) ||
                      jsonb_build_object($5, $6::jsonb)
                    )
                  ),
                    updated_at = NOW()
              WHERE deployment_id = $1
                AND metadata->>'tenant_id' = $2
                AND metadata->>'application_id' = $3
                AND metadata->>'environment_id' = $4
              RETURNING deployment_id`,
            [locked.deploymentId, locked.resource.tenantId, locked.resource.applicationId,
              locked.resource.environmentId, claimId, JSON.stringify(entry)]
          );
          if (result.rowCount !== 1) {
            throw new PostgresAdapterError("IDEMPOTENCY_WRITE_CONFLICT",
              "The idempotency result was not persisted exactly once.");
          }
          locked.deployControl.idempotency = {
            ...objectValue(locked.deployControl.idempotency),
            [claimId]: entry
          };
          pendingClaim = null;
        }
      });

      const result = await work(tx);
      await client.query("COMMIT");
      began = false;
      return result;
    } catch (error) {
      if (began) {
        try { await client.query("ROLLBACK"); } catch { /* preserve the original failure */ }
      }
      throw error;
    } finally {
      client.release();
    }
  };
}
