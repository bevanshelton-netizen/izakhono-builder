import test from "node:test";
import assert from "node:assert/strict";
import { verifyAuthoritativePaymentStatus } from "./ikhokha-reconciliation.mjs";

const expected = {
  externalTransactionId: "IC-ORDER-1001",
  paylinkId: "paylink-abc123",
  amountMinor: 25900,
  currency: "ZAR"
};

const paid = {
  externalTransactionID: "IC-ORDER-1001",
  paylinkID: "paylink-abc123",
  amount: 25900,
  currency: "ZAR",
  status: "PAID",
  responseCode: "00"
};

test("authoritative paid response passes only when identifiers, amount and currency match", () => {
  const result = verifyAuthoritativePaymentStatus(expected, paid);
  assert.equal(result.verified, true);
  assert.equal(result.status, "VERIFIED_PAID");
  assert.deepEqual(result.failures, []);
});

test("webhook-only callback shape fails closed because it has no amount or currency", () => {
  const callback = {
    paylinkID: "paylink-abc123",
    externalTransactionID: "IC-ORDER-1001",
    status: "SUCCESS",
    responseCode: "00"
  };
  const result = verifyAuthoritativePaymentStatus(expected, callback);
  assert.equal(result.verified, false);
  assert.equal(result.status, "MANUAL_REVIEW");
  assert.ok(result.failures.includes("amount_minor_missing_or_mismatch"));
  assert.ok(result.failures.includes("currency_missing_or_mismatch"));
});

test("amount, currency, payment link and transaction reference mismatches fail closed", () => {
  for (const mutation of [
    { amount: 25899 },
    { currency: "USD" },
    { paylinkID: "another-link" },
    { externalTransactionID: "another-order" },
    { status: "PENDING" },
    { responseCode: "05" }
  ]) {
    const result = verifyAuthoritativePaymentStatus(expected, { ...paid, ...mutation });
    assert.equal(result.verified, false);
    assert.equal(result.status, "MANUAL_REVIEW");
  }
});

test("invalid expected transaction amounts and incomplete expected records fail closed", () => {
  assert.equal(verifyAuthoritativePaymentStatus({ ...expected, amountMinor: 0 }, paid).verified, false);
  assert.equal(verifyAuthoritativePaymentStatus({ ...expected, currency: "" }, paid).verified, false);
  assert.equal(verifyAuthoritativePaymentStatus(null, paid).verified, false);
});
