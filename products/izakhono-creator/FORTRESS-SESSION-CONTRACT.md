# FORTRESS → IZAKHONO CINEMATIC STUDIO session contract

## Status and responsibility boundary

The Creator Worker now verifies FORTRESS-issued sessions and applies the existing FORTRESS role/tenant authorization functions. This is the relying-party verifier and browser-facing gateway. It is **not** a login provider and does not create passwords, enroll users, issue identities or mint sessions.

The current `products/izakhono-identity` prototype is an in-memory identity registry, not a production authentication/session authority. Do not connect it directly to a public login page or treat its identity records as authenticated principals. The central FORTRESS login/identity service must complete the issuer side of this contract before user sign-in is considered operational.

## Issued access token

FORTRESS must issue a signed JWT using HMAC-SHA256 (`HS256`) with a minimum 256-bit random signing secret shared only with the Creator Worker through secure server-side secret configuration.

Required header:

```json
{ "alg": "HS256", "typ": "JWT" }
```

Required claims:

```json
{
  "iss": "https://fortress.izakhono.internal",
  "aud": "izakhono-creator",
  "sub": "immutable-fortress-principal-id",
  "tenant_id": "immutable-tenant-id",
  "role": "OWNER",
  "active": true,
  "iat": 1794340000,
  "exp": 1794340600,
  "jti": "unique-session-token-id"
}
```

- `iss` must exactly match `FORTRESS_SESSION_ISSUER`.
- `aud` must include `FORTRESS_SESSION_AUDIENCE` (default `izakhono-creator`).
- `sub` and `tenant_id` must be stable, immutable IDs, not display names or email addresses.
- `role` must be one of `OWNER`, `SECURITY_ADMIN`, `ANALYST`, `VIEWER`.
- `active` must be boolean `true`.
- `iat` and `exp` are Unix seconds; token lifetime must not exceed 15 minutes.
- `jti` must be unique for audit/revocation correlation.

The issuer must authenticate the user and check account status, tenant membership, role and any required MFA before signing. The Creator verifier never trusts browser-supplied user IDs, tenant IDs, role names, approver IDs or permission claims outside the verified signature.

## Browser cookies

After successful FORTRESS login, set:

1. `__Host-izakhono_session`: JWT; `Secure; HttpOnly; Path=/; SameSite=Strict`; no Domain attribute.
2. `__Host-izakhono_csrf`: independent cryptographically random value of at least 32 bytes; `Secure; Path=/; SameSite=Strict`; no Domain attribute; not HttpOnly so the same-origin Creator UI can echo it in `x-csrf-token`.

Rotate both on login and session refresh. Clear both on logout. The issuer must reject cross-site login/redirect abuse and validate the return path against an allowlist. Creator requires CSRF cookie/header equality and same-origin mutation requests when cookie authentication is used.

The verifier also accepts an Authorization Bearer token for trusted native clients; those clients must protect the token in platform secure storage. Do not put the Creator service credential in a browser, native client, URL or local storage.

## Worker configuration

Set these as Cloudflare Worker secrets/variables on the existing `izakhono-creator` Worker:

- `FORTRESS_SESSION_HMAC_SECRET` — shared signing secret, minimum 32 random bytes.
- `FORTRESS_SESSION_ISSUER` — exact issuer URI.
- `FORTRESS_SESSION_AUDIENCE` — `izakhono-creator`.
- `CREATOR_GENERATION_SECRET` — private server-to-server credential used only between the gateway and Creator API.
- Existing Media Fabric connection secrets remain server-side.

Do not commit secret values. Use separate signing keys per environment. Rotate keys through a coordinated issuer/verifier cutover.

## Authorization and tenant isolation

The gateway maps actions to FORTRESS permissions:

- `creator:read` — list/read productions and poll job status.
- `creator:write` — create/edit productions and complete evidence-bearing planning tasks.
- `creator:approve` — approve/reject creative, generation, master and distribution gates.
- `creator:generate` — submit approved work to the owned generation fabric.
- `creator:publish` — reserved for a future explicit publishing gateway.

The verified tenant ID is written into every new production graph. Reads and mutations require an exact tenant match. Creation derives owner ID and tenant ID from the signed session; browser-supplied values are overwritten. Approval identity is likewise derived from the signed principal. Legacy projects without tenant metadata are not exposed through the new tenant-scoped API.

The existing FORTRESS role policy grants read-only Creator access to VIEWER; ANALYST can create, approve and generate but cannot publish; SECURITY_ADMIN and OWNER have the broader permissions defined in `products/fortress-security/src/access-control.ts`.

## Required issuer acceptance tests

- Valid user login with MFA where policy requires it.
- Inactive/suspended user cannot obtain a token.
- Wrong tenant, wrong audience, wrong issuer, expired token and tampered signature are rejected.
- Role changes and logout revoke or rapidly expire prior sessions; implement a revocation check or refresh-token rotation at the FORTRESS issuer.
- Session and CSRF cookies have the exact attributes above.
- Return-to URLs are allowlisted.
- User/tenant/role claims are derived server-side, never from request payloads.
- Audit events exist for login, refresh, logout, session revocation and role/tenant changes.

## Current implementation boundary

The Creator verifier, CSRF guard, role permission checks, tenant-scoped project gateway and browser UI are implemented in the Creator branch. The central FORTRESS login issuer, durable identity store, session revocation/refresh service and production secrets are not yet verified. Until those issuer-side items are deployed and tested, the UI must show sign-in unavailable and no user session is considered live.
