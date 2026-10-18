import { ScreeningResult } from "./screening-orchestrator";

export interface ScreeningReport {
  title: string;
  mode: ScreeningResult["mode"];
  screeningId: string;
  outcome: ScreeningResult["decision"]["status"];
  humanReviewRequired: boolean;
  reasonCodes: string[];
  evidenceIds: string[];
  disclaimer: string;
}

export function buildScreeningReport(result: ScreeningResult): ScreeningReport {
  return {
    title: "FORTRESS Screening Report",
    mode: result.mode,
    screeningId: result.screeningId,
    outcome: result.decision.status,
    humanReviewRequired: result.decision.requiresHumanReview,
    reasonCodes: result.decision.signals.map((signal) => signal.code),
    evidenceIds: result.evidenceIds,
    disclaimer: "This report contains risk intelligence signals for due diligence. It is not a declaration that a person or organisation is guilty of wrongdoing. Analysts must review source evidence before making a decision.",
  };
}
