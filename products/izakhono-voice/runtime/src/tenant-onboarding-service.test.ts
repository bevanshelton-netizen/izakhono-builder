import assert from "node:assert/strict";
import test from "node:test";
import { VoiceTenantOnboardingService } from "./tenant-onboarding-service.js";

const base = {
  authenticatedTenantId: "tenant-authenticated-1", idempotencyKey: "signup-req-001",
  businessName: "Shelton Services", customerMobileE164: "+27821234567",
  forwardingMode: "no_answer" as const, systemInstructions: "Answer politely and take messages.",
};

test("checks active subscription before provisioning an AI number", async () => {
  const events: string[] = [];
  const service = new VoiceTenantOnboardingService(
    { async assertSubscriptionActive(tenantId) { assert.equal(tenantId, base.authenticatedTenantId); events.push("billing"); } },
    { async provisionNumber(input) { assert.deepEqual(input, { tenantId: base.authenticatedTenantId, idempotencyKey: base.idempotencyKey }); events.push("number"); return { phoneNumber: "+27115550123" }; }, async releaseNumber() {} },
    { async createTenantVoiceSetup(input) { assert.equal(input.tenantId, base.authenticatedTenantId); events.push("persist"); } },
  );
  const result = await service.onboard(base);
  assert.deepEqual(events, ["billing", "number", "persist"]);
  assert.equal(result.forwardingStatus, "pending");
  assert.equal(result.voiceDestinationE164, "+27115550123");
});

test("does not provision a number when subscription is inactive", async () => {
  let provisioned = false;
  const service = new VoiceTenantOnboardingService(
    { async assertSubscriptionActive() { throw new Error("subscription inactive"); } },
    { async provisionNumber() { provisioned = true; return { phoneNumber: "+27115550123" }; }, async releaseNumber() {} },
    { async createTenantVoiceSetup() {} },
  );
  await assert.rejects(() => service.onboard(base), /subscription inactive/);
  assert.equal(provisioned, false);
});

test("releases a provisioned number if durable tenant setup fails", async () => {
  let released = false;
  const service = new VoiceTenantOnboardingService(
    { async assertSubscriptionActive() {} },
    { async provisionNumber() { return { phoneNumber: "+27115550123", providerReference: "allocation-1" }; }, async releaseNumber(input) { assert.equal(input.providerReference, "allocation-1"); released = true; } },
    { async createTenantVoiceSetup() { throw new Error("database write failed"); } },
  );
  await assert.rejects(() => service.onboard(base), /database write failed/);
  assert.equal(released, true);
});

test("rejects malformed customer numbers before billing or number allocation", async () => {
  let checked = false;
  const service = new VoiceTenantOnboardingService(
    { async assertSubscriptionActive() { checked = true; } },
    { async provisionNumber() { throw new Error("should not run"); }, async releaseNumber() {} },
    { async createTenantVoiceSetup() {} },
  );
  await assert.rejects(() => service.onboard({ ...base, customerMobileE164: "0821234567" }), /E.164/);
  assert.equal(checked, false);
});

test("uses the authenticated server tenant context for persistence", async () => {
  let savedTenant = "";
  const service = new VoiceTenantOnboardingService(
    { async assertSubscriptionActive(tenantId) { assert.equal(tenantId, "tenant-from-session"); } },
    { async provisionNumber() { return { phoneNumber: "+27115550123" }; }, async releaseNumber() {} },
    { async createTenantVoiceSetup(input) { savedTenant = input.tenantId; } },
  );
  await service.onboard({ ...base, authenticatedTenantId: "tenant-from-session" });
  assert.equal(savedTenant, "tenant-from-session");
});
