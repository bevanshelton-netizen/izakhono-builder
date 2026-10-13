/**
 * IZAKHONO MAIL BRAIN adapter.
 * Converts NODE01 MAIL readiness into deterministic Brain Kernel evidence.
 */

export const NODE01_MAIL_GATES = [
  "runtime", "smtp", "submission", "dnsMx", "spf", "dkim", "dmarc",
  "tls", "inbound", "outbound", "reply", "persistence", "identities",
];

export function mailReadinessEvidence(readiness) {
  const checks = readiness?.checks || {};
  const missing = NODE01_MAIL_GATES.filter(gate => !checks[gate]);
  const failed = NODE01_MAIL_GATES.filter(gate => checks[gate] && checks[gate].ok !== true);
  const passed = NODE01_MAIL_GATES.filter(gate => checks[gate]?.ok === true);
  return {
    type: "node01-mail-readiness",
    verifiedAt: readiness?.verifiedAt || null,
    productionReady: readiness?.productionReady === true && missing.length === 0 && failed.length === 0,
    live: readiness?.live === true,
    gates: { required: NODE01_MAIL_GATES, passed, failed, missing },
  };
}

export function mailBrainPolicy({ facts = {}, evidence = [] }) {
  const readinessEvidence = evidence.find(item => item?.type === "node01-mail-readiness");
  if (!readinessEvidence) return { ok: false, reason: "NODE01_MAIL_READINESS_REQUIRED" };
  const missing = readinessEvidence.gates?.missing || NODE01_MAIL_GATES;
  const failed = readinessEvidence.gates?.failed || NODE01_MAIL_GATES;
  if (missing.length || failed.length) return { ok: false, reason: "NODE01_MAIL_GATE_FAILED", missing, failed };
  if (facts.requireProductionReady !== false && readinessEvidence.productionReady !== true) {
    return { ok: false, reason: "NODE01_MAIL_NOT_PRODUCTION_READY" };
  }
  if (facts.requireLive === true && readinessEvidence.live !== true) {
    return { ok: false, reason: "NODE01_MAIL_NOT_LIVE" };
  }
  return { ok: true, reason: "NODE01_MAIL_GATES_VERIFIED", gates: readinessEvidence.gates };
}

export function evaluateMailReadiness(readiness) {
  const evidence = mailReadinessEvidence(readiness);
  return mailBrainPolicy({ facts: { requireProductionReady: true }, evidence: [evidence] });
}
