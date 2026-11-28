export type VacancyStatus = "draft" | "pending_review" | "published" | "paused" | "closed" | "rejected";
export type ApplicationStatus = "submitted" | "employer_received" | "withdrawn";
export type CountryCode = "ZA";

export interface Employer {
  id: string;
  legalName: string;
  registrationNumber: string;
  country: CountryCode;
  verified: boolean;
  verifiedAt?: string;
}
export interface Vacancy {
  id: string;
  employerId: string;
  title: string;
  description: string;
  country: CountryCode;
  status: VacancyStatus;
  publishedAt?: string;
}
export interface ApplicantConsent {
  directEmployerApplication: boolean;
  privacyNoticeVersion: string;
  consentedAt: string;
}
export interface Application {
  id: string;
  vacancyId: string;
  applicantId: string;
  employerId: string;
  status: ApplicationStatus;
  consent: ApplicantConsent;
  submittedAt: string;
}
export interface ConnectorModePolicy {
  candidateFeesEnabled: false;
  employerListingFeesEnabled: false;
  shortlistingEnabled: false;
  referralEnabled: false;
  applicationsRoute: "direct_to_employer";
}
export const CONNECTOR_MODE_POLICY: ConnectorModePolicy = Object.freeze({
  candidateFeesEnabled: false,
  employerListingFeesEnabled: false,
  shortlistingEnabled: false,
  referralEnabled: false,
  applicationsRoute: "direct_to_employer",
});

export class WorknowPolicyError extends Error {
  constructor(message: string) { super(message); this.name = "WorknowPolicyError"; }
}
const required = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (!trimmed) throw new WorknowPolicyError(`${field} is required`);
  return trimmed;
};
const timestamp = (value: string, field: string): void => {
  if (!Number.isFinite(Date.parse(value))) throw new WorknowPolicyError(`${field} must be an ISO-compatible timestamp`);
};

export function validateEmployerForPublication(employer: Employer): void {
  required(employer.id, "employer.id");
  required(employer.legalName, "employer.legalName");
  required(employer.registrationNumber, "employer.registrationNumber");
  if (!employer.verified || !employer.verifiedAt) {
    throw new WorknowPolicyError("Employer must be verified before a vacancy can be published");
  }
  timestamp(employer.verifiedAt, "employer.verifiedAt");
}
export function submitVacancyForReview(vacancy: Vacancy): Vacancy {
  required(vacancy.id, "vacancy.id");
  required(vacancy.employerId, "vacancy.employerId");
  required(vacancy.title, "vacancy.title");
  required(vacancy.description, "vacancy.description");
  if (vacancy.status !== "draft" && vacancy.status !== "rejected") {
    throw new WorknowPolicyError("Only draft or rejected vacancies may be resubmitted");
  }
  return { ...vacancy, status: "pending_review", publishedAt: undefined };
}
export function publishVacancy(vacancy: Vacancy, employer: Employer, reviewerId: string, publishedAt: string): Vacancy {
  required(reviewerId, "reviewerId");
  timestamp(publishedAt, "publishedAt");
  if (vacancy.status !== "pending_review") throw new WorknowPolicyError("Vacancy must pass review before publication");
  if (vacancy.employerId !== employer.id) throw new WorknowPolicyError("Vacancy employer does not match verified employer");
  validateEmployerForPublication(employer);
  return { ...vacancy, status: "published", publishedAt };
}
export function createDirectApplication(input: {
  id: string; vacancy: Vacancy; applicantId: string; consent: ApplicantConsent; submittedAt: string;
}): Application {
  required(input.id, "application.id");
  required(input.applicantId, "applicantId");
  if (input.vacancy.status !== "published") throw new WorknowPolicyError("Applications are accepted only for published vacancies");
  if (!input.consent.directEmployerApplication) throw new WorknowPolicyError("Applicant must consent to direct employer submission");
  required(input.consent.privacyNoticeVersion, "privacyNoticeVersion");
  timestamp(input.consent.consentedAt, "consentedAt");
  timestamp(input.submittedAt, "submittedAt");
  if (Date.parse(input.submittedAt) < Date.parse(input.consent.consentedAt)) {
    throw new WorknowPolicyError("Application cannot predate the applicant's consent");
  }
  return {
    id: input.id,
    vacancyId: input.vacancy.id,
    applicantId: input.applicantId,
    employerId: input.vacancy.employerId,
    status: "submitted",
    consent: { ...input.consent },
    submittedAt: input.submittedAt,
  };
}
export function markEmployerReceived(application: Application, employerId: string): Application {
  if (application.employerId !== employerId) throw new WorknowPolicyError("Only the named employer may acknowledge this application");
  if (application.status !== "submitted") throw new WorknowPolicyError("Only submitted applications may be acknowledged");
  return { ...application, status: "employer_received" };
}
export function assertConnectorModeFeeAllowed(kind: "candidate" | "employer_listing" | "placement"): never {
  const label = kind === "candidate" ? "Candidate fees" : kind === "employer_listing" ? "Employer listing fees" : "Placement fees";
  throw new WorknowPolicyError(`${label} are disabled in Connector Mode pending compliance clearance`);
}
