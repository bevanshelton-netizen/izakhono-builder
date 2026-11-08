import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { PostgresVoiceCallRegistry } from "./postgres-call-registry.js";

class FakePool {
  calls: Array<{ sql: string; values: unknown[] }> = [];
  nextRows: Array<Record<string, string>> = [];
  nextRowCount = 1;

  async query(sql: string, values: unknown[] = []) {
    this.calls.push({ sql, values });
    return { rows: this.nextRows, rowCount: this.nextRowCount };
  }
}

test("issues a high-entropy credential but stores only its SHA-256 hash", async () => {
  const pool = new FakePool();
  const registry = new PostgresVoiceCallRegistry(pool as unknown as Pool);
  const token = await registry.issueStreamCredential("CA" + "a".repeat(32));
  assert.match(token, /^[A-Za-z0-9_-]{40,64}$/);
  assert.notEqual(pool.calls[0].values[1], token);
  assert.match(String(pool.calls[0].values[1]), /^[a-f0-9]{64}$/);
  assert.match(pool.calls[0].sql, /active_stream_sid IS NULL/);
});

test("atomically consumes a credential and resolves canonical tenant and call IDs", async () => {
  const pool = new FakePool();
  pool.nextRows = [{ call_id: "call-internal-1", tenant_id: "tenant-canonical-1" }];
  const registry = new PostgresVoiceCallRegistry(pool as unknown as Pool);
  const authorization = await registry.authorizeStart({
    callSid: "CA" + "b".repeat(32),
    streamSid: "MZ" + "c".repeat(32),
    customParameters: { callId: "untrusted-id", streamToken: "A".repeat(43), tenantId: "attacker-tenant" },
  });
  assert.deepEqual(authorization, { callId: "call-internal-1", tenantId: "tenant-canonical-1" });
  assert.match(pool.calls[0].sql, /stream_token_consumed_at IS NULL/);
  assert.match(pool.calls[0].sql, /active_stream_sid IS NULL/);
  assert.equal(pool.calls[0].values[0], "CA" + "b".repeat(32));
  assert.notEqual(pool.calls[0].values[1], "A".repeat(43));
});

test("fails closed when the token is missing or already consumed", async () => {
  const pool = new FakePool();
  pool.nextRows = [];
  pool.nextRowCount = 0;
  const registry = new PostgresVoiceCallRegistry(pool as unknown as Pool);
  assert.equal(await registry.authorizeStart({
    callSid: "CA" + "d".repeat(32),
    streamSid: "MZ" + "e".repeat(32),
    customParameters: {},
  }), null);
  assert.equal(pool.calls.length, 0);
  assert.equal(await registry.authorizeStart({
    callSid: "CA" + "d".repeat(32),
    streamSid: "MZ" + "e".repeat(32),
    customParameters: { streamToken: "A".repeat(43) },
  }), null);
});

test("rejects stream credential lifetimes outside policy", async () => {
  const pool = new FakePool();
  const registry = new PostgresVoiceCallRegistry(pool as unknown as Pool);
  await assert.rejects(() => registry.issueStreamCredential("CA" + "f".repeat(32), 5));
  assert.equal(pool.calls.length, 0);
});
