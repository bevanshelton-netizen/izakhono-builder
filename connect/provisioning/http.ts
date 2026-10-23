import type { PaymentEvent } from "./orchestrator";
import { processConnectPaymentEvent } from "./runtime";

export interface ConnectPaymentHttpEnv extends Record<string, string | undefined> {
  CONNECT_PAYMENT_WEBHOOK_SECRET?: string;
}

/**
 * Server-side HTTP boundary for normalized CONNECT payment confirmations.
 *
 * The upstream payment adapter must normalize and authenticate provider-specific
 * webhooks before calling this handler. A second shared-secret gate prevents
 * accidental public invocation when the handler is mounted directly.
 */
export async function handleConnectPaymentRequest(
  request: Request,
  env: ConnectPaymentHttpEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const expectedSecret = env.CONNECT_PAYMENT_WEBHOOK_SECRET?.trim();
  if (!expectedSecret) {
    return json({ ok: false, error: "Payment webhook secret is not configured" }, 503);
  }

  const suppliedSecret = request.headers.get("x-izakhono-connect-secret")?.trim();
  if (!suppliedSecret || !safeEqual(suppliedSecret, expectedSecret)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return json({ ok: false, error: "Expected application/json" }, 415);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  if (!payload || typeof payload !== "object") {
    return json({ ok: false, error: "Invalid payment event" }, 400);
  }

  try {
    const result = await processConnectPaymentEvent(env, payload as PaymentEvent);
    return json({
      ok: true,
      duplicate: result.duplicate,
      provisioning: result.provisioning,
    }, result.duplicate ? 200 : 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment provisioning failed";
    const status = message.startsWith("Invalid CONNECT payment event") ? 400
      : message.startsWith("Missing server-side Supabase environment configuration") ? 503
      : message.includes("not confirmed") ? 409
      : 500;
    return json({ ok: false, error: message }, status);
  }
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
