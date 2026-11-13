# IZAKHONO FORTRESS Identity & Session Issuer

Cloudflare Worker + D1 persistent identity/session authority. This source change is not a deployment.

## Routes
- POST /api/fortress/bootstrap — one-time owner creation, protected by out-of-band FORTRESS_BOOTSTRAP_SECRET.
- POST /api/fortress/login — email/password authentication, origin allowlist and per-IP/per-email rate limits.
- POST /api/fortress/refresh — CSRF/origin protected refresh-token rotation.
- POST /api/fortress/logout — CSRF/origin protected refresh-token revocation and cookie clearing.
- GET /api/fortress/health — liveness only, not proof of database readiness or public deployment.
- GET /api/fortress/session — signed-token and live D1 session introspection for Creator's service binding.

## Controls
- D1-backed principals, password credentials, refresh sessions and audit events.
- PBKDF2-HMAC-SHA-256, 310,000 iterations and unique 128-bit random salts.
- HS256 access JWTs with 10-minute lifetime and issuer/audience/tenant/role/JTI claims. Creator checks each token against the live D1 session registry, so logout, refresh rotation and account deactivation revoke access immediately.
- 384-bit opaque refresh tokens stored only as SHA-256 hashes; previous token revoked on rotation.
- Secure, HttpOnly, SameSite=Strict host-only session and refresh cookies; separate readable CSRF cookie.
- Secrets are never committed. Never send passwords, bootstrap secrets or signing keys through ChatGPT.
- Audit records exclude passwords, tokens and raw IP addresses.

## Deployment sequence
1. Create D1 and replace the placeholder database ID in wrangler.toml.
2. Apply migrations remotely.
3. Configure FORTRESS_SESSION_HMAC_SECRET (32+ random bytes) and FORTRESS_BOOTSTRAP_SECRET using Cloudflare secrets.
4. Set FORTRESS_ALLOWED_ORIGINS to the exact Creator Studio origin.
5. Route /api/fortress/* through the Creator Studio hostname. Host-only cookies must be issued on that same public host.
6. Bootstrap the owner once from a trusted administrative client, then remove/rotate the bootstrap secret.
7. Configure the Creator Worker with the same signing secret, issuer and audience.
8. Verify login, CSRF, tenant/role checks, refresh rotation, logout and audit persistence before enabling sign-in.

## Not yet implemented

This first issuer milestone does not yet implement MFA enrollment/challenges, recovery codes, password reset, invitation workflows or administrative credential/role management. Do not enable a policy that requires MFA until that control is delivered and tested. Owner bootstrap is intentionally a one-time out-of-band operation; it is not a general user provisioning API.

## Integration boundary
Creator currently verifies JWT signature, issuer, audience, role, tenant and a maximum 15-minute lifetime. This issuer emits 10-minute access tokens. Logout and refresh rotation revoke the prior access-token JTI in D1. Creator uses its FORTRESS_IDENTITY service binding to check the live session on every authenticated request. If the identity authority is unavailable, Creator fails closed.

The Worker must be mounted behind a same-origin reverse proxy on the Creator hostname. A separate hostname cannot share these host-only cookies and is not a valid production topology.
