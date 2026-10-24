/** IZAKHONO MAIL — evidence-backed end-to-end production acceptance gate. */

export const PRODUCTION_ACCEPTANCE_GATES = Object.freeze([
  "publicMx",
  "publicSmtp",
  "publicSubmission",
  "publicTls",
  "authenticatedSubmission",
  "inboundPersistence",
  "outboundAccepted",
  "replyReceived",
  "identityRouting",
  "securityAuthentication",
]);

function validEvidence(value) {
  return Boolean(value && value.ok === true && typeof value.source === "string" && value.source.trim() && typeof value.verifiedAt === "string" && !Number.isNaN(Date.parse(value.verifiedAt)));
}

/**
 * Evaluates independent acceptance evidence. No gate may be inferred from configuration alone.
 * `live` is true only when every production gate has independently verified evidence.
 */
export function evaluateProductionAcceptance(evidence = {}) {
  const checks = {};
  const failed = [];

  for (const gate of PRODUCTION_ACCEPTANCE_GATES) {
    const item = evidence[gate];
    if (!validEvidence(item)) {
      checks[gate] = { ok: false, reason: "INVALID_OR_MISSING_EVIDENCE" };
      failed.push(gate);
      continue;
    }
    checks[gate] = { ...item, ok: true };
  }

  return {
    productionReady: failed.length === 0,
    live: failed.length === 0,
    failed,
    checks,
    evaluatedAt: new Date().toISOString(),
  };
}

export function assertProductionAcceptance(result) {
  if (!result?.productionReady || !result?.live) throw new Error("MAIL_PRODUCTION_ACCEPTANCE_REQUIRED");
  return result;
}
