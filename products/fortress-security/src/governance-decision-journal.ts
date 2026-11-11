import { createHash } from "node:crypto";

export type GovernanceDecisionOutcome = "APPROVED" | "DENIED";

export interface GovernanceDecision {
  tenantId: string;
  decisionId: string;
  sequence: number;
  outcome: GovernanceDecisionOutcome;
  subjectId: string;
  evidenceDigest: string;
  createdAt: string;
  previousHash: string;
  integrityHash: string;
}

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function createGovernanceDecision(input: Omit<GovernanceDecision, "decisionId" | "integrityHash">): GovernanceDecision {
  if (!input.tenantId || !input.subjectId || !input.evidenceDigest || input.sequence < 1) throw new Error("DECISION_INVALID");
  const decisionId = digest(input);
  return { ...input, decisionId, integrityHash: digest({ ...input, decisionId }) };
}

export function verifyGovernanceDecision(decision: GovernanceDecision): boolean {
  const { decisionId, integrityHash, ...unsigned } = decision;
  return Boolean(decision.tenantId && decision.subjectId && decision.evidenceDigest) &&
    decisionId === digest(unsigned) && integrityHash === digest({ ...unsigned, decisionId });
}

export function appendGovernanceDecision(events: GovernanceDecision[], input: Omit<GovernanceDecision, "decisionId" | "sequence" | "previousHash" | "integrityHash">): GovernanceDecision[] {
  const expected = events.length + 1;
  if (events.some((event) => !verifyGovernanceDecision(event))) throw new Error("DECISION_JOURNAL_INVALID");
  const previousHash = events.at(-1)?.integrityHash ?? "GENESIS";
  return [...events, createGovernanceDecision({ ...input, sequence: expected, previousHash })];
}

export function verifyGovernanceDecisionJournal(events: GovernanceDecision[], tenantId: string): boolean {
  let previousHash = "GENESIS";
  return events.every((event, index) => {
    const valid = event.tenantId === tenantId && event.sequence === index + 1 && event.previousHash === previousHash && verifyGovernanceDecision(event);
    if (valid) previousHash = event.integrityHash;
    return valid;
  });
}
