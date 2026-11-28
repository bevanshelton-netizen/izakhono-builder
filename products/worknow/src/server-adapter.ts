import {
  createDirectApplication,
  markEmployerReceived,
  WorknowPolicyError,
  type ApplicantConsent,
  type Application,
  type Employer,
  type Vacancy,
} from "./core.js";

export type WorknowRole = "owner" | "admin" | "recruiter" | "viewer";
export interface AuthenticatedActor {
  /** Must be established by the trusted authentication middleware, never request JSON. */
  subjectId: string;
  tenantId: string;
}
export interface EmployerMembership {
  employerId: string;
  role: WorknowRole;
}
export interface ApplicationRecord extends Application {
  tenantId: string;
}
export interface AuditEvent {
  tenantId: string;
  actorSubjectId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: "success" | "denied" | "failed";
  eventTime: string;
  requestId: string;
  metadata?: Record<string, string | number | boolean>;
}
/**
 * Persistence adapter contract. Implementations MUST use parameterized SQL and
 * tenant-scoped predicates. createApplicationWithAudit and acknowledgeWithAudit
 * must commit the state change and audit event atomically.
 */
export interface WorknowStore {
  getMembership(actor: AuthenticatedActor, employerId: string): Promise<EmployerMembership | null>;
  getEmployer(actor: AuthenticatedActor, employerId: string): Promise<Employer | null>;
  getPublishedVacancy(actor: AuthenticatedActor, vacancyId: string): Promise<Vacancy | null>;
  getApplicationForApplicant(actor: AuthenticatedActor, applicationId: string): Promise<ApplicationRecord | null>;
  getApplicationForEmployer(actor: AuthenticatedActor, applicationId: string): Promise<ApplicationRecord | null>;
  createApplicationWithAudit(input: {
    tenantId: string; application: Application; requestId: string; actorSubjectId: string;
  }): Promise<ApplicationRecord>;
  acknowledgeWithAudit(input: {
    tenantId: string; application: Application; requestId: string; actorSubjectId: string;
  }): Promise<ApplicationRecord>;
  appendAudit(event: AuditEvent): Promise<void>;
}
export interface WorknowRequestContext {
  actor: AuthenticatedActor;
  requestId: string;
  now: () => string;
}
const requireContext = (ctx: WorknowRequestContext): void => {
  if (!ctx.actor?.subjectId?.trim() || !ctx.actor?.tenantId?.trim()) {
    throw new WorknowPolicyError("Authenticated actor and tenant context are required");
  }
  if (!ctx.requestId?.trim()) throw new WorknowPolicyError("requestId is required");
};
const canManageApplications = (role: WorknowRole): boolean =>
  role === "owner" || role === "admin" || role === "recruiter";
const audit = (ctx: WorknowRequestContext, action: string, resourceType: string, resourceId: string,
  outcome: AuditEvent["outcome"], metadata?: AuditEvent["metadata"]): AuditEvent => ({
    tenantId: ctx.actor.tenantId, actorSubjectId: ctx.actor.subjectId, action, resourceType, resourceId,
    outcome, eventTime: ctx.now(), requestId: ctx.requestId, metadata,
});

export class WorknowServerAdapter {
  constructor(private readonly store: WorknowStore) {}

  /** Candidate applies directly to the verified employer. No CV/body is accepted by this slice. */
  async applyDirect(ctx: WorknowRequestContext, input: {
    vacancyId: string; consent: ApplicantConsent;
  }): Promise<ApplicationRecord> {
    requireContext(ctx);
    const vacancy = await this.store.getPublishedVacancy(ctx.actor, input.vacancyId);
    if (!vacancy || vacancy.status !== "published") {
      await this.store.appendAudit(audit(ctx, "application.submit", "vacancy", input.vacancyId, "denied"));
      throw new WorknowPolicyError("Published vacancy not found in the authenticated tenant context");
    }
    const application = createDirectApplication({
      id: `${ctx.requestId}:application`, vacancy, applicantId: ctx.actor.subjectId,
      consent: input.consent, submittedAt: ctx.now(),
    });
    return this.store.createApplicationWithAudit({
      tenantId: ctx.actor.tenantId, application, requestId: ctx.requestId,
      actorSubjectId: ctx.actor.subjectId,
    });
  }

  /** Only the employer's owner/admin/recruiter can acknowledge receipt. */
  async acknowledgeReceipt(ctx: WorknowRequestContext, applicationId: string): Promise<ApplicationRecord> {
    requireContext(ctx);
    const record = await this.store.getApplicationForEmployer(ctx.actor, applicationId);
    if (!record || record.tenantId !== ctx.actor.tenantId) {
      await this.store.appendAudit(audit(ctx, "application.acknowledge", "application", applicationId, "denied"));
      throw new WorknowPolicyError("Application not found in the authenticated tenant context");
    }
    const membership = await this.store.getMembership(ctx.actor, record.employerId);
    if (!membership || !canManageApplications(membership.role)) {
      await this.store.appendAudit(audit(ctx, "application.acknowledge", "application", applicationId, "denied"));
      throw new WorknowPolicyError("Employer membership does not permit application acknowledgement");
    }
    const employer = await this.store.getEmployer(ctx.actor, record.employerId);
    if (!employer || employer.id !== record.employerId || !employer.verified) {
      throw new WorknowPolicyError("Verified employer record is required");
    }
    const updated = markEmployerReceived(record, record.employerId);
    return this.store.acknowledgeWithAudit({
      tenantId: ctx.actor.tenantId, application: updated, requestId: ctx.requestId,
      actorSubjectId: ctx.actor.subjectId,
    });
  }

  /** Applicant can inspect only their own application; store query must bind subject + tenant. */
  async getApplicantApplication(ctx: WorknowRequestContext, applicationId: string): Promise<ApplicationRecord> {
    requireContext(ctx);
    const record = await this.store.getApplicationForApplicant(ctx.actor, applicationId);
    if (!record || record.tenantId !== ctx.actor.tenantId || record.applicantId !== ctx.actor.subjectId) {
      await this.store.appendAudit(audit(ctx, "application.read", "application", applicationId, "denied"));
      throw new WorknowPolicyError("Application not found for this applicant");
    }
    return record;
  }
}
