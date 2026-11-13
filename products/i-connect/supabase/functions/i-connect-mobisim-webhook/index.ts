import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SIGNING_SECRET = Deno.env.get("MOBISIM_WEBHOOK_SIGNING_SECRET");
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(timestamp: string, rawBody: string, signature: string) {
  if (!SIGNING_SECRET || !/^\d{10}$/.test(timestamp)) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;
  if (!/^v1=[a-f0-9]{64}$/i.test(signature)) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(timestamp + "." + rawBody),
  );
  const expected = "v1=" + hex(new Uint8Array(signed));
  return constantTimeEqual(expected.toLowerCase(), signature.toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  if (!SIGNING_SECRET) return reply({ error: "webhook_signing_secret_not_configured" }, 503);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return reply({ error: "unsupported_content_type" }, 415);
  }

  const eventId = req.headers.get("x-mobisim-event-id") ?? "";
  const eventType = req.headers.get("x-mobisim-event-type") ?? "";
  const timestamp = req.headers.get("x-mobisim-timestamp") ?? "";
  const signature = req.headers.get("x-mobisim-signature") ?? "";

  if (!eventId || eventId.length > 200 || !eventType || eventType.length > 120) {
    return reply({ error: "missing_or_invalid_event_headers" }, 400);
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).length > 1_048_576) {
    return reply({ error: "payload_too_large" }, 413);
  }

  const valid = await verifySignature(timestamp, rawBody, signature);
  if (!valid) return reply({ error: "invalid_signature_or_stale_timestamp" }, 401);

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return reply({ error: "invalid_json" }, 400);
  }

  if (body?.id !== eventId || body?.type !== eventType || typeof body?.data !== "object" || body.data === null) {
    return reply({ error: "event_header_body_mismatch" }, 400);
  }

  const eventCreatedAt = typeof body.createdAt === "string" ? body.createdAt : null;
  const parsedCreatedAt = eventCreatedAt ? new Date(eventCreatedAt) : null;
  const safeCreatedAt = parsedCreatedAt && !Number.isNaN(parsedCreatedAt.getTime())
    ? parsedCreatedAt.toISOString()
    : null;

  const { error } = await supabase
    .from("ic_supplier_webhook_events")
    .insert({
      provider_code: "mobisim",
      provider_event_id: eventId,
      event_type: eventType,
      event_created_at: safeCreatedAt,
      signature_verified: true,
      payload: body,
      processing_status: "RECEIVED",
    });

  if (error) {
    if (error.code === "23505") {
      return reply({ ok: true, duplicate: true, event_id: eventId }, 200);
    }
    return reply({ error: "event_persistence_failed" }, 500);
  }

  return reply({ ok: true, accepted: true, event_id: eventId, processing_status: "RECEIVED" }, 202);
});