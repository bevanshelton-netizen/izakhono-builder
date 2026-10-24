/**
 * IZAKHONO MAIL -> NODE01 readiness bridge.
 *
 * The running NODE01 orchestrator is the source of truth. This bridge does
 * not accept caller-invented gate state; it invokes the orchestrator and
 * converts its verified readiness result into Brain evidence.
 */

export const NODE01_MAIL_READINESS_EVIDENCE = "node01-mail-readiness";

export async function readNode01MailReadiness(orchestrator) {
  if (!orchestrator || typeof orchestrator.readiness !== "function") {
    throw new Error("NODE01_MAIL_ORCHESTRATOR_REQUIRED");
  }
  return orchestrator.readiness();
}

export async function readNode01MailEvidence(orchestrator) {
  const readiness = await readNode01MailReadiness(orchestrator);
  return {
    type: NODE01_MAIL_READINESS_EVIDENCE,
    source: "node01-mail-orchestrator",
    verifiedAt: readiness.verifiedAt || null,
    technicalReady: readiness.technicalReady === true,
    productionReady: readiness.productionReady === true,
    live: readiness.live === true,
    failed: [...(readiness.failed || [])],
    checks: { ...(readiness.checks || {}) },
    productionAcceptance: {
      productionReady: readiness.productionAcceptance?.productionReady === true,
      live: readiness.productionAcceptance?.live === true,
      failed: [...(readiness.productionAcceptance?.failed || [])],
      checks: { ...(readiness.productionAcceptance?.checks || {}) },
      evaluatedAt: readiness.productionAcceptance?.evaluatedAt || null,
    },
  };
}

export function assertNode01MailProductionReady(evidence) {
  if (evidence?.type !== NODE01_MAIL_READINESS_EVIDENCE) {
    throw new Error("NODE01_MAIL_READINESS_EVIDENCE_REQUIRED");
  }
  if (evidence.productionReady !== true || evidence.live !== true) {
    const failed = evidence.failed?.length ? evidence.failed.join(",") : "unknown";
    throw new Error(`NODE01_MAIL_NOT_PRODUCTION_READY:${failed}`);
  }
  return true;
}
