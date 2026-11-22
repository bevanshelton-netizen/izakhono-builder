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

- `deploy-control/authorization.mjs` remains a tested policy helper with an injected verifier.
- DEPLOY has no completed production-authenticated management API.
- The current Creator JWT is not accepted as a DEPLOY credential.
- No database persistence, deployment execution, HOST activation, NODE01 bootstrap, or DNS cutover is authorized by this identity design.
