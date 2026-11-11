import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { PostgresVoiceBillingEventWriter, type VerifiedVoiceBillingEvent } from "./billing-event-writer.js";

const validEvent = (): VerifiedVoiceBillingEvent => ({
  billingProvider: "test-provider",
  providerEventId: "evt_001",
  tenantId: "tenant_001",
  eventType: "subscription.updated",
  providerEventCreatedAt: "2026-11-08T10:00:00.000Z",
  payloadSha256: "a".repeat(64),
  planCode: "business-monthly",
  providerSubscriptionRef: "sub_001",
  status: "active",
  currentPeriodStart: "2026-11-01T00:00:00.000Z",
  currentPeriodEnd: "2026-12-01T00:00:00.000Z",
});

function poolWith(handler: (sql: string, values?: unknown[]) => Promise<{ rowCount: number | null; rows?: unknown[] }>) {
  const calls: string[] = [];
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push(sql);
      return handler(sql, values);
    },
    release: () => { calls.push("RELEASE"); },
  };
  const pool = { connect: async () => client } as unknown as Pool;
  return { pool, calls };
}

describe("PostgresVoiceBillingEventWriter", () => {
  it("records a verified event and updates entitlement in one transaction", async () => {
    const { pool, calls } = poolWith(async sql => ({ rowCount: sql.includes("INSERT INTO voice_billing_events") ? 1 : 1 }));
    const result = await new PostgresVoiceBillingEventWriter(pool).recordVerifiedEvent(validEvent());
    assert.deepEqual(result, { accepted: true, duplicate: false });
    assert.equal(calls[0], "BEGIN");
    assert.ok(calls.some(sql => sql.includes("INSERT INTO voice_tenant_subscriptions")));
    assert.equal(calls.at(-2), "COMMIT");
    assert.equal(calls.at(-1), "RELEASE");
  });

  it("treats a repeated provider event as an idempotent duplicate", async () => {
    const { pool, calls } = poolWith(async sql => ({ rowCount: sql.includes("INSERT INTO voice_billing_events") ? 0 : 1 }));
    const result = await new PostgresVoiceBillingEventWriter(pool).recordVerifiedEvent(validEvent());
    assert.deepEqual(result, { accepted: true, duplicate: true });
    assert.equal(calls.some(sql => sql.includes("INSERT INTO voice_tenant_subscriptions")), false);
    assert.equal(calls.at(-2), "COMMIT");
  });

  it("rejects malformed canonical events before opening a database connection", async () => {
    let connected = false;
    const pool = { connect: async () => { connected = true; throw new Error("unexpected"); } } as unknown as Pool;
    const event = validEvent();
    event.payloadSha256 = "not-a-hash";
    await assert.rejects(() => new PostgresVoiceBillingEventWriter(pool).recordVerifiedEvent(event), /SHA-256/);
    assert.equal(connected, false);
  });

  it("rolls back when the entitlement write fails", async () => {
    const { pool, calls } = poolWith(async sql => {
      if (sql.includes("INSERT INTO voice_tenant_subscriptions")) throw new Error("database failure");
      return { rowCount: 1 };
    });
    await assert.rejects(() => new PostgresVoiceBillingEventWriter(pool).recordVerifiedEvent(validEvent()), /database failure/);
    assert.equal(calls.at(-2), "ROLLBACK");
    assert.equal(calls.at(-1), "RELEASE");
  });

  it("does not allow an invalid or reversed subscription period", async () => {
    const { pool } = poolWith(async () => ({ rowCount: 1 }));
    const event = validEvent();
    event.currentPeriodEnd = event.currentPeriodStart;
    await assert.rejects(() => new PostgresVoiceBillingEventWriter(pool).recordVerifiedEvent(event), /timestamps/);
  });
});
