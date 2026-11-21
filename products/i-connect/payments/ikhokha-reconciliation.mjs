/**
 * iKhokha GET status contract verifier.
 *
 * The documented status response contains paylinkID, status, amount and createdAt.
 * It does NOT echo externalTransactionID, currency or responseCode. The request is
 * therefore made by the stored external reference, and currency is taken only from
 * the trusted payment intent persisted before the signed payment-link creation call.
 * This helper verifies evidence; it does not mutate payment state or release fulfilment.
 */
export function verifyAuthoritativePaymentStatus(expected, observed, lookup) {
  const failures = [];
  if (!expected || !observed || !lookup) {
    return { verified: false, status: "MANUAL_REVIEW", failures: ["payment_evidence_missing"] };
  }

  if (typeof expected.externalTransactionId !== "string" || !expected.externalTransactionId.trim()) {
    failures.push("expected_external_transaction_id_missing");
  }
  if (typeof expected.paylinkId !== "string" || !expected.paylinkId.trim()) {
    failures.push("expected_paylink_id_missing");
  }
  if (!Number.isSafeInteger(expected.amountMinor) || expected.amountMinor <= 0) {
    failures.push("expected_amount_minor_invalid");
  }
  if (typeof expected.currency !== "string" || !/^[A-Z]{3}$/.test(expected.currency)) {
    failures.push("trusted_intent_currency_missing_or_invalid");
  }
  if (lookup.queriedBy !== "externalReference" ||
      lookup.externalReference !== expected.externalTransactionId) {
    failures.push("status_lookup_not_bound_to_expected_external_reference");
  }
  if (typeof observed.paylinkID !== "string" || observed.paylinkID !== expected.paylinkId) {
    failures.push("paylink_id_missing_or_mismatch");
  }
  if (!Number.isSafeInteger(observed.amount) || observed.amount !== expected.amountMinor) {
    failures.push("amount_minor_missing_or_mismatch");
  }
  if (String(observed.status ?? "").toUpperCase() !== "PAID") {
    failures.push("provider_status_not_paid");
  }
  if (typeof observed.createdAt !== "string" || !Number.isFinite(Date.parse(observed.createdAt))) {
    failures.push("provider_created_at_missing_or_invalid");
  }

  return {
    verified: failures.length === 0,
    status: failures.length === 0 ? "VERIFIED_PAID" : "MANUAL_REVIEW",
    currency: failures.length === 0 ? expected.currency : null,
    failures
  };
}
