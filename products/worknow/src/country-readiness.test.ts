import assert from "node:assert/strict";
import { evaluateCountryReadiness, assertCountryReady } from "./country-readiness.js";
import type { CountryReadinessEvidence } from "./country-readiness.js";
const good: CountryReadinessEvidence = {
  countryCode: "ZA",
  legalReview: { approved: true, reviewer: "qualified local counsel", reviewedAt: "2026-11-01T00:00:00Z", validUntil: "2027-11-01T00:00:00Z", sources: ["reviewed statutory source register"] },
  operatingModel: { model: "local_partner", entityOrPartnerVerified: true, authorityToEmployConfirmed: true },
  payroll: { rulesPackVersion: "za-payroll-reviewed-1", rulesReviewed: true, paymentRailVerified: true, reconciliationTestPassed: true },
  privacy: { dataFlowReviewed: true, lawfulBasisAndNoticesApproved: true, retentionAndDeletionConfigured: true, securityReviewPassed: true },
  operations: { supportOwner: "country-ops", escalationRunbookApproved: true, incidentResponseTested: true },
};
assert.equal(evaluateCountryReadiness(good, "2026-11-28T00:00:00Z").ready, true);
assert.doesNotThrow(() => assertCountryReady(good, "2026-11-28T00:00:00Z"));
assert.equal(evaluateCountryReadiness({ ...good, operatingModel: { ...good.operatingModel, entityOrPartnerVerified: false } }, "2026-11-28T00:00:00Z").ready, false);
assert.equal(evaluateCountryReadiness({ ...good, legalReview: { ...good.legalReview, validUntil: "2026-11-20T00:00:00Z" } }, "2026-11-28T00:00:00Z").ready, false);
assert.equal(evaluateCountryReadiness({ ...good, countryCode: "South Africa" }, "2026-11-28T00:00:00Z").ready, false);
assert.throws(() => assertCountryReady({ ...good, payroll: { ...good.payroll, paymentRailVerified: false } }, "2026-11-28T00:00:00Z"));
console.log("WORKNOW country readiness gate: all tests passed");
