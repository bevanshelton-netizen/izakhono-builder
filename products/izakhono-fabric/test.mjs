import test from "node:test";
import assert from "node:assert/strict";
import { resolvePlatform } from "./resolve.mjs";
import { OWNED_DEFAULT, EXTERNAL_BRIDGE } from "./client/hybrid-browser.mjs";

test("every platform inherits the shared baseline", () => {
  const plan = resolvePlatform("faisready");
  for (const key of ["crm","backend","payments","email","notifications","chat","ai_speech","ai_transcription","recurring_events","roles_permissions","api_integrations","publish"]) {
    assert.ok(plan.baseline.includes(key), `missing baseline capability: ${key}`);
  }
  assert.equal(plan.public_live_implied, false);
});

test("media products receive the media extension without changing baseline", () => {
  const plan = resolvePlatform("kora");
  assert.equal(plan.profile, "media");
  assert.ok(plan.extra_modules.includes("artist_protect"));
  assert.ok(plan.extra_modules.includes("media_handoff"));
  assert.ok(plan.baseline.includes("payments"));
});

test("unknown future products still receive default fabric", () => {
  const plan = resolvePlatform("future-product");
  assert.equal(plan.profile, "default");
  assert.ok(plan.baseline.includes("backend"));
  assert.ok(plan.blockers.length > 0);
});


test("hybrid browser client preserves owned-primary and external resilience endpoints",()=>{
  assert.equal(OWNED_DEFAULT,"https://fabric.izakhonoafrica.co.za");
  assert.match(EXTERNAL_BRIDGE,/supabase\.co\/functions\/v1\/izakhono-gateway-event$/);
});
