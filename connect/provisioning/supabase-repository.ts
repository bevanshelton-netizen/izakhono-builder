import type {
  ConnectProvisioningRepository,
  PaymentEvent,
  ProvisioningRecord,
} from "./orchestrator";
import type { ProvisioningState } from "./state-machine";

export type SupabaseRepositoryConfig = {
  url: string;
  serviceRoleKey: string;
};

type SupabaseRow = Record<string, unknown>;

/**
 * Server-only persistence adapter for CONNECT orchestration.
 *
 * Uses Supabase's REST API directly so the worker/server runtime does not need
 * a client SDK dependency. The service-role key must never be exposed to
 * browser code. RLS remains the customer-facing authorization boundary; this
 * adapter is intended only for trusted server-side orchestration.
 */
export class SupabaseConnectProvisioningRepository implements ConnectProvisioningRepository {
  private readonly baseUrl: string;
  private readonly headers: HeadersInit;

  constructor(config: SupabaseRepositoryConfig) {
    if (!config.url || !config.serviceRoleKey) {
      throw new Error("Supabase repository requires URL and service-role key");
    }

    this.baseUrl = config.url.replace(/\/$/, "");
    this.headers = {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}/rest/v1/${path}`, {
      ...init,
      headers: { ...this.headers, ...(init.headers ?? {}) },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase request failed (${response.status}): ${body}`);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async findPaymentEvent(orderId: string, externalEventId: string): Promise<PaymentEvent | null> {
    const rows = await this.request<SupabaseRow[]>(
      `iz_connect_payment_events?select=order_id,external_event_id,status,amount,currency&order_id=eq.${encodeURIComponent(orderId)}&external_event_id=eq.${encodeURIComponent(externalEventId)}&limit=1`,
    );
    if (!rows[0]) return null;
    return {
      orderId: String(rows[0].order_id),
      externalEventId: String(rows[0].external_event_id),
      status: String(rows[0].status),
      amount: rows[0].amount == null ? undefined : Number(rows[0].amount),
      currency: rows[0].currency == null ? undefined : String(rows[0].currency),
    };
  }

  async recordPaymentEvent(event: PaymentEvent): Promise<void> {
    await this.request("iz_connect_payment_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        order_id: event.orderId,
        provider: "IZAKHONO",
        external_event_id: event.externalEventId,
        event_type: "payment_confirmed",
        amount: event.amount ?? null,
        currency: event.currency ?? "ZAR",
        status: event.status,
        payload: {},
        processed_at: new Date().toISOString(),
      }),
    });
  }

  async getProvisioning(orderId: string): Promise<ProvisioningRecord | null> {
    const rows = await this.request<SupabaseRow[]>(
      `iz_connect_provisioning?select=id,order_id,overall_status,current_step,progress,selected_provider,blockers&order_id=eq.${encodeURIComponent(orderId)}&limit=1`,
    );
    if (!rows[0]) return null;
    return rowToProvisioning(rows[0]);
  }

  async createProvisioning(orderId: string, state: ProvisioningState): Promise<ProvisioningRecord> {
    const rows = await this.request<SupabaseRow[]>("iz_connect_provisioning", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        order_id: orderId,
        overall_status: state.status,
        current_step: state.currentStep,
        progress: state.progress,
        selected_provider: "OPENWEB",
        coverage_status: "pending",
        blockers: state.blocker ? [state.blocker] : [],
      }),
    });
    if (!rows[0]) throw new Error("Supabase did not return the created provisioning record");
    return rowToProvisioning(rows[0]);
  }

  async updateProvisioning(record: ProvisioningRecord): Promise<void> {
    await this.request(
      `iz_connect_provisioning?order_id=eq.${encodeURIComponent(record.orderId)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          overall_status: record.state.status,
          current_step: record.state.currentStep,
          progress: record.state.progress,
          blockers: record.state.blocker ? [record.state.blocker] : [],
        }),
      },
    );
  }
}

export function createSupabaseConnectProvisioningRepositoryFromEnv(env: Record<string, string | undefined>) {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing server-side Supabase environment configuration");
  }
  return new SupabaseConnectProvisioningRepository({ url, serviceRoleKey });
}

function rowToProvisioning(row: SupabaseRow): ProvisioningRecord {
  const blockers = Array.isArray(row.blockers) ? row.blockers : [];
  const blocker = typeof blockers[0] === "string" ? blockers[0] : undefined;
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    state: {
      status: String(row.overall_status) as ProvisioningState["status"],
      currentStep: String(row.current_step ?? "payment"),
      progress: Number(row.progress ?? 0),
      blocker,
    },
  };
}
