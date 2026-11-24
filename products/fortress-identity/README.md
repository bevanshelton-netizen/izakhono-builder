# IZAKHONO FORTRESS Identity & Session Issuer

Cloudflare Worker + D1 persistent identity/session authority. This source change is not a deployment.

## Routes
- POST /api/fortress/bootstrap — one-time owner creation, protected by out-of-band FORTRESS_BOOTSTRAP_SECRET.
- POST /api/fortress/login — email/password authentication, origin allowlist and per-IP/per-email rate limits.
- POST /api/fortress/refresh — CSRF/origin protected refresh-token rotation.
- POST /api/fortress/logout — CSRF/origin protected refresh-token revocation and cookie clearing.
- GET /api/fortress/health — liveness only, not proof of database readiness or public deployment.
- GET /api/fortress/session — signed-token and live D1 session introspection for Creator's service binding.
- POST /api/fortress/deploy-token — issue a five-minute, one-application/one-environment DEPLOY capability from an active Creator bearer session. OWNER may request read/write/approve scopes; SECURITY_ADMIN may request read/write only.
- POST /api/fortress/deploy-token/introspect — internal DEPLOY verifier. Requires the separate FORTRESS_DEPLOY_INTROSPECTION_SECRET and checks JWT signature, D1 capability row, parent session, principal activity, tenant, resource scope and revocation.
- POST /api/fortress/deploy-token/revoke — OWNER may revoke any capability in the tenant; SECURITY_ADMIN may revoke only their own.

## Controls
- D1-backed principals, password credentials, refresh sessions and audit events.
- PBKDF2-HMAC-SHA-256, 310,000 iterations and unique 128-bit random salts.
- HS256 access JWTs with 10-minute lifetime and issuer/audience/tenant/role/JTI claims. Creator checks each token against the live D1 session registry, so logout, refresh rotation and account deactivation revoke access immediately.
- 384-bit opaque refresh tokens stored only as SHA-256 hashes; previous token revoked on rotation.
- Secure, HttpOnly, SameSite=Strict host-only session and refresh cookies; separate readable CSRF cookie.
- Secrets are never committed. Never send passwords, bootstrap secrets or signing keys through ChatGPT.
- Audit records exclude passwords, tokens and raw IP addresses. DEPLOY capability issue/revoke events are written in the same D1 batch as the capability state change; audit metadata contains only resource IDs, scopes and a JTI hash.

## Deployment sequence
1. Create D1 and replace the placeholder database ID in wrangler.toml.
2. Apply migrations remotely.
3. Configure FORTRESS_SESSION_HMAC_SECRET (32+ random bytes), FORTRESS_BOOTSTRAP_SECRET and FORTRESS_DEPLOY_INTROSPECTION_SECRET (32+ random bytes, distinct from the signing secret) using Cloudflare secrets.
4. Apply migration `0003_deploy_access_sessions.sql` with the existing D1 migration runner. It adds the short-lived DEPLOY capability registry and parent-session binding.
5. Set FORTRESS_ALLOWED_ORIGINS to the exact Creator Studio origin.
6. Route /api/fortress/* through the Creator Studio hostname. Host-only cookies must be issued on that same public host.
7. Bootstrap the owner once from a trusted administrative client, then remove/rotate the bootstrap secret.
8. Configure the Creator Worker with the same signing secret, issuer and audience.
9. Install the separate introspection secret in the approved HOST secret manager for the DEPLOY API verifier; never expose it to browsers.
10. Verify login, CSRF, tenant/role checks, refresh rotation, logout, DEPLOY capability issuance/revocation and audit persistence before enabling sign-in.

## Not yet implemented

This first issuer milestone does not yet implement MFA enrollment/challenges, recovery codes, password reset, invitation workflows or administrative credential/role management. Do not enable a policy that requires MFA until that control is delivered and tested. Owner bootstrap is intentionally a one-time out-of-band operation; it is not a general user provisioning API.

## Integration boundary
Creator currently verifies JWT signature, issuer, audience, role, tenant and a maximum 15-minute lifetime. This issuer emits 10-minute access tokens. Logout and refresh rotation revoke the prior access-token JTI in D1. Creator uses its FORTRESS_IDENTITY service binding to check the live session on every authenticated request. If the identity authority is unavailable, Creator fails closed.

The Worker must be mounted behind a same-origin reverse proxy on the Creator hostname. A separate hostname cannot share these host-only cookies and is not a valid production topology.


## DEPLOY capability security boundary

A deploy capability is issued only from an active FORTRESS Creator session and is limited to the caller's current tenant, one application ID, one environment ID and an explicit scope list. Its maximum lifetime is five minutes. The D1 row stores the JTI, parent access JTI, resource scope, scopes and expiry. The introspection endpoint requires a separate internal secret and confirms the parent refresh session is still active; logout/refresh revocation therefore invalidates derived DEPLOY capabilities. Explicit revocation is audited with the state change in one D1 batch.

The endpoint does not provision applications or environments, and it does not activate a HOST or run a deployment. The D1 migration and secret configuration are source-level prerequisites only; no remote migration, Worker deployment, D1 write or production secret operation has been performed in this change.
