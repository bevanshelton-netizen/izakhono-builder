import test from "node:test";
import assert from "node:assert/strict";
import { verifyAuthoritativePaymentStatus } from "./ikhokha-reconciliation.mjs";

const expected = {
  externalTransactionId: "IC-ORDER-1001",
  paylinkId: "paylink-abc123",
  amountMinor: 25900,
  currency: "ZAR"
};
const observed = {
  paylinkID: "paylink-abc123",
  status: "PAID",
  createdAt: "2026-11-14T05:00:00.000Z",
  amount: 25900,
  description: "I-CONNECT order IC-ORDER-1001"
};
const lookup = { queriedBy: "externalReference", externalReference: "IC-ORDER-1001" };

test("documented authoritative status response verifies against trusted intent", () => {
  const result = verifyAuthoritativePaymentStatus(expected, observed, lookup);
  assert.equal(result.verified, true);
  assert.equal(result.status, "VERIFIED_PAID");
  assert.equal(result.currency, "ZAR");
  assert.deepEqual(result.failures, []);
});

test("webhook-only callback cannot authorize fulfilment", () => {
  const callback = {
    paylinkID: "paylink-abc123",
    externalTransactionID: "IC-ORDER-1001",
    status: "SUCCESS",
    responseCode: "00"
  };
  const result = verifyAuthoritativePaymentStatus(expected, callback, lookup);
  assert.equal(result.verified, false);
  assert.equal(result.status, "MANUAL_REVIEW");
  assert.ok(result.failures.includes("amount_minor_missing_or_mismatch"));
  assert.ok(result.failures.includes("provider_created_at_missing_or_invalid"));
});

test("amount, currency provenance, paylink and status lookup mismatches fail closed", () => {
  const cases = [
    { observed: { ...observed, amount: 25899 } },
    { observed: { ...observed, paylinkID: "another-link" } },
    { observed: { ...observed, status: "PENDING" } },
    { expected: { ...expected, currency: "" } },
    { lookup: { queriedBy: "paymentLinkId", externalReference: "IC-ORDER-1001" } },
    { lookup: { queriedBy: "externalReference", externalReference: "another-order" } }
  ];
  for (const item of cases) {
    const result = verifyAuthoritativePaymentStatus(
      item.expected ?? expected, item.observed ?? observed, item.lookup ?? lookup
    );
    assert.equal(result.verified, false);
    assert.equal(result.status, "MANUAL_REVIEW");
  }
});

test("missing or invalid expected records fail closed", () => {
  assert.equal(verifyAuthoritativePaymentStatus(null, observed, lookup).verified, false);
  assert.equal(verifyAuthoritativePaymentStatus({ ...expected, amountMinor: 0 }, observed, lookup).verified, false);
  assert.equal(verifyAuthoritativePaymentStatus({ ...expected, currency: "ZAR1" }, observed, lookup).verified, false);
});
