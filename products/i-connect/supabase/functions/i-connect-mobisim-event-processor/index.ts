import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MERCHANT_ID = Deno.env.get("MOBISIM_MERCHANT_ID");
const API_KEY = Deno.env.get("MOBISIM_API_KEY");
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function fetchOrder(orderId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(
      "https://partners-api.mobisim.com/api/Order/GetOrderDetails/" + encodeURIComponent(orderId),
      {
        method: "GET",
        headers: {
          "X-Merchant-Id": MERCHANT_ID!,
          "X-Api-Key": API_KEY!,
          "Accept": "application/json",
        },
        signal: controller.signal,
      },
    );
    const envelope = await response.json().catch(() => null);
    if (!response.ok || envelope?.success !== true) {
      return { ok: false, http_status: response.status, supplier_message: envelope?.message ?? "supplier_lookup_failed" };
    }
    return { ok: true, http_status: response.status, data: envelope.data };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  const token = req.headers.get("x-i-connect-worker-token");
  const { data: authorized, error: authError } = await supabase.rpc(
    "ic_verify_provisioner_worker_token",
    { p_token: token },
  );
  if (authError || authorized !== true) return reply({ error: "unauthorized" }, 401);

  if (!MERCHANT_ID || !API_KEY) {
    return reply({ error: "supplier_credentials_not_configured", provider: "mobisim" }, 424);
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(10, Math.max(1, Number(body.limit ?? 5)));
  const { data: events, error } = await supabase
    .from("ic_supplier_webhook_events")
    .select("id,provider_event_id,event_type,payload,processing_status,reconciliation_status")
    .eq("provider_code", "mobisim")
    .eq("signature_verified", true)
    .in("reconciliation_status", ["NOT_STARTED", "LOOKUP_PENDING", "LOOKUP_FAILED"])
    .order("received_at", { ascending: true })
    .limit(limit);

  if (error) return reply({ error: "queue_read_failed" }, 500);

  const results = [];
  for (const event of events ?? []) {
    const data = event.payload?.data ?? {};
    const orderId = typeof data.orderId === "string" ? data.orderId : null;

    if (!["order.created", "order.completed", "topup.completed"].includes(event.event_type)) {
      const { error: updateError } = await supabase.from("ic_supplier_webhook_events")
        .update({
          reconciliation_status: "NOT_APPLICABLE",
          reconciliation: { reason: "event_type_does_not_require_order_lookup" },
          last_reconciled_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      results.push({ event_id: event.provider_event_id, status: updateError ? "UPDATE_FAILED" : "NOT_APPLICABLE" });
      continue;
    }

    if (!orderId) {
      const { error: updateError } = await supabase.from("ic_supplier_webhook_events")
        .update({
          reconciliation_status: "MANUAL_REVIEW",
          reconciliation: { reason: "supplier_order_id_missing_from_event" },
          last_reconciled_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      results.push({ event_id: event.provider_event_id, status: updateError ? "UPDATE_FAILED" : "MANUAL_REVIEW" });
      continue;
    }

    const lookup = await fetchOrder(orderId);
    if (!lookup.ok) {
      const { error: updateError } = await supabase.from("ic_supplier_webhook_events")
        .update({
          reconciliation_status: "LOOKUP_FAILED",
          reconciliation: {
            order_id: orderId,
            http_status: lookup.http_status,
            supplier_message: lookup.supplier_message,
          },
          last_reconciled_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      results.push({ event_id: event.provider_event_id, status: updateError ? "UPDATE_FAILED" : "LOOKUP_FAILED" });
      continue;
    }

    const supplierOrder: any = lookup.data;
    const supplierStatus = typeof supplierOrder?.status === "string" ? supplierOrder.status : null;
    const eventMatchesOrder =
      event.event_type === "order.completed"
        ? supplierStatus === "Completed"
        : event.event_type === "topup.completed"
          ? supplierStatus === "Completed"
          : true;

    const { error: updateError } = await supabase.from("ic_supplier_webhook_events")
      .update({
        reconciliation_status: eventMatchesOrder ? "RECONCILED" : "MANUAL_REVIEW",
        reconciliation: {
          order_id: orderId,
          supplier_status: supplierStatus,
          supplier_order_type: supplierOrder?.orderType ?? null,
          supplier_reference: supplierOrder?.companyOrderId ?? orderId,
          event_type: event.event_type,
          status_matches_event: eventMatchesOrder,
          checked_at: new Date().toISOString(),
          source: "mobisim_get_order_details",
        },
        last_reconciled_at: new Date().toISOString(),
      })
      .eq("id", event.id);

    results.push({
      event_id: event.provider_event_id,
      status: updateError ? "UPDATE_FAILED" : eventMatchesOrder ? "RECONCILED" : "MANUAL_REVIEW",
      supplier_status: supplierStatus,
    });
  }

  return reply({
    ok: true,
    provider: "mobisim",
    processed: results.length,
    results,
    note: "Read-only reconciliation only. No customer service state changes, SIM activation, purchases, or wallet operations are performed.",
  });
});