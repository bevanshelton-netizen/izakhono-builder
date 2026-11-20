# Application service contract

## Canonical source and execution

IZAKHONO BUILDER documentation defines the internal repository and validated source snapshots as the canonical source of truth. This GitHub branch is an optional mirror/export, not a declaration that GitHub is foundational. The production target is the IZAKHONO-owned HOST runtime and a Software NODE execution environment. Do not create or deploy a Vercel production project for this service.

## Required service boundaries

1. Authentication adapter: validate JWT/session using the IZAKHONO-approved identity provider. Do not trust request-supplied user IDs or role claims without verified token provenance.
2. Tenant authorizer: resolve active membership and permission from the private identity schema on every operation.
3. Application service: call the provider-neutral orchestrator; never accept provider IDs from untrusted clients.
4. Evidence storage adapter: write encrypted objects to an approved private object store; use short-lived, single-use upload intents.
5. Provider adapter: server-side only. Secrets must come from the IZAKHONO secret manager and must never be returned to clients.
6. Audit adapter: append-only security events with correlation IDs; redact identity data.
7. Webhook ingress: verify the exact provider signature scheme, timestamp and replay key before parsing or accepting an event.
8. Result projection: expose only the minimum verification result necessary for the requesting tenant and stated purpose.

## API response rules

- Never expose raw identity documents, face images, biometric templates, provider credentials or full provider payloads.
- Use opaque IDs and tenant-scoped pagination.
- Return 404 for records that do not exist or are not visible to the caller, avoiding tenant enumeration.
- Enforce idempotency per tenant and reject reuse of a key with a different request body.
- Rate-limit by tenant, principal and network risk.
- Keep provider outage distinct from failed verification.
- Require a human-review route for ambiguous or contested outcomes.

## Data and privacy

- The database stores metadata, encrypted object references, hashes, authorisation references and normalised outcomes only.
- Raw identity evidence belongs in a separately controlled encrypted object store with retention enforcement.
- Do not assume consent is the only lawful basis. A competent privacy/legal review must determine and record the applicable lawful basis and special-personal-information authorisation for each processing purpose.
- A recorded authorisation reference is a technical gate, not a legal conclusion.
- No cross-tenant identity search or sharing by default.

## Runtime configuration (server-side only)

Required configuration names, values provisioned only through IZAKHONO's secret manager:
- IDENTITY_DATABASE_URL
- IDENTITY_DATABASE_SERVICE_CREDENTIAL
- IDENTITY_AUTH_ISSUER
- IDENTITY_AUTH_AUDIENCE
- IDENTITY_OBJECT_STORE_ENDPOINT
- IDENTITY_OBJECT_STORE_CREDENTIAL
- IDENTITY_PROVIDER_REGULA_ENABLED (default false)
- IDENTITY_PROVIDER_REGULA_SECRET_REF (secret-manager reference only)
- IDENTITY_WEBHOOK_MAX_AGE_SECONDS (default 300)

No production values or credentials are committed in this repository.

## Deployment gates

The service is not production-ready until the canonical internal repository has a validated source snapshot, the owned runtime has been selected and provisioned, database migration is reviewed and applied through the migration system, provider-specific contracts are implemented from current official documentation, automated and integration tests pass, and the owner approves release.
