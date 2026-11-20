# Security and release gates

## Hard stops before production

- [ ] Confirm the canonical IZAKHONO-owned source repository and release snapshot.
- [ ] Confirm an approved runtime and secret manager; do not treat GitHub or Vercel as foundational.
- [ ] Approve a POPIA impact assessment and processing-purpose register.
- [ ] Determine the applicable lawful basis and whether consent is appropriate for each workflow.
- [ ] Complete special-personal-information and biometric processing assessment.
- [ ] Complete cross-border transfer and subprocessor assessment.
- [ ] Execute operator / data-processing agreements.
- [ ] Confirm document and biometric retention periods and verified deletion.
- [ ] Complete threat model, penetration test and security review.
- [ ] Validate tenant isolation and object-storage authorisation.
- [ ] Validate webhook authenticity, replay prevention and idempotency.
- [ ] Confirm manual review, dispute and correction processes.
- [ ] Test South African smart ID cards, legacy ID books and passports with representative fixtures.
- [ ] Confirm provider failover and data portability.
- [ ] Test backup restoration and incident response.
- [ ] Obtain explicit owner release approval.

## Data handling

- Store document and biometric payloads only in encrypted object storage with short-lived, tenant-scoped access.
- Store references, hashes and retention metadata in the private database schema.
- Never log full names, ID numbers, document numbers, images, biometric templates, access tokens or provider credentials.
- Keep identity records logically separated by tenant; cross-tenant access is denied by default.
- Do not infer that a verification result satisfies every business, regulatory or transaction-specific KYC obligation.

## Provider onboarding

Regula remains disabled until the exact Regula product, deployment model, API version, data processing terms, support commitments, pricing and South African document acceptance are approved. Do not guess endpoint URLs or webhook signature formats. Implement the transport only from the vendor's current official specification.
