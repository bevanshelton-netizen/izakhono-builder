import assert from "node:assert/strict";
import {
  CONNECTOR_MODE_POLICY, WorknowPolicyError, submitVacancyForReview, publishVacancy,
  createDirectApplication, markEmployerReceived, assertConnectorModeFeeAllowed,
} from "./core.js";
import type { Employer, Vacancy } from "./core.js";

const employer: Employer = { id: "emp-1", legalName: "Example (Pty) Ltd", registrationNumber: "REG-123", country: "ZA", verified: true, verifiedAt: "2026-11-28T08:00:00Z" };
const draft: Vacancy = { id: "vac-1", employerId: employer.id, title: "Operations Analyst", description: "Role description", country: "ZA", status: "draft" };
const pending = submitVacancyForReview(draft);
assert.equal(pending.status, "pending_review");
const published = publishVacancy(pending, employer, "reviewer-1", "2026-11-28T08:10:00Z");
assert.equal(published.status, "published");
const app = createDirectApplication({ id: "app-1", vacancy: published, applicantId: "candidate-1", consent: { directEmployerApplication: true, privacyNoticeVersion: "v1", consentedAt: "2026-11-28T08:11:00Z" }, submittedAt: "2026-11-28T08:12:00Z" });
assert.equal(app.employerId, employer.id);
assert.equal(markEmployerReceived(app, employer.id).status, "employer_received");
assert.equal(CONNECTOR_MODE_POLICY.shortlistingEnabled, false);
assert.equal(CONNECTOR_MODE_POLICY.referralEnabled, false);
assert.throws(() => publishVacancy(pending, { ...employer, verified: false }, "reviewer-1", "2026-11-28T08:10:00Z"), WorknowPolicyError);
assert.throws(() => createDirectApplication({ id: "app-2", vacancy: published, applicantId: "candidate-2", consent: { directEmployerApplication: false, privacyNoticeVersion: "v1", consentedAt: "2026-11-28T08:11:00Z" }, submittedAt: "2026-11-28T08:12:00Z" }), WorknowPolicyError);
assert.throws(() => createDirectApplication({ id: "app-3", vacancy: draft, applicantId: "candidate-3", consent: { directEmployerApplication: true, privacyNoticeVersion: "v1", consentedAt: "2026-11-28T08:11:00Z" }, submittedAt: "2026-11-28T08:12:00Z" }), WorknowPolicyError);
assert.throws(() => markEmployerReceived(app, "other-employer"), WorknowPolicyError);
assert.throws(() => assertConnectorModeFeeAllowed("candidate"), WorknowPolicyError);
assert.throws(() => assertConnectorModeFeeAllowed("employer_listing"), WorknowPolicyError);
assert.throws(() => assertConnectorModeFeeAllowed("placement"), WorknowPolicyError);
console.log("WORKNOW connector-mode core: all tests passed");
