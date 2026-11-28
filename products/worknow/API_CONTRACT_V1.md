# WORKNOW Connector API Contract — v1

This contract defines the HTTP boundary for the first South African Connector Mode slice. It is an implementation specification, not a statement that routes are live.

## Security invariants

- Authentication is performed by trusted identity middleware. Never accept subject, tenant, employer role or verification state from request JSON.
- Resolve active tenant membership server-side for every request.
- All SQL is parameterized. Every query is tenant-scoped; employer reads/writes enforce employer membership and permitted role.
- Public vacancy reads expose only approved fields for published ZA vacancies.
- Candidate applications go directly to the named employer. Connector Mode does not shortlist, rank, refer or charge fees.
- No CV/document upload in this first API slice.
- Record security-relevant actions in append-only audit events. Never place CV contents, identity numbers, bank details, passwords, tokens or full request bodies in audit metadata.
- Use request IDs for tracing and idempotency keys for mutation retries. Replays must not create duplicate applications.
- Rate-limit authentication, application submission and employer acknowledgement. Use generic not-found responses where resource existence could leak another tenant's data.
- Validate request size, content type, allowed fields, string lengths and enum values. Render vacancy text safely.

## Route contract

### Public discovery
GET /api/worknow/v1/vacancies

Query: country=ZA, optional cursor and bounded page size.

Returns only published vacancies with safe public fields: vacancy ID, title, description, approved employer display name, location/work arrangement, publication date and application availability. No tenant IDs, internal review notes, private employer data or candidate data.

### Employer create/edit vacancy
POST /api/worknow/v1/employers/:employerId/vacancies
PATCH /api/worknow/v1/employers/:employerId/vacancies/:vacancyId

Requires verified employer membership and owner/admin/recruiter role. New/edited vacancy is draft or returned to review; never publish by employer self-service. Server derives tenant and creator from auth context.

### Submit vacancy for moderation
POST /api/worknow/v1/employers/:employerId/vacancies/:vacancyId/submit

Requires employer membership and role. Transitions draft/rejected to pending_review, records submission time and audit event. Reviewer identity comes from trusted reviewer auth, not body.

### Moderator decision
POST /api/worknow/v1/moderation/vacancies/:vacancyId/decision

Requires dedicated moderation permission. Allowed decisions: publish, reject, request changes, pause. Publish requires verified employer, approved vacancy content and country capability gate. Record reviewer, time, reason and policy/country-gate version.

### Candidate direct application
POST /api/worknow/v1/vacancies/:vacancyId/applications

Requires authenticated candidate. Request body only:
- directEmployerConsent: true
- privacyNoticeVersion: current published notice version

The server derives applicant subject and tenant context, verifies the vacancy is published and accepts applications, records consent time, and creates the application. No employer ID, applicant ID, status, consent timestamp or tenant ID may be client supplied. Return application receipt and named employer; do not expose other applicants.

### Applicant application status
GET /api/worknow/v1/me/applications/:applicationId

Requires applicant ownership. Return only that applicant's application status, vacancy summary, named employer, submission/receipt timestamps and withdrawal options. A mismatch returns generic not-found and is audited as denied.

### Employer receipt acknowledgement
POST /api/worknow/v1/employers/:employerId/applications/:applicationId/acknowledge

Requires verified employer and owner/admin/recruiter membership for the exact employer. Acknowledge receipt only; this is not a shortlist or hiring decision. Transition submitted to employer_received once. Idempotent retry returns existing receipt without duplicate audit events.

### Candidate withdrawal
POST /api/worknow/v1/me/applications/:applicationId/withdraw

Requires applicant ownership. Only valid from an active application state. Record withdrawal timestamp, retain minimum legally required evidence and trigger applicable employer notification. Never erase audit history; handle deletion requests under a separately reviewed retention policy.

## Standard responses

- 200 successful read or idempotent acknowledgement
- 201 new resource/application created
- 400 malformed or invalid request
- 401 unauthenticated
- 403 authenticated but not permitted (or 404 for resource-existence protection)
- 404 unavailable resource in caller's authorised scope
- 409 invalid state transition or idempotency conflict
- 429 rate limit
- 500 generic server error with request ID; no stack trace or sensitive details

Errors should use a stable machine code, safe human message and request ID. Do not return SQL errors or internal policy details to unauthorised callers.

## Release gates before route activation

1. Confirm the existing identity/session system and trusted tenant resolution.
2. Implement concrete tenant-scoped D1 methods and atomic state/audit writes.
3. Add route-level authorization tests, cross-tenant tests and applicant/employer isolation tests.
4. Add idempotency, rate limits, CSRF/session protections as appropriate, and request validation.
5. Verify migration against an isolated local D1/SQLite database; do not apply remote migration in this step.
6. Review privacy notice, retention, employer disclosure and applicable South African legal requirements with qualified counsel.
7. CI, security review and deployment approval must pass before production activation.
