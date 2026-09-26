# IZAKHONO ID

Shared identity service with **hard entity-scoped sessions**.

## Business rule

IZAKHONO infrastructure may be shared, but each operating entity remains separate.

A user's identity can exist once, but every login session is bound to exactly one entity membership. Downstream services receive both:

- `subject`
- `entity_id`
- `entity_slug`
- `role`

A session created for Entity A cannot silently become a session for Entity B.

## Current capabilities

- entity registry
- user accounts
- entity memberships and roles
- PBKDF2-HMAC-SHA256 password hashing with unique salts
- entity-scoped bearer sessions
- token hashes stored instead of raw session tokens
- login/logout
- internal token introspection for other IZAKHONO services
- fail-closed inactive entity/user/membership checks
- email-verification state enforced at login
- persisted brute-force throttling per entity/email/client fingerprint
- security audit events with hashed subject identifiers
- password change with current-password verification
- other-session revocation after password change
- admin session revocation for a user
- TOTP multi-factor authentication with RFC 6238-compatible 6-digit codes
- short-lived MFA login challenges before a session is issued
- one-time hashed recovery codes
- MFA enrollment, confirmation, recovery-code regeneration and protected disable flow
- existing pre-verification admin-provisioned users preserved safely during the one-time schema migration

## Endpoints

- `GET /healthz`
- `POST /api/v1/admin/entities`
- `POST /api/v1/admin/users`
- `POST /api/v1/admin/memberships`
- `POST /api/v1/admin/revoke-user-sessions`
- `POST /api/v1/login`
- `POST /api/v1/login/mfa`
- `POST /api/v1/logout`
- `POST /api/v1/change-password`
- `POST /api/v1/mfa/enroll/start`
- `POST /api/v1/mfa/enroll/confirm`
- `POST /api/v1/mfa/recovery/regenerate`
- `POST /api/v1/mfa/disable`
- `GET /api/v1/me`
- `POST /api/v1/internal/introspect`

## Security controls

Login throttling defaults:

- 5 failed attempts
- 15-minute rolling window
- 15-minute lock

They are configurable with:

- `IZAKHONO_ID_LOGIN_MAX_FAILURES`
- `IZAKHONO_ID_LOGIN_WINDOW_SECONDS`
- `IZAKHONO_ID_LOGIN_LOCK_SECONDS`

Email verification is required by default and can only be relaxed explicitly with `IZAKHONO_ID_REQUIRE_EMAIL_VERIFICATION=false`.

TOTP MFA requires `IZAKHONO_ID_MFA_MASTER_KEY` with at least 32 characters. Per-user TOTP secrets are derived with HMAC-SHA256 from that protected master key and the user ID, so no raw TOTP seed is stored in SQLite. Rotating the MFA master key invalidates existing authenticator enrollments and must therefore use a controlled migration procedure.

MFA login challenges default to 5 minutes and a maximum of 5 failed attempts. Configure with `IZAKHONO_ID_MFA_CHALLENGE_SECONDS` and `IZAKHONO_ID_MFA_MAX_ATTEMPTS`. Recovery codes are high-entropy one-time values; only their hashes are stored and the plaintext codes are returned once at enrollment/regeneration.

Admin-created users are considered verified because their identity is provisioned by an authenticated owner workflow. A future self-service registration flow must not set `email_verified_at` until the verification challenge has actually completed.

## Remaining production gates

This hardening closes several of the original alpha gaps, but it is **not yet a claim of full production IAM readiness**.

Before broad public customer login, complete:

- passkey/WebAuthn support as an additional phishing-resistant factor
- secure account-recovery flow
- externally delivered email verification for self-service registration
- device/session management UI and device trust
- secret rotation procedures
- breach-response and lockout support procedures
- privacy/retention policy for audit data
- hardened backup/restore for the identity database
- independent security review and abuse testing

The service is now a materially stronger identity boundary for controlled IZAKHONO use while those remaining gates are completed.
