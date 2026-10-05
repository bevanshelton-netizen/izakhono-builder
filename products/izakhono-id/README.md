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
- secure account-recovery primitives with single-use hashed tokens and expiry
- bounded password-reset and email-verification request throttling
- owner-controlled SMTP email delivery with explicit disabled/log/test modes

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

The recovery library is now implemented in `account_recovery.py`; HTTP route wiring is kept as the next integration step so no public recovery endpoint is exposed before its customer-facing policy is connected to the existing MFA/session model.

## Recovery and email controls

Recovery and verification tokens are high-entropy, single-use values. Only SHA-256 token hashes are persisted. Default lifetime is 15 minutes. Request creation is bounded by a per-fingerprint rolling window, and callers can return one uniform response for known and unknown email addresses to prevent account enumeration.

Owner-controlled email delivery is configured with:

- `IZAKHONO_ID_EMAIL_MODE` (`smtp`, `log`, or `disabled`; default `smtp`)
- `IZAKHONO_ID_PUBLIC_BASE_URL`
- `IZAKHONO_ID_SMTP_HOST`
- `IZAKHONO_ID_SMTP_PORT` (default `587`)
- `IZAKHONO_ID_SMTP_USERNAME`
- `IZAKHONO_ID_SMTP_PASSWORD`
- `IZAKHONO_ID_SMTP_FROM`
- `IZAKHONO_ID_SMTP_STARTTLS` (default `true`)
- `IZAKHONO_ID_RECOVERY_TOKEN_SECONDS` (default `900`)
- `IZAKHONO_ID_RECOVERY_MAX_REQUESTS` (default `5`)
- `IZAKHONO_ID_RECOVERY_WINDOW_SECONDS` (default `900`)

Production must use real owner-controlled SMTP and HTTPS `IZAKHONO_ID_PUBLIC_BASE_URL`. `log` is a development/test mode and `disabled` deliberately sends nothing.

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

Before broad public customer login, complete:

- wire the recovery primitives into the ID HTTP API and Venture Factory customer UI
- make MFA recovery policy explicit; recovery must not silently bypass an enrolled second factor
- passkey/WebAuthn support as an additional phishing-resistant factor
- device/session management UI and device trust
- secret rotation procedures
- breach-response and lockout support procedures
- privacy/retention policy for audit data
- hardened backup/restore for the identity database
- independent security review and abuse testing
- real HTTPS certificate/DNS cutover on an activated IZAKHONO node

The identity service is a materially stronger boundary for controlled IZAKHONO use while these production gates are completed.
