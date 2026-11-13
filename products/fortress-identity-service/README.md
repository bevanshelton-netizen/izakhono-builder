# FORTRESS Identity & Session Issuer

Cloudflare Worker + D1 foundation for durable FORTRESS identity, one-time owner bootstrap, password authentication, short-lived HS256 access sessions, refresh rotation, logout/revocation and audit events.

## Security boundary

- PBKDF2-HMAC-SHA-256 password hashing with per-user random salts (310,000 iterations); plaintext passwords are never stored or logged.
- HS256 access JWTs carry exact issuer/audience, immutable subject/tenant/role claims, active flag, issued-at, expiry and unique token ID. Lifetime: 10 minutes.
- Refresh tokens are random 384-bit opaque values stored only as SHA-256 hashes and rotated on refresh.
- Login throttling is persisted in D1; eight failed attempts per IP/email bucket trigger a 15-minute lock.
- Session and CSRF cookies are Secure, SameSite=Strict and host-only; session and refresh cookies are HttpOnly.
- Cookie-authenticated state changes require exact Origin and CSRF header/cookie equality.
- Login, bootstrap, refresh and logout generate audit records with hashed source IPs.
- Initial bootstrap creates exactly one OWNER and one tenant. Subsequent bootstrap is rejected.
- This first milestone does not implement MFA, SSO, password recovery, public registration, role administration or account recovery. Do not onboard general customers until those controls and operational recovery are completed and reviewed.

## Deploy

1. Create D1 database named izakhono-fortress-identity and replace database_id in wrangler.toml.
2. Apply migrations: npx wrangler d1 migrations apply izakhono-fortress-identity --remote.
3. Set secrets using Wrangler (never commit values): FORTRESS_SESSION_HMAC_SECRET (at least 32 random bytes) and FORTRESS_BOOTSTRAP_SECRET (independent one-time random secret).
4. Set FORTRESS_ALLOWED_ORIGIN to the exact Creator browser origin.
5. Route issuer endpoints through the same site/origin as Creator. Host-only __Host- cookies cannot be shared across different hostnames.
6. Deploy only after database migration, secrets, origin and route are verified.
7. Bootstrap the initial owner with POST /auth/bootstrap, header x-fortress-bootstrap and JSON email, displayName, tenantName, password. Never send secrets/passwords through ChatGPT or commit them.
8. Remove/rotate the bootstrap secret immediately after bootstrap.
9. Configure the same HMAC secret on Creator, with issuer https://fortress.izakhono.internal and audience izakhono-creator.

## Endpoints

GET /health; POST /auth/bootstrap; POST /auth/login; POST /auth/refresh; POST /auth/logout; GET /auth/me.

## Release gates

Before broad production use: MFA/WebAuthn, password recovery/change, admin lifecycle, refresh replay detection, Creator-side revocation/introspection, alerting, audit retention, backup/restore, independent security review and end-to-end browser tests.
