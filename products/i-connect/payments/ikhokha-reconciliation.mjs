/**
 * Fail-closed gate for an authoritative iKhokha payment-status response.
 * This is deliberately not wired to the webhook: the documented callback
 * contains no amount or currency, so it cannot independently authorize fulfilment.
 */
export function verifyAuthoritativePaymentStatus(expected, observed) {
  const failures = [];
  if (!expected || !observed) {
    return { verified: false, status: "MANUAL_REVIEW", failures: ["payment_record_missing"] };
  }

  const requiredExpected = ["externalTransactionId", "paylinkId", "amountMinor", "currency"];
  for (const key of requiredExpected) {
    if (expected[key] === undefined || expected[key] === null || expected[key] === "") {
      failures.push(`expected_${key}_missing`);
    }
  }

  if (!Number.isSafeInteger(expected.amountMinor) || expected.amountMinor <= 0) {
    failures.push("expected_amount_minor_invalid");
  }
  if (typeof observed.externalTransactionID !== "string" ||
      observed.externalTransactionID !== expected.externalTransactionId) {
    failures.push("external_transaction_id_mismatch");
  }
  if (typeof observed.paylinkID !== "string" || observed.paylinkID !== expected.paylinkId) {
    failures.push("paylink_id_mismatch");
  }
  if (!Number.isSafeInteger(observed.amount) || observed.amount !== expected.amountMinor) {
    failures.push("amount_minor_missing_or_mismatch");
  }
  if (typeof observed.currency !== "string" ||
      observed.currency.toUpperCase() !== String(expected.currency).toUpperCase()) {
    failures.push("currency_missing_or_mismatch");
  }
  if (String(observed.status ?? "").toUpperCase() !== "PAID") {
    failures.push("provider_status_not_paid");
  }
  if (observed.responseCode !== undefined && String(observed.responseCode) !== "00") {
    failures.push("provider_response_code_not_success");
  }

  return {
    verified: failures.length === 0,
    status: failures.length === 0 ? "VERIFIED_PAID" : "MANUAL_REVIEW",
    failures
  };
}
