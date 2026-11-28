import { strict as assert } from "node:assert";
import { WorknowServerAdapter, type WorknowStore, type AuthenticatedActor, type ApplicationRecord } from "./server-adapter.js";
import type { Employer, Vacancy, Application } from "./core.js";

const employer: Employer = { id: "emp-1", legalName: "Example (Pty) Ltd", registrationNumber: "ZA-123", country: "ZA", verified: true, verifiedAt: "2026-01-01T00:00:00Z" };
const vacancy: Vacancy = { id: "vac-1", employerId: "emp-1", title: "Developer", description: "Role", country: "ZA", status: "published", publishedAt: "2026-01-02T00:00:00Z" };
let stored: ApplicationRecord | null = null;
let lastAudit: string | null = null;
const store: WorknowStore = {
  async getMembership() { return { employerId: "emp-1", role: "recruiter" }; },
  async getEmployer() { return employer; },
  async getPublishedVacancy() { return vacancy; },
  async getApplicationForApplicant(_actor, id) { return stored?.id === id ? stored : null; },
  async getApplicationForEmployer(_actor, id) { return stored?.id === id ? stored : null; },
  async createApplicationWithAudit(input) {
    stored = { ...input.application, tenantId: input.tenantId }; lastAudit = "created"; return stored;
  },
  async acknowledgeWithAudit(input) {
    stored = { ...input.application, tenantId: input.tenantId }; lastAudit = "acknowledged"; return stored;
  },
  async appendAudit(event) { lastAudit = event.outcome; },
};
const ctx = (subjectId: string, tenantId = "tenant-1") => ({
  actor: { subjectId, tenantId } as AuthenticatedActor, requestId: "req-1", now: () => "2026-01-03T00:00:00Z",
});
const adapter = new WorknowServerAdapter(store);

const application = await adapter.applyDirect(ctx("candidate-1"), {
  vacancyId: "vac-1",
  consent: { directEmployerApplication: true, privacyNoticeVersion: "v1", consentedAt: "2026-01-02T23:00:00Z" },
});
assert.equal(application.applicantId, "candidate-1");
assert.equal(application.employerId, "emp-1");
assert.equal(lastAudit, "created");

const visible = await adapter.getApplicantApplication(ctx("candidate-1"), application.id);
assert.equal(visible.id, application.id);
await assert.rejects(() => adapter.getApplicantApplication(ctx("candidate-2"), application.id), /not found for this applicant/);
assert.equal(lastAudit, "denied");

const acknowledged = await adapter.acknowledgeReceipt(ctx("employer-user"), application.id);
assert.equal(acknowledged.status, "employer_received");
assert.equal(lastAudit, "acknowledged");

await assert.rejects(() => adapter.applyDirect({ ...ctx("candidate-1"), actor: { subjectId: "", tenantId: "" } }, {
  vacancyId: "vac-1", consent: { directEmployerApplication: true, privacyNoticeVersion: "v1", consentedAt: "2026-01-02T23:00:00Z" },
}), /Authenticated actor and tenant context are required/);

console.log("WORKNOW server adapter tests passed");
