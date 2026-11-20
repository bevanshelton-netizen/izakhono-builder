# IZAKHONO IDENTITY

Provider-independent identity verification and trust orchestration for the IZAKHONO ecosystem.

**Parent:** IZAKHONO AFRICA (PTY) LTD  
**Coordination:** IZAKHONO PAY  
**Preferred verification candidate:** Regula (not enabled until commercial, legal, security and technical approval)  
**Source-of-truth principle:** IZAKHONO-owned infrastructure; GitHub is an optional mirror/export only.

## Scope

- Identity verification request lifecycle and policy enforcement.
- Tenant-scoped access for authorised IZAKHONO businesses.
- Replaceable document / face / liveness verification provider adapters.
- Provider-neutral results, provenance and audit events.
- No storage of raw document images, face images, biometric templates or provider secrets in the relational database.
- No payment processing; payment remains in IZAKHONO PAY.
- AML/PEP/sanctions screening is a separate provider capability and must not be represented as supplied by Regula unless independently verified and contracted.

## Current implementation boundary

This module provides the provider-neutral domain core, access policy, routing contract, in-memory test repository and a private-schema database migration. It does **not** claim a live Regula integration, production deployment, POPIA legal approval, or a completed operational identity service. Provider adapters remain disabled until real vendor specifications, credentials and acceptance tests are supplied.

## Structure

- \`src/types.ts\` — domain and adapter contracts
- \`src/policy.ts\` — tenant and role authorisation
- \`src/provider-router.ts\` — provider selection and fallback rules
- \`src/orchestrator.ts\` — request lifecycle
- \`src/memory-repository.ts\` — deterministic test repository
- \`src/regula-adapter.ts\` — disabled-by-default Regula adapter boundary
- \`src/index.ts\` — public exports
- \`tests/core.test.ts\` — core behaviour tests
- \`supabase/migrations/0001_identity_private.sql\` — isolated, non-exposed schema

## Security invariants

1. Deny access unless the authenticated principal has an explicit tenant membership and required permission.
2. Never authorise using user-editable profile metadata.
3. Do not expose service credentials or provider secrets to browsers.
4. Do not place raw identity documents or biometric payloads in logs or relational tables.
5. Do not let provider status alone make an account eligible for every IZAKHONO business.
6. Manual review is a first-class outcome; no automatic adverse decision solely from an uncertain signal.
7. Provider outage is a technical state, not a verification failure.
8. The identity schema is private and has no direct browser grants or permissive RLS policies.
9. Production release requires POPIA assessment, threat modelling, vendor due diligence, penetration testing, backup/restore evidence and owner approval.

## Local validation

- `npm run identity:typecheck`
- `npm run identity:test`

CI also runs the Builder integration type-check and route syntax check. Passing tests do not authorise production deployment.
