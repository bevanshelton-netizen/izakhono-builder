/**
 * PostgreSQL transaction adapter for the DEPLOY transaction coordinator.
 *
 * Uses a caller-owned pg Pool. Every operation in one callback shares exactly
 * one checked-out client and one BEGIN/COMMIT boundary. The adapter targets an
 * explicit table contract; it does not create schemas or run migrations.
 *
 * This adapter is not production-wired. Table ownership, approved schema,
 * database identity, migration authority and RLS/grants remain owner decisions.
 */
import { randomUUID } from "node:crypto";

export class PostgresAdapterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PostgresAdapterError";
    this.code = code;
  }
}

const identifier = value => {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    throw new PostgresAdapterError("SCHEMA_INVALID", "PostgreSQL schema must be a simple lowercase identifier.");
  }
  return '"' + value + '"';
};

const json = value => JSON.stringify(value);
const parseJson = value => typeof value === "string" ? JSON.parse(value) : value;

export function createPostgresTransactionRunner(pool, { schema = "deploy_control" } = {}) {
  if (!pool || typeof pool.connect !== "function") {
    throw new PostgresAdapterError("POOL_REQUIRED", "A trusted pg Pool with connect() is required.");
  }
  const ns = identifier(schema);
  const table = name => ns + '."' + name + '"';

  return async function withPostgresTransaction(work) {
    if (typeof work !== "function") {
      throw new PostgresAdapterError("CALLBACK_REQUIRED", "A transaction callback is required.");
    }
    const client = await pool.connect();
    let began = false;
    try {
      await client.query("BEGIN");
      began = true;
      const tx = Object.freeze({
        claimIdempotency: async ({ tenantId, deploymentId, idempotencyKey, requestHash }) => {
          const claimId = randomUUID();
          const inserted = await client.query(
            `INSERT INTO ${table("idempotency_claims")}
              (tenant_id, deployment_id, idempotency_key, request_hash, claim_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (tenant_id, deployment_id, idempotency_key) DO NOTHING
             RETURNING claim_id`,
            [tenantId, deploymentId, idempotencyKey, requestHash, claimId]
          );
          if (inserted.rowCount === 1) return { status: "claimed", claimId };

          // The unique-index conflict waits for an in-flight claimant to commit.
          // FOR UPDATE then serializes replay/conflict inspection with completion.
          const existing = await client.query(
            `SELECT claim_id, request_hash, response
               FROM ${table("idempotency_claims")}
              WHERE tenant_id = $1 AND deployment_id = $2 AND idempotency_key = $3
              FOR UPDATE`,
            [tenantId, deploymentId, idempotencyKey]
          );
          if (existing.rowCount !== 1) {
            throw new PostgresAdapterError("IDEMPOTENCY_CLAIM_LOST", "The idempotency claim disappeared during conflict resolution.");
          }
          const row = existing.rows[0];
          if (row.request_hash !== requestHash) return { status: "conflict" };
          if (row.response === null || row.response === undefined) {
            throw new PostgresAdapterError("IDEMPOTENCY_RESULT_INCOMPLETE", "A committed idempotency claim has no replay result.");
          }
          return { status: "replay", claimId: row.claim_id, requestHash: row.request_hash, response: parseJson(row.response) };
        },

        lockDeployment: async ({ deploymentId, tenantId, applicationId, environmentId }) => {
          const result = await client.query(
            `SELECT record, tenant_id, application_id, environment_id
               FROM ${table("deployment_records")}
              WHERE deployment_id = $1 AND tenant_id = $2
                AND application_id = $3 AND environment_id = $4
              FOR UPDATE`,
            [deploymentId, tenantId, applicationId, environmentId]
          );
          if (result.rowCount !== 1) return { record: null, resource: null };
          const row = result.rows[0];
          return {
            record: parseJson(row.record),
            resource: {
              tenantId: row.tenant_id,
              applicationId: row.application_id,
              environmentId: row.environment_id
            }
          };
        },

        saveDeployment: async ({ resource, deployment }) => {
          const result = await client.query(
            `UPDATE ${table("deployment_records")}
                SET record = $1::jsonb, updated_at = NOW()
              WHERE deployment_id = $2 AND tenant_id = $3
                AND application_id = $4 AND environment_id = $5`,
            [json(deployment), deployment.deployment_id, resource.tenantId, resource.applicationId, resource.environmentId]
          );
          if (result.rowCount !== 1) {
            throw new PostgresAdapterError("DEPLOYMENT_SCOPE_CHANGED", "The scoped deployment row was not updated.");
          }
        },

        appendAudit: async ({ event }) => {
          await client.query(
            `INSERT INTO ${table("audit_events")}
              (event_id, tenant_id, application_id, environment_id, deployment_id,
               actor, event_type, event)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
            [event.eventId, event.tenantId, event.applicationId, event.environmentId,
             event.deploymentId, event.actor, event.eventType, json(event)]
          );
        },

        completeIdempotency: async ({ claimId, response }) => {
          const result = await client.query(
            `UPDATE ${table("idempotency_claims")}
                SET response = $1::jsonb, completed_at = NOW()
              WHERE claim_id = $2 AND response IS NULL`,
            [json(response), claimId]
          );
          if (result.rowCount !== 1) {
            throw new PostgresAdapterError("IDEMPOTENCY_COMPLETION_FAILED", "The idempotency result could not be completed exactly once.");
          }
        }
      });

      const result = await work(tx);
      await client.query("COMMIT");
      began = false;
      return result;
    } catch (error) {
      if (began) {
        try { await client.query("ROLLBACK"); } catch { /* preserve original failure */ }
      }
      throw error;
    } finally {
      client.release();
    }
  };
}
