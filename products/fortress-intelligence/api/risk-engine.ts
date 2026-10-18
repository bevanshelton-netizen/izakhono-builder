import { EvidenceRecord, RiskSignal, ScreeningDecision } from "./provider-contract";

export function evaluateRisk(evidence: EvidenceRecord[]): ScreeningDecision {
  const signals: RiskSignal[] = [];

  for (const [index, item] of evidence.entries()) {
    const dataset = `${item.sourceDataset ?? ""} ${item.sourceReference ?? ""}`.toLowerCase();
    const attributes = item.matchedAttributes.map((x) => x.toLowerCase());
    const evidenceId = `${item.provider}:${item.providerEntityId ?? index}`;

    if (dataset.includes("sanction")) {
      signals.push({ code: "SANCTIONS_SIGNAL", severity: "high", explanation: "A provider returned a sanctions-related signal; human verification is required.", evidenceIds: [evidenceId] });
    }
    if (dataset.includes("pep") || attributes.includes("pep")) {
      signals.push({ code: "PEP_SIGNAL", severity: "medium", explanation: "A provider returned a politically exposed person-related signal; assess according to applicable policy.", evidenceIds: [evidenceId] });
    }
    if (dataset.includes("adverse") || dataset.includes("media")) {
      signals.push({ code: "ADVERSE_MEDIA_SIGNAL", severity: "medium", explanation: "An adverse-media signal requires source review and corroboration.", evidenceIds: [evidenceId] });
    }
  }

  if (!evidence.length) {
    signals.push({ code: "DATA_INSUFFICIENT", severity: "low", explanation: "No provider evidence was returned; the absence of evidence is not evidence of absence.", evidenceIds: [] });
  }

  const hasHigh = signals.some((s) => s.severity === "high");
  const status = hasHigh ? "escalated" : signals.length ? "review" : "unable_to_determine";
  return { status, signals, requiresHumanReview: true };
}
