import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "https://i-connect-staging-bevan2.vercel.app",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

function jsStringEscape(value: string): string {
  return value.replace(/[\\\"']/g, "\\$&").replace(/\u0000/g, "\\0");
}
async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret.trim()),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("authorization");
  if (!authorization) return json({ ok: false, error: "authorization_required" }, 401);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ ok: false, error: "authenticated_user_required" }, 401);

    const body = await req.json().catch(() => null);
    const transactionId = typeof body?.transaction_id === "string" ? body.transaction_id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(transactionId)) {
      return json({ ok: false, error: "valid_transaction_id_required" }, 400);
    }

    const db = createClient(supabaseUrl, serviceKey);
    const { data: org, error: orgError } = await db.from("ic_organizations")
      .select("id").eq("slug", "izakhono").eq("status", "active").maybeSingle();
    if (orgError || !org) return json({ ok: false, error: "organization_not_ready" }, 503);
    const { data: membership, error: membershipError } = await db.from("ic_memberships")
      .select("id").eq("organization_id", org.id).eq("user_id", user.id)
      .eq("status", "active").in("role", ["owner", "admin"]).maybeSingle();
    if (membershipError || !membership) return json({ ok: false, error: "owner_or_admin_required" }, 403);

    const { data: activation, error: activationError } = await db.from("pay_live_activation_control")
      .select("live_enabled,gate_decision").eq("provider", "ikhokha")
      .order("changed_at", { ascending: false }).limit(1).maybeSingle();
    if (activationError) return json({ ok: false, error: "activation_gate_unavailable" }, 503);

    const appId = (Deno.env.get("IKHOKHA_APP_ID") || "").trim();
    const appSecret = (Deno.env.get("IKHOKHA_APP_SECRET") || "").trim();
    const entityId = (Deno.env.get("IKHOKHA_ENTITY_ID") || "").trim();
    const requesterUrl = (Deno.env.get("IKHOKHA_REQUESTER_URL") || "").trim();
    const successUrl = (Deno.env.get("IKHOKHA_SUCCESS_URL") || "").trim();
    const failureUrl = (Deno.env.get("IKHOKHA_FAILURE_URL") || "").trim();
    const liveEnvEnabled = Deno.env.get("IKHOKHA_LIVE_CHECKOUT_ENABLED") === "true";
    if (!appId || !appSecret || !entityId || !requesterUrl || !successUrl || !failureUrl) {
      return json({ ok: false, error: "ikhokha_configuration_incomplete", money_movement: false }, 503);
    }
    if (!liveEnvEnabled || activation?.live_enabled !== true || activation?.gate_decision !== "GO") {
      return json({ ok: false, error: "ikhokha_live_activation_gate_closed", money_movement: false }, 409);
    }

    const { data: prepared, error: prepareError } = await db.rpc("pay_ikhokha_prepare_payment_link", {
      p_transaction_id: transactionId,
    });
    if (prepareError) return json({ ok: false, error: "payment_intent_not_ready", reason: prepareError.message }, 409);

    const { data: claim, error: claimError } = await db.rpc("pay_ikhokha_claim_payment_link", {
      p_intent_id: prepared.intent_id,
    });
    if (claimError) return json({ ok: false, error: "payment_link_claim_failed" }, 503);
    if (claim?.claimed !== true) {
      return json({ ok: false, error: "payment_link_not_claimable", state: claim?.state ?? "unknown" }, 409);
    }

    const callbackUrl = `${supabaseUrl}/functions/v1/izakhono-pay-ikhokha-webhook`;
    const request = {
      entityID: entityId,
      amount: Number(claim.amount_minor),
      currency: claim.currency,
      requesterUrl,
      mode: "live",
      description: `IZAKHONO payment ${claim.external_transaction_id}`,
      externalTransactionID: claim.external_transaction_id,
      urls: {
        callbackUrl,
        successPageUrl: successUrl,
        failurePageUrl: failureUrl,
      },
    };
    const requestBody = JSON.stringify(request);
    const path = "/public-api/v1/api/payment";
    const signingPayload = jsStringEscape(path + requestBody);
    const signature = await hmacHex(appSecret, signingPayload);
    let providerResponse: Response;
    try {
      providerResponse = await fetch("https://api.ikhokha.com" + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "IK-APPID": appId,
          "IK-SIGN": signature,
        },
        body: requestBody,
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      await db.rpc("pay_ikhokha_mark_link_manual_review", {
        p_intent_id: claim.intent_id, p_failure_code: "provider_request_outcome_unknown",
      });
      return json({ ok: false, error: "provider_outcome_unknown_manual_review", money_movement: false }, 202);
    }

    const responseText = await providerResponse.text();
    let result: Record<string, unknown>;
    try { result = JSON.parse(responseText); } catch {
      await db.rpc("pay_ikhokha_mark_link_manual_review", {
        p_intent_id: claim.intent_id, p_failure_code: "provider_response_not_json",
      });
      return json({ ok: false, error: "provider_response_invalid_manual_review", money_movement: false }, 202);
    }

    const responseCode = String(result.responseCode ?? "");
    const paylinkId = String(result.paylinkID ?? "");
    const paylinkUrl = String(result.paylinkUrl ?? "");
    const echoedReference = String(result.externalTransactionID ?? "");
    const safeLink = /^https:\/\/securepay\.ikhokha\.red\/[A-Za-z0-9_-]+$/.test(paylinkUrl);
    if (!providerResponse.ok || responseCode !== "00" || !paylinkId || !safeLink ||
        echoedReference !== claim.external_transaction_id) {
      await db.rpc("pay_ikhokha_mark_link_manual_review", {
        p_intent_id: claim.intent_id, p_failure_code: "provider_link_response_mismatch",
      });
      return json({ ok: false, error: "provider_link_response_rejected_manual_review", money_movement: false }, 202);
    }

    const { data: finalized, error: finalizeError } = await db.rpc("pay_ikhokha_finalize_payment_link", {
      p_intent_id: claim.intent_id,
      p_paylink_id: paylinkId,
      p_paylink_url: paylinkUrl,
      p_response_code: responseCode,
      p_request_payload_hash: await sha256(requestBody),
    });
    if (finalizeError) {
      await db.rpc("pay_ikhokha_mark_link_manual_review", {
        p_intent_id: claim.intent_id, p_failure_code: "link_persistence_failed",
      });
      return json({ ok: false, error: "link_persistence_failed_manual_review", money_movement: false }, 202);
    }
    return json({
      ok: true, provider: "ikhokha", status: "payment_link_created",
      transaction_id: transactionId, paylink_id: paylinkId, paylink_url: paylinkUrl,
      intent_id: finalized.intent_id, amount_minor: claim.amount_minor, currency: claim.currency,
      fulfilment_released: false,
    }, 201);
  } catch {
    return json({ ok: false, error: "request_failed", money_movement: false }, 400);
  }
});
