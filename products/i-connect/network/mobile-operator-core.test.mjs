import test from "node:test";
import assert from "node:assert/strict";
import {
  assertMobileDispatchAllowed,
  createMobileOrder,
  createMobileProvisioningEnvelope,
  evaluateMobileReadiness,
  transitionMobileService,
} from "./mobile-operator-core.mjs";

const complete = (keys) => Object.fromEntries(keys.map((key) => [key, true]));

test("production MVNO readiness fails closed without documentary evidence", () => {
  const result = evaluateMobileReadiness({ deliveryModel: "mvno", environment: "production" });
  assert.equal(result.productionReady, false);
  assert.ok(result.missingEvidence.includes("commercialAgreementVerified"));
});

test("production dispatch rejects simulator and unapproved providers", () => {
  const evidence = complete([
    "commercialAgreementVerified", "apiContractVerified", "sandboxCredentialsVerified",
    "productionCredentialsVerified", "wholesalePricebookApproved", "coverageAndProductFeedVerified",
    "ricaWorkflowApproved", "settlementAndWalletTermsApproved", "securityAndPopiaReviewPassed",
    "regulatoryModelReviewed",
  ]);
  assert.throws(() => assertMobileDispatchAllowed({
    deliveryModel: "mvno",
    environment: "production",
    evidence,
    provider: { environment: "production", isSimulator: true, status: "ACTIVE", productionApproved: true },
  }), /non_simulator/);
});

test("data and airtime orders require integer ZAR cents and idempotency", () => {
  assert.throws(() => createMobileOrder({
    customerId: "c1", serviceId: "s1", orderType: "DATA_BUNDLE",
    productCode: "DATA-1GB", idempotencyKey: "key-1", amountZarCents: 10.5,
  }), /positive integer/);
  const order = createMobileOrder({
    customerId: "c1", serviceId: "s1", orderType: "DATA_BUNDLE",
    productCode: "DATA-1GB", idempotencyKey: "key-1", amountZarCents: 2999,
  });
  assert.equal(order.currency, "ZAR");
  assert.equal(order.amountZarCents, 2999);
});

test("activation requires an upstream confirmation and external reference", () => {
  const service = { id: "s1", state: "PROVISIONING" };
  assert.throws(() => transitionMobileService(service, "ACTIVE", {}), /provider_confirmation/);
  const active = transitionMobileService(service, "ACTIVE", {
    providerConfirmed: true, externalReference: "carrier-order-123",
  });
  assert.equal(active.state, "ACTIVE");
});

test("provisioning envelope preserves idempotency and provider context", () => {
  const order = createMobileOrder({
    customerId: "c1", serviceId: "s1", orderType: "AIRTIME",
    productCode: "AIRTIME-R50", idempotencyKey: "order-unique-1", amountZarCents: 5000,
  });
  const envelope = createMobileProvisioningEnvelope({
    order, providerCode: "mobisim", environment: "sandbox",
  });
  assert.equal(envelope.idempotencyKey, "order-unique-1");
  assert.equal(envelope.providerCode, "mobisim");
});
