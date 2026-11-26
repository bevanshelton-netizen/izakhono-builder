# IZAKHONO DEPLOY identity integration contract

Status: **design contract only — not implemented or deployed**  
Owner: FORTRESS Identity / IZAKHONO ID and DEPLOY control-plane maintainers  
Date: 2026-11-22

## 1. Purpose and boundary

This contract defines the minimum identity interface required before DEPLOY can expose authenticated management API routes. It extends the existing FORTRESS identity authority; it does not create a second user directory, login system, signing authority, session database, or credential store.

The current FORTRESS issuer is Creator-oriented. Its documented JWT audience is `izakhono-creator`, and its claims include subject, tenant, role, active state, issue/expiry times, and JTI. Its current `GET /api/fortress/session` response exposes the principal identity and expiry but does not expose DEPLOY application, environment, or action entitlements. Therefore neither the Creator token nor the current introspection response satisfies this contract.

## 2. Required DEPLOY access token

FORTRESS must issue a short-lived, signed access token specifically for DEPLOY. The exact issuer remains the configured FORTRESS issuer. The audience MUST be a distinct configured value for the DEPLOY API; it MUST NOT be `izakhono-creator`.

Required claims:

| Claim | Requirement |
| --- | --- |
| `iss` | Exact configured FORTRESS issuer |
| `aud` | Exact DEPLOY API audience |
| `sub` | Stable FORTRESS principal ID |
| `tenant_id` | Authoritative tenant identifier |
| `application_ids` | Non-empty list of application identifiers granted to this principal |
| `environment_ids` | Non-empty list of environment identifiers granted to this principal |
| `scopes` | Non-empty list of explicit DEPLOY action scopes |
| `iat`, `nbf`, `exp` | Integer NumericDate values; short lifetime, maximum 10 minutes |
| `jti` | Unique session-bound token identifier |

Allowed action scopes initially are `deploy:read`, `deploy:write`, `deploy:approve`, and the exceptional `deploy:admin`. The issuer MUST derive these grants from authoritative server-side entitlement records and policy. A caller-supplied tenant, application list, environment list, or scope list MUST NEVER be copied into token claims as authority.

FORTRESS role labels (OWNER, SECURITY_ADMIN, ANALYST, VIEWER) are not a substitute for resource/action entitlements. Role-to-entitlement mapping, if used, must be an explicit, reviewed server-side policy and still emit the concrete scoped claims above.

## 3. Issuance and session validation

The DEPLOY token MUST be minted only after FORTRESS has authenticated the principal and confirmed the principal is active. Entitlement evaluation must be server-side and tenant-bound.

The DEPLOY API verifier must validate signature, algorithm allowlist, issuer, exact audience, expiry, not-before, subject, tenant, required claims, and token structure. It must fail closed on malformed claims, unknown signing keys, verifier errors, or unavailable identity authority.

DEPLOY additionally requires live session/revocation validation by JTI. Prefer a private service binding from the DEPLOY Worker/API to FORTRESS, not a browser-callable introspection endpoint. The session check must confirm that the JTI remains active, belongs to the same subject and tenant, and has not expired or been revoked. A successful JWT signature check alone is insufficient because FORTRESS supports logout and refresh revocation.

The identity service must return only the minimum principal and entitlement data needed by DEPLOY. It must not return password material, refresh tokens, signing secrets, or unrelated profile data.

## 4. API enforcement

Every DEPLOY API request must authenticate before reading or mutating deployment state. The server must build the resource tuple from the requested record and authoritative stored ownership, not trust tenant/application/environment identifiers supplied by the browser.

The server must then call the existing `deploy-control/authorization.mjs` policy guard with the verified request-scoped principal and authoritative resource tuple. Reads require `deploy:read`; mutations require `deploy:write`; approval requires `deploy:approve`. `deploy:admin` is the only initial scope override. Unknown actions and missing resource bindings deny access.

No API route may expose a service-role database credential to a browser. No route may authorize solely from a user-supplied tenant ID, role string, or decoded-but-unverified JWT payload.

## 5. Failure behavior

- Missing/invalid bearer token: 401.
- Invalid signature, issuer, audience, time claim, JTI or malformed entitlement claims: 401.
- Valid principal lacking tenant/resource/action permission: 403.
- Live-session verifier unavailable or indeterminate: 503 and fail closed.
- No fallback to Creator audience, unverified claims, cached indefinite authorization, or permissive role mapping.

Responses must not disclose token contents, signing-key details, or sensitive identity records.

## 6. Required tests before integration is accepted

FORTRESS/ID tests:
- DEPLOY audience is distinct from Creator audience.
- Entitlements are derived from server-side grants, not request input.
- Cross-tenant grants cannot be minted.
- Revoked, expired, disabled-principal and unknown-JTI sessions fail.
- Entitlement removal takes effect within the documented token/session revocation window.
- Tokens cannot be replayed across audiences.

DEPLOY API tests:
- Missing and invalid tokens are rejected before any persistence call.
- Invalid issuer/audience/signature/time claims are rejected.
- Live-session rejection and verifier outage fail closed.
- Cross-tenant, cross-application and cross-environment reads and writes are denied.
- Read, write and approval scopes are independently enforced.
- Browser-supplied ownership or entitlement fields cannot elevate access.
- No service credential or privileged identity data is returned to clients.

Tests must exercise the actual API middleware/route and the verifier adapter, not only the standalone policy helper.

## 7. Explicit implementation blockers

This contract does not choose or create the entitlement database schema, migration owner, deployment topology, service-binding name, or signing-key distribution mechanism. Those remain decisions for the FORTRESS Identity owner and the approved runtime/platform owner.

Do not add speculative D1 migrations, alter the existing Creator token audience, widen Creator tokens to DEPLOY, deploy a Worker, configure secrets, or expose a new public route as part of this documentation-only milestone.

## 8. Acceptance status

Until the issuer supports this contract and a server-side DEPLOY API adapter is implemented and tested:

- `deploy-control/authorization.mjs` remains a tested policy helper with injected JWT and live-session verifiers. It requires `iat`, `nbf`, `exp`, `jti`, a maximum ten-minute token lifetime, and a live-session result bound to JTI, subject, tenant and expiry. These callbacks are contracts, not a deployed FORTRESS adapter.
- DEPLOY has no completed production-authenticated management API.
- The current Creator JWT is not accepted as a DEPLOY credential.
- No database persistence, deployment execution, HOST activation, NODE01 bootstrap, or DNS cutover is authorized by this identity design.


## 9. Source-level issuer compatibility check

A source inspection of the current FORTRESS Identity Worker and its D1 migrations confirms the following implementation facts:

- `products/fortress-identity/src/worker.ts` issues HS256 access tokens with `iss`, `aud`, `sub`, `tenant_id`, `role`, `active`, `iat`, `exp`, and `jti`. The current issuer does not emit `nbf`, `application_ids`, `environment_ids`, or `scopes`.
- `products/fortress-identity/wrangler.toml` currently defaults `FORTRESS_SESSION_AUDIENCE` to `izakhono-creator`. Although configurable, changing this shared setting would alter the Creator token contract and is not an acceptable DEPLOY-only integration.
- `GET /api/fortress/session` verifies HS256, the configured issuer/audience, token time bounds and the live `refresh_sessions.access_jti` record. It returns `valid`, principal identity/role and `expiresAt`; it does not return resource/action entitlements.
- `0001_identity.sql` stores principals, credentials, refresh sessions, rate limits and security audit. `0002_access_session_jti.sql` adds the live access-token JTI index. Neither migration defines application/environment grants or DEPLOY scopes.
- The current issuer's `Env` contract has a D1 binding and signing/configuration values, but no DEPLOY-specific entitlement binding or private DEPLOY consumer contract is declared in the inspected Worker source/configuration.

This source inspection confirms that a DEPLOY adapter cannot safely be completed by merely calling the existing Creator session endpoint: the endpoint enforces the Creator audience and returns no deployment grants. It also confirms that the existing D1 schema cannot answer which applications, environments or deployment actions a principal may access.

## 10. Owner decisions required before implementation

The FORTRESS Identity owner and DEPLOY/runtime platform owner must jointly record these decisions before code or migrations are added:

| Decision | Required owner confirmation | Safe default until confirmed |
| --- | --- | --- |
| Entitlement authority | Which existing authoritative system owns tenant-bound principal-to-application, environment and action grants? | No grants; deny DEPLOY access. |
| Grant lifecycle | Who can grant/revoke access, how are changes audited, and what is the revocation SLA? | No self-service or role-derived grants. |
| Token issuance | Dedicated DEPLOY audience value and whether DEPLOY receives a separate short-lived token or a service-bound exchange. | Do not change Creator token audience or accept Creator tokens. |
| Live session check | Approved private service-binding topology, binding name, request/response schema and failure semantics. | No public introspection expansion; fail closed. |
| Signing-key trust | How DEPLOY validates HS256 keys without exposing the shared HMAC secret to another service, or whether an asymmetric signing/JWKS model is approved. | No secret copying or new key distribution. |
| D1 ownership | Confirmation that FORTRESS Identity owns the entitlement migration and rollout, including compatibility/backfill. | No D1 schema changes. |
| Resource ownership | Authoritative server-side lookup for tenant/application/environment ownership in DEPLOY. | No browser-supplied ownership claims. |
| API hosting | Approved DEPLOY API runtime and its private identity-service connectivity. | No public management route. |

The owner decision record must name the accountable service owners, approved audience, entitlement source and migration owner, service-binding contract, key-trust model, revocation objective, and rollout/rollback plan. These are architecture inputs, not values to infer from repository names or existing role labels.

## 11. Implementation sequence after decisions

1. Extend FORTRESS entitlement storage only under the confirmed schema owner; define tenant-bound grants and an audited grant/revocation lifecycle.
2. Implement server-side entitlement evaluation. The issuer must ignore any client-supplied application, environment or scope claims.
3. Add a DEPLOY-specific issuance/exchange path with a distinct audience and explicit claims, or an approved private principal exchange that returns the same verified authority.
4. Implement the approved live-session check bound to JTI, subject and tenant. Keep Creator introspection behavior compatible.
5. Implement the DEPLOY verifier adapter in the actual API runtime and invoke the existing policy guard before any deployment read/write.
6. Derive resource ownership from authoritative stored records; then enforce tenant/application/environment/action grants.
7. Add issuer and actual API integration tests for entitlement issuance, revocation, audience isolation, outage behavior, cross-resource denial and browser-claim tampering.
8. Only then proceed to the separately gated PostgreSQL transaction/persistence implementation.

No implementation step in this section authorizes a production migration, deployment, secret configuration, HOST activation, NODE01 bootstrap or DNS cutover.

## 12. Creator consumer and signing-key trust findings

A source inspection of `products/izakhono-creator/src/fortress-cinematic-gateway.ts`, `products/izakhono-creator/src/index.ts`, and `products/izakhono-creator/wrangler.jsonc` establishes the current Creator consumer pattern:

- Creator verifies the HS256 signature locally using `FORTRESS_SESSION_HMAC_SECRET`, then checks issuer, configured Creator audience, subject, tenant, role, active state, JTI and time bounds.
- Creator subsequently calls the `FORTRESS_IDENTITY` service binding at `/api/fortress/session`. It compares the live introspected principal ID, tenant and role with the token and uses the live identity response expiry.
- The Creator Worker configuration declares a service binding named `FORTRESS_IDENTITY` targeting `izakhono-fortress-identity`. This is a Creator deployment binding, not evidence that a DEPLOY runtime has an approved equivalent binding.
- The current integration therefore relies on a shared HMAC verification secret being available to both issuer and Creator consumer, in addition to the private live-session service binding. The inspected source does not establish an independently scoped DEPLOY signing-key trust arrangement.

These findings sharpen, but do not resolve, the DEPLOY signing-key decision. Copying the current HMAC secret into DEPLOY would expand the set of systems capable of minting FORTRESS tokens if that secret is compromised. Reusing Creator's service binding or its audience would also couple DEPLOY authorization to the Creator trust boundary. Neither is approved by this contract.

Before DEPLOY integration, the identity and runtime owners must select and document one explicit trust model:

1. **Asymmetric issuer verification:** FORTRESS signs with a protected private key and publishes/serves a controlled public-key set (for example, JWKS) to DEPLOY. Key IDs, rotation, cache lifetime, revocation and algorithm allowlists must be specified. DEPLOY receives no signing private key.
2. **Private identity-mediated verification/exchange:** DEPLOY sends the presented credential over an approved private service binding; FORTRESS validates signature, audience, live session and entitlements, then returns a narrowly scoped, authenticated DEPLOY principal result. The binding's caller authentication, request audience, response integrity, timeout and outage behavior must be specified. The response must be bound to the exact token/session and requested DEPLOY audience.
3. **Another owner-approved key-management design:** document its threat model, key custody, separation of issuer and verifier privileges, rotation and emergency revocation before implementation.

The owners must also confirm whether the existing Creator HMAC key is already shared with other consumers and define a migration/rotation plan that preserves Creator sessions. Do not rotate or replace existing secrets as part of this DEPLOY design task.

**Acceptance condition:** DEPLOY's verifier must not be considered production-ready until its trust model and private live-session path are approved, implemented in the actual DEPLOY runtime, and tested for wrong audience, unknown key/key ID, signature failure, revoked JTI, tenant mismatch, entitlement revocation, verifier outage and key rotation. The current Creator integration is evidence of an existing pattern only; it is not authorization to copy that pattern into DEPLOY.
