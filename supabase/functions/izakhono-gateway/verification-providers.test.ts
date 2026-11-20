import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultProviderRegistry,
  ProviderRegistry,
  RegulaAdapter,
  type ProviderRequest,
  type RegulaTransport,
} from "./verification-providers.ts";

const request: ProviderRequest = {
  verificationId: "11111111-1111-4111-8111-111111111111",
  caseId: "22222222-2222-4222-8222-222222222222",
  entityId: "ent_0123456789abcdef0123456789abcdef",
  membershipId: "mem_0123456789abcdef0123456789abcdef",
  evidenceId: "33333333-3333-4333-8333-333333333333",
  evidenceSha256: "a".repeat(64),
  storageObjectRef: "identity-evidence/private/object.pdf",
  countryCode: "ZA",
  correlationId: "44444444-4444-4444-8444-444444444444",
};

test("default registry exposes Regula as unconfigured, not ready", async () => {
  const registry = createDefaultProviderRegistry();
  assert.equal(registry.get("regula")?.isConfigured(), false);
  assert.equal(registry.resolve("regula", "document_authenticity"), null);
  assert.equal((await registry.get("regula")?.healthCheck())?.status, "not_configured");
});

test("unconfigured Regula adapter fails closed", async () => {
  const result = await new RegulaAdapter().verifyDocument(request);
  assert.equal(result.providerCode, "regula");
  assert.equal(result.outcome, "unavailable");
  assert.equal(result.requiresReview, true);
  assert.equal(result.resultSha256, null);
});

test("adapter normalises a valid provider assessment without making an onboarding decision", async () => {
  const transport: RegulaTransport = {
    healthCheck: async () => ({ status: "ready", version: "test" }),
    verifyDocument: async () => ({
      outcome: "clear",
      transactionRef: "regula-tx-1",
      resultSha256: "b".repeat(64),
      checks: [{ code: "DOC_AUTH", status: "passed" }],
    }),
    verifyFaceMatch: async () => ({
      outcome: "clear",
      resultSha256: "c".repeat(64),
      checks: [{ code: "FACE_MATCH", status: "passed" }],
    }),
    verifyLiveness: async () => ({
      outcome: "clear",
      resultSha256: "d".repeat(64),
      checks: [{ code: "LIVENESS", status: "passed" }],
    }),
  };
  const result = await new RegulaAdapter(transport).verifyDocument(request);
  assert.equal(result.outcome, "clear");
  assert.equal(result.requiresReview, false);
  assert.equal(result.providerCode, "regula");
  assert.equal("decision" in result, false);
});

test("a clear vendor result with failed or missing checks is downgraded to inconclusive", async () => {
  const transport: RegulaTransport = {
    healthCheck: async () => ({ status: "ready" }),
    verifyDocument: async () => ({
      outcome: "clear",
      resultSha256: "b".repeat(64),
      checks: [{ code: "DOC_AUTH", status: "failed" }],
    }),
    verifyFaceMatch: async () => ({ outcome: "inconclusive" }),
    verifyLiveness: async () => ({ outcome: "inconclusive" }),
  };
  const result = await new RegulaAdapter(transport).verifyDocument(request);
  assert.equal(result.outcome, "inconclusive");
  assert.equal(result.requiresReview, true);
});

test("invalid evidence requests are rejected before provider invocation", async () => {
  const adapter = new RegulaAdapter({
    healthCheck: async () => ({ status: "ready" }),
    verifyDocument: async () => ({ outcome: "clear", resultSha256: "b".repeat(64), checks: [{ code: "DOC_AUTH", status: "passed" }] }),
    verifyFaceMatch: async () => ({ outcome: "inconclusive" }),
    verifyLiveness: async () => ({ outcome: "inconclusive" }),
  });
  await assert.rejects(() => adapter.verifyDocument({ ...request, evidenceSha256: "bad" }), /invalid_provider_request/);
});

test("registry rejects duplicate provider identifiers", () => {
  const registry = new ProviderRegistry();
  registry.register(new RegulaAdapter());
  assert.throws(() => registry.register(new RegulaAdapter()), /provider_already_registered/);
});
