/** IZAKHONO MAIL WEBHOOK — signed event intake for delivery providers. */
import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeDeliveryEvent } from "./mail-events.mjs";

export function signWebhook(rawBody, secret, timestamp) {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function verifyWebhook({ rawBody, signature, timestamp, secret, toleranceSeconds = 300, now = Math.floor(Date.now() / 1000) }) {
  if (!rawBody || !signature || !timestamp || !secret) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > toleranceSeconds) return false;
  const expected = signWebhook(rawBody, secret, timestamp);
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function ingestWebhook({ rawBody, headers = {}, secret, ledger, now }) {
  const timestamp = getHeader(headers, "x-izakhono-mail-timestamp");
  const signature = getHeader(headers, "x-izakhono-mail-signature");
  if (!verifyWebhook({ rawBody, signature, timestamp, secret, now })) {
    return { status: 401, body: { error: "invalid_signature" } };
  }

  let payload;
  try { payload = JSON.parse(rawBody); } catch { return { status: 400, body: { error: "invalid_json" } }; }

  try {
    const event = ledger.append(normalizeDeliveryEvent(payload));
    return { status: 202, body: { accepted: true, event_id: event.id, duplicate: Boolean(event.duplicate) } };
  } catch (error) {
    return { status: 422, body: { error: "invalid_event", message: String(error?.message || error) } };
  }
}

function getHeader(headers, name) {
  if (typeof headers.get === "function") return headers.get(name) || "";
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? String(headers[key]) : "";
}
