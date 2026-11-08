import { createHash, randomBytes } from "node:crypto";
import type { Pool } from "pg";
import type { VoiceStreamAuthorization } from "../../src/twilio-media-stream-bridge.js";
import type { VoiceCallRegistry } from "./runtime-contract.js";

export interface RegisterVoiceCallInput {
  callId: string;
  tenantId: string;
  providerCallSid: string;
  direction: "inbound" | "outbound";
  status?: "ringing" | "active" | "handoff";
}

function nonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Durable, cross-replica registry. Stream authorization is a single conditional
 * UPDATE, so the token can be consumed by only one stream on only one replica.
 */
export class PostgresVoiceCallRegistry implements VoiceCallRegistry {
  constructor(private readonly pool: Pool) {}

  async registerCall(input: RegisterVoiceCallInput): Promise<void> {
    const callId = nonEmpty(input.callId, "callId");
    const tenantId = nonEmpty(input.tenantId, "tenantId");
    const providerCallSid = nonEmpty(input.providerCallSid, "providerCallSid");
    const status = input.status ?? "ringing";
    const result = await this.pool.query(
      `INSERT INTO voice_calls (call_id, tenant_id, provider_call_sid, direction, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (call_id) DO UPDATE
       SET updated_at = NOW()
       WHERE voice_calls.tenant_id = EXCLUDED.tenant_id
         AND voice_calls.provider_call_sid = EXCLUDED.provider_call_sid
         AND voice_calls.direction = EXCLUDED.direction
       RETURNING call_id`,
      [callId, tenantId, providerCallSid, input.direction, status],
    );
    if (result.rowCount !== 1) {
      throw new Error("Call registration conflicts with an existing tenant or provider association");
    }
  }

  /** Returns the plaintext credential exactly once; only its SHA-256 hash is stored. */
  async issueStreamCredential(providerCallSid: string, ttlSeconds = 90): Promise<string> {
    const sid = nonEmpty(providerCallSid, "providerCallSid");
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 15 || ttlSeconds > 300) {
      throw new Error("Stream credential TTL must be between 15 and 300 seconds");
    }
    const token = randomBytes(32).toString("base64url");
    const result = await this.pool.query(
      `UPDATE voice_calls
       SET stream_token_hash = $2,
           stream_token_expires_at = NOW() + ($3::int * INTERVAL '1 second'),
           stream_token_consumed_at = NULL,
           updated_at = NOW()
       WHERE provider_call_sid = $1
         AND status IN ('ringing', 'active', 'handoff')
         AND active_stream_sid IS NULL
       RETURNING call_id`,
      [sid, tokenHash(token), ttlSeconds],
    );
    if (result.rowCount !== 1) {
      throw new Error("No eligible IZAKHONO call is available for a new media stream");
    }
    return token;
  }

  async authorizeStart(input: {
    callSid: string;
    streamSid: string;
    customParameters: Record<string, string>;
  }): Promise<VoiceStreamAuthorization | null> {
    const token = input.customParameters?.streamToken;
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
    const result = await this.pool.query<{ call_id: string; tenant_id: string }>(
      `UPDATE voice_calls
       SET stream_token_consumed_at = NOW(),
           active_stream_sid = $3,
           status = 'active',
           updated_at = NOW()
       WHERE provider_call_sid = $1
         AND stream_token_hash = $2
         AND stream_token_expires_at > NOW()
         AND stream_token_consumed_at IS NULL
         AND active_stream_sid IS NULL
         AND status IN ('ringing', 'active', 'handoff')
       RETURNING call_id, tenant_id`,
      [input.callSid, tokenHash(token), input.streamSid],
    );
    const row = result.rows[0];
    return row ? { callId: row.call_id, tenantId: row.tenant_id } : null;
  }

  async releaseStream(input: {
    tenantId: string;
    callId: string;
    streamSid: string;
  }): Promise<void> {
    await this.pool.query(
      `UPDATE voice_calls
       SET active_stream_sid = NULL,
           stream_token_hash = NULL,
           stream_token_expires_at = NULL,
           stream_token_consumed_at = NULL,
           updated_at = NOW()
       WHERE tenant_id = $1 AND call_id = $2 AND active_stream_sid = $3`,
      [input.tenantId, input.callId, input.streamSid],
    );
  }

  async recordUsage(input: {
    tenantId: string;
    callId: string;
    usage: unknown;
  }): Promise<void> {
    const result = await this.pool.query(
      `INSERT INTO voice_call_usage (call_id, tenant_id, usage)
       SELECT call_id, tenant_id, $3::jsonb
       FROM voice_calls
       WHERE call_id = $1 AND tenant_id = $2`,
      [input.callId, input.tenantId, JSON.stringify(input.usage ?? {})],
    );
    if (result.rowCount !== 1) throw new Error("Usage attribution rejected: call/tenant association not found");
  }

  async recordAudit(input: {
    tenantId: string;
    callId: string;
    event: string;
    details?: unknown;
  }): Promise<void> {
    const result = await this.pool.query(
      `INSERT INTO voice_audit_events (call_id, tenant_id, event_type, details)
       SELECT call_id, tenant_id, $3, $4::jsonb
       FROM voice_calls
       WHERE call_id = $1 AND tenant_id = $2`,
      [input.callId, input.tenantId, nonEmpty(input.event, "event"), JSON.stringify(input.details ?? null)],
    );
    if (result.rowCount !== 1) throw new Error("Audit attribution rejected: call/tenant association not found");
  }

  async getTenantInstructions(tenantId: string): Promise<string> {
    const result = await this.pool.query<{ system_instructions: string }>(
      `SELECT system_instructions
       FROM voice_tenant_policies
       WHERE tenant_id = $1 AND enabled = TRUE`,
      [tenantId],
    );
    const instructions = result.rows[0]?.system_instructions?.trim();
    if (!instructions) throw new Error("No enabled IZAKHONO VOICE policy exists for this tenant");
    return instructions;
  }
}
