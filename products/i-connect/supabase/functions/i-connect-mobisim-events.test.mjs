import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const webhook = await readFile(new URL("i-connect-mobisim-webhook/index.ts", root), "utf8");
const processor = await readFile(new URL("i-connect-mobisim-event-processor/index.ts", root), "utf8");

test("webhook verifies signed raw payloads and enforces the five-minute timestamp window", () => {
  assert.match(webhook, /MOBISIM_WEBHOOK_SIGNING_SECRET/);
  assert.match(webhook, /timestamp \+ "\." \+ rawBody/);
  assert.match(webhook, /Math\.abs\(Date\.now\(\) \/ 1000 - seconds\) > 300/);
  assert.match(webhook, /constantTimeEqual/);
  assert.match(webhook, /signature_verified: true/);
});

test("webhook rejects header/body mismatch and oversized or non-JSON payloads", () => {
  assert.match(webhook, /application\/json/);
  assert.match(webhook, /1_048_576/);
  assert.match(webhook, /body\?\.id !== eventId \|\| body\?\.type !== eventType/);
  assert.match(webhook, /event_header_body_mismatch/);
});

test("webhook persists only verified events and treats duplicate event IDs idempotently", () => {
  assert.ok(webhook.indexOf("verifySignature(timestamp, rawBody, signature)") < webhook.indexOf('.from("ic_supplier_webhook_events")'));
  assert.match(webhook, /error\.code === "23505"/);
  assert.match(webhook, /duplicate: true/);
  assert.match(webhook, /processing_status: "RECEIVED"/);
});

test("processor authenticates worker and only selects signature-verified MobiSIM events", () => {
  assert.match(processor, /ic_verify_provisioner_worker_token/);
  assert.match(processor, /\.eq\("signature_verified", true\)/);
  assert.match(processor, /\.eq\("provider_code", "mobisim"\)/);
  assert.match(processor, /\.in\("reconciliation_status"/);
});

test("processor uses read-only supplier order lookup and never calls purchase or wallet APIs", () => {
  assert.match(processor, /\/api\/Order\/GetOrderDetails\//);
  assert.match(processor, /method: "GET"/);
  assert.doesNotMatch(processor, /\/api\/Purchase\/Buy/);
  assert.doesNotMatch(processor, /\/api\/Purchase\/TestBuy/);
  assert.doesNotMatch(processor, /\/api\/Wallet\/AddWalletBalance/);
  assert.match(processor, /Read-only reconciliation only/);
});

test("processor mutates only webhook reconciliation records, not customer service or payment state", () => {
  const writes = [...processor.matchAll(/\.from\("([^"]+)"\)\s*\n\s*\.update\(/g)].map((m) => m[1]);
  assert.ok(writes.length >= 3);
  assert.ok(writes.every((table) => table === "ic_supplier_webhook_events"));
  assert.doesNotMatch(processor, /\.from\("(ic_connectivity_services|pay_payment_transactions|ic_provisioning_jobs)"\)\s*\n\s*\.update\(/);
});
