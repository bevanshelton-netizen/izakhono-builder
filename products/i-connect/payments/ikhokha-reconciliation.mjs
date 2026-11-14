/**
 * Fail-closed gate for iKhokha's authoritative GET payment-status response.
 * Currency and external transaction reference come from the immutable local
 * payment intent and the exact lookup request; they are not trusted from the
 * provider status response, which may omit both fields.
 */
export function verifyAuthoritativePaymentStatus(expected, observed, lookup) {
  const failures = [];
  if (!expected || !observed || !lookup) {
    return { verified: false, status: "MANUAL_REVIEW", failures: ["payment_evidence_missing"] };
  }

  const required = ["externalTransactionId", "paylinkId", "amountMinor", "currency"];
  for (const key of required) {
    if (expected[key] === undefined || expected[key] === null || expected[key] === "") {
      failures.push(`expected_${key}_missing`);
    }
  }
  if (typeof expected.externalTransactionId !== "string" || !expected.externalTransactionId.trim()) {
    failures.push("expected_external_transaction_id_invalid");
  }
  if (typeof expected.paylinkId !== "string" || !expected.paylinkId.trim()) {
    failures.push("expected_paylink_id_invalid");
  }
  if (!Number.isSafeInteger(expected.amountMinor) || expected.amountMinor <= 0) {
    failures.push("expected_amount_minor_invalid");
  }
  if (typeof expected.currency !== "string" || !/^[A-Z]{3}$/.test(expected.currency)) {
    failures.push("expected_currency_invalid");
  }

  if (lookup.queriedBy !== "externalReference" ||
      lookup.externalReference !== expected.externalTransactionId) {
    failures.push("authoritative_lookup_reference_mismatch");
  }
  if (typeof observed.paylinkID !== "string" || observed.paylinkID !== expected.paylinkId) {
    failures.push("paylink_id_mismatch");
  }
  if (!Number.isSafeInteger(observed.amount) || observed.amount !== expected.amountMinor) {
    failures.push("amount_minor_missing_or_mismatch");
  }
  if (String(observed.status ?? "").toUpperCase() !== "PAID") {
    failures.push("provider_status_not_paid");
  }
  if (typeof observed.createdAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(observed.createdAt) ||
      !Number.isFinite(Date.parse(observed.createdAt))) {
    failures.push("provider_created_at_missing_or_invalid");
  }

  return {
    verified: failures.length === 0,
    status: failures.length === 0 ? "VERIFIED_PAID" : "MANUAL_REVIEW",
    failures,
    trustedCurrency: failures.length === 0 ? expected.currency : null,
    trustedExternalTransactionId: failures.length === 0 ? expected.externalTransactionId : null
  };
}
