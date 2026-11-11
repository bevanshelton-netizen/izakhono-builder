import type { Pool } from "pg";

export type VoiceSubscriptionStatus =
  | "active" | "trialing" | "past_due" | "canceled"
  | "incomplete" | "unpaid" | "paused";

/**
 * Canonical event produced only after a provider-specific adapter has verified
 * the original webhook signature and resolved provider identifiers to a tenant.
 * Never construct this object from browser input.
 */
export interface VerifiedVoiceBillingEvent {
  billingProvider: string;
  providerEventId: string;
  tenantId: string;
  eventType: string;
  providerEventCreatedAt: string;
  payloadSha256: string;
  planCode: string;
  providerSubscriptionRef: string;
  status: VoiceSubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export interface VoiceBillingEventResult {
  accepted: boolean;
  duplicate: boolean;
}

/**
 * Persists verified billing events and subscription entitlements atomically.
 * Signature verification and tenant/subscription mapping are deliberately
 * delegated to a provider adapter; this class accepts only its verified output.
 */
export class PostgresVoiceBillingEventWriter {
  constructor(private readonly pool: Pool) {}

  async recordVerifiedEvent(event: VerifiedVoiceBillingEvent): Promise<VoiceBillingEventResult> {
    validateVerifiedEvent(event);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO voice_billing_events
          (billing_provider, provider_event_id, tenant_id, event_type, provider_event_created_at, payload_sha256)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (billing_provider, provider_event_id) DO NOTHING
         RETURNING billing_event_id`,
        [event.billingProvider, event.providerEventId, event.tenantId, event.eventType,
          event.providerEventCreatedAt, event.payloadSha256],
      );

      if (inserted.rowCount !== 1) {
        await client.query("COMMIT");
        return { accepted: true, duplicate: true };
      }

      await client.query(
        `INSERT INTO voice_tenant_subscriptions
          (tenant_id, plan_code, billing_provider, provider_subscription_ref, status,
           current_period_start, current_period_end, last_verified_event_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (tenant_id) DO UPDATE SET
           plan_code = EXCLUDED.plan_code,
           billing_provider = EXCLUDED.billing_provider,
           provider_subscription_ref = EXCLUDED.provider_subscription_ref,
           status = EXCLUDED.status,
           current_period_start = EXCLUDED.current_period_start,
           current_period_end = EXCLUDED.current_period_end,
           last_verified_event_at = EXCLUDED.last_verified_event_at,
           updated_at = NOW()
         WHERE voice_tenant_subscriptions.last_verified_event_at IS NULL
            OR voice_tenant_subscriptions.last_verified_event_at < EXCLUDED.last_verified_event_at`,
        [event.tenantId, event.planCode, event.billingProvider, event.providerSubscriptionRef,
          event.status, event.currentPeriodStart, event.currentPeriodEnd, event.providerEventCreatedAt],
      );
      await client.query("COMMIT");
      return { accepted: true, duplicate: false };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

function validateVerifiedEvent(event: VerifiedVoiceBillingEvent): void {
  const required: Array<[string, string, number]> = [
    ["billing provider", event.billingProvider, 64],
    ["provider event ID", event.providerEventId, 255],
    ["tenant ID", event.tenantId, 128],
    ["event type", event.eventType, 128],
    ["plan code", event.planCode, 64],
    ["provider subscription reference", event.providerSubscriptionRef, 255],
  ];
  for (const [label, value, max] of required) {
    if (typeof value !== "string" || !value.trim() || value.length > max) {
      throw new Error("Invalid " + label);
    }
  }
  if (!/^[a-f0-9]{64}$/i.test(event.payloadSha256)) throw new Error("Invalid billing payload SHA-256");
  if (!["active", "trialing", "past_due", "canceled", "incomplete", "unpaid", "paused"].includes(event.status)) {
    throw new Error("Unsupported subscription status");
  }
  const created = Date.parse(event.providerEventCreatedAt);
  const start = Date.parse(event.currentPeriodStart);
  const end = Date.parse(event.currentPeriodEnd);
  if (![created, start, end].every(Number.isFinite) || end <= start) {
    throw new Error("Invalid billing event or subscription period timestamps");
  }
}
