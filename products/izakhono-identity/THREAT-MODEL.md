# IZAKHONO IDENTITY threat model

## Protected assets

- identity profile references and verification outcomes;
- South African identity document metadata and encrypted evidence objects;
- face and liveness evidence, which may be special personal information;
- tenant membership and business relationship data;
- provider credentials, signing keys and webhook secrets;
- audit events and review decisions.

## Trust boundaries

1. Customer device to public API.
2. Authenticated principal to tenant authorisation service.
3. API service to private database.
4. API service to encrypted object storage.
5. IZAKHONO provider gateway to Regula or another external processor.
6. External provider webhook to webhook ingress.
7. IZAKHONO PAY to other authorised subsidiary systems.

## Principal threats and required controls

| Threat | Required control |
|---|---|
| Tenant data leakage | Tenant ID derived from authorised membership; every query tenant-scoped; deny by default |
| Forged identity result | Provider-specific signature verification over exact raw body; timestamp checks; atomic replay claim |
| Replay of onboarding request | Per-tenant idempotency key bound to canonical request fingerprint |
| Provider outage misclassified as fraud | Separate provider_unavailable status; safe fallback and manual retry |
| Malicious or altered evidence | Private encrypted object storage, content-type and size validation, SHA-256 evidence digest |
| Credential theft | Server-side secret manager, key rotation, least privilege, no secrets in source or client |
| Insider misuse | Owner-controlled administration, purpose-bound permissions, append-only audit |
| Biometric over-retention | Purpose-specific retention schedule, automated deletion and deletion evidence |
| False rejection | Manual review, reason codes, correction and appeal route |
| Supply-chain compromise | Pinned dependencies, CI checks, signed release artifacts and supplier security review |
| Cross-border data exposure | Data-flow mapping, transfer assessment, contractual safeguards and region controls |
| Audit tampering | Append-only audit table trigger, restricted DB grants, external backup of audit evidence |

## Out of scope until separately implemented

- AML/PEP/sanctions screening;
- electronic signature and proof-of-address services;
- liveness accuracy claims or demographic performance guarantees;
- automated account approval across multiple IZAKHONO businesses;
- production fraud scoring without a validated model and governance process.

## Release acceptance

Threat modelling must be reviewed with the Information Officer and security owner. A penetration test and tenant-isolation test are mandatory before production. A passing CI build alone is not a security approval.
