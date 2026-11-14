import test from "node:test";
import assert from "node:assert/strict";
import { verifyAuthoritativePaymentStatus } from "./ikhokha-reconciliation.mjs";

const expected = {
  externalTransactionId: "IC-ORDER-1001",
  paylinkId: "paylink-abc123",
  amountMinor: 25900,
  currency: "ZAR"
};
const lookup = { queriedBy: "externalReference", externalReference: "IC-ORDER-1001" };
const paid = {
  paylinkID: "paylink-abc123",
  amount: 25900,
  status: "PAID",
  createdAt: "2026-11-14T08:15:30.000Z"
};

test("authoritative status passes using immutable intent currency and exact lookup reference", () => {
  const result = verifyAuthoritativePaymentStatus(expected, paid, lookup);
  assert.equal(result.verified, true);
  assert.equal(result.status, "VERIFIED_PAID");
  assert.equal(result.trustedCurrency, "ZAR");
  assert.equal(result.trustedExternalTransactionId, expected.externalTransactionId);
  assert.deepEqual(result.failures, []);
});

test("webhook callback cannot authorize payment or fulfilment", () => {
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
  assert.ok(result.failures.includes("provider_status_not_paid"));
  assert.ok(result.failures.includes("provider_created_at_missing_or_invalid"));
});

test("amount, paylink, status and timestamp mismatches fail closed", () => {
  for (const mutation of [
    { amount: 25899 },
    { paylinkID: "another-link" },
    { status: "PENDING" },
    { createdAt: "not-a-date" },
    { createdAt: "2026-11-14" }
  ]) {
    const result = verifyAuthoritativePaymentStatus(expected, { ...paid, ...mutation }, lookup);
    assert.equal(result.verified, false);
    assert.equal(result.status, "MANUAL_REVIEW");
  }
});

test("lookup must be the exact external-reference query", () => {
  for (const wrongLookup of [
    { queriedBy: "paymentLinkId", paymentLinkId: expected.paylinkId },
    { queriedBy: "externalReference", externalReference: "OTHER-ORDER" },
    { queriedBy: "externalReference", externalReference: "" }
  ]) {
    assert.equal(verifyAuthoritativePaymentStatus(expected, paid, wrongLookup).verified, false);
  }
});

test("invalid or incomplete immutable intent fails closed", () => {
  assert.equal(verifyAuthoritativePaymentStatus(null, paid, lookup).verified, false);
  assert.equal(verifyAuthoritativePaymentStatus({ ...expected, amountMinor: 0 }, paid, lookup).verified, false);
  assert.equal(verifyAuthoritativePaymentStatus({ ...expected, currency: "US" }, paid, lookup).verified, false);
  assert.equal(verifyAuthoritativePaymentStatus({ ...expected, externalTransactionId: "" }, paid, lookup).verified, false);
});
