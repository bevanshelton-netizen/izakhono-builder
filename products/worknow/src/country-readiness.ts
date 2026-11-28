export type EmploymentModel = "software_only" | "local_partner" | "owned_entity";
export interface CountryReadinessEvidence {
  countryCode: string;
  legalReview: { approved: boolean; reviewer: string; reviewedAt: string; validUntil: string; sources: string[] };
  operatingModel: { model: EmploymentModel; entityOrPartnerVerified: boolean; authorityToEmployConfirmed: boolean };
  payroll: { rulesPackVersion: string; rulesReviewed: boolean; paymentRailVerified: boolean; reconciliationTestPassed: boolean };
  privacy: { dataFlowReviewed: boolean; lawfulBasisAndNoticesApproved: boolean; retentionAndDeletionConfigured: boolean; securityReviewPassed: boolean };
  operations: { supportOwner: string; escalationRunbookApproved: boolean; incidentResponseTested: boolean };
}
export interface CountryReadinessResult { ready: boolean; blockers: string[]; countryCode: string; }
const validCode = (code: string): boolean => /^[A-Z]{2}$/.test(code);
const validDate = (value: string): boolean => Number.isFinite(Date.parse(value));
export function evaluateCountryReadiness(evidence: CountryReadinessEvidence, now = new Date().toISOString()): CountryReadinessResult {
  const blockers: string[] = [];
  if (!validCode(evidence.countryCode)) blockers.push("countryCode must be an uppercase ISO 3166-1 alpha-2 code");
  const legal = evidence.legalReview;
  if (!legal.approved) blockers.push("qualified local legal review is not approved");
  if (!legal.reviewer.trim()) blockers.push("legal reviewer is missing");
  if (!legal.sources.length || legal.sources.some(s => !s.trim())) blockers.push("legal source references are missing");
  if (!validDate(legal.reviewedAt) || !validDate(legal.validUntil)) blockers.push("legal review dates are invalid");
  else {
    if (Date.parse(legal.reviewedAt) > Date.parse(now)) blockers.push("legal review date is in the future");
    if (Date.parse(legal.validUntil) <= Date.parse(now)) blockers.push("legal review has expired");
    if (Date.parse(legal.validUntil) < Date.parse(legal.reviewedAt)) blockers.push("legal review validity range is invalid");
  }
  if (evidence.operatingModel.model !== "software_only" && !evidence.operatingModel.entityOrPartnerVerified) blockers.push("local employing entity or partner is not verified");
  if (evidence.operatingModel.model !== "software_only" && !evidence.operatingModel.authorityToEmployConfirmed) blockers.push("authority to employ in this jurisdiction is not confirmed");
  if (!evidence.payroll.rulesPackVersion.trim()) blockers.push("versioned country payroll rules pack is missing");
  if (!evidence.payroll.rulesReviewed) blockers.push("country payroll rules have not been reviewed");
  if (!evidence.payroll.paymentRailVerified) blockers.push("local payroll payment rail is not verified");
  if (!evidence.payroll.reconciliationTestPassed) blockers.push("payroll reconciliation test has not passed");
  if (!evidence.privacy.dataFlowReviewed) blockers.push("country data-flow review is incomplete");
  if (!evidence.privacy.lawfulBasisAndNoticesApproved) blockers.push("lawful basis and privacy notices are not approved");
  if (!evidence.privacy.retentionAndDeletionConfigured) blockers.push("retention and deletion controls are not configured");
  if (!evidence.privacy.securityReviewPassed) blockers.push("security review has not passed");
  if (!evidence.operations.supportOwner.trim()) blockers.push("local operations support owner is missing");
  if (!evidence.operations.escalationRunbookApproved) blockers.push("operations escalation runbook is not approved");
  if (!evidence.operations.incidentResponseTested) blockers.push("incident response has not been tested");
  return { ready: blockers.length === 0, blockers, countryCode: evidence.countryCode };
}
export function assertCountryReady(evidence: CountryReadinessEvidence, now?: string): void {
  const result = evaluateCountryReadiness(evidence, now);
  if (!result.ready) throw new Error(`WORKNOW country ${result.countryCode} is blocked: ${result.blockers.join("; ")}`);
}
