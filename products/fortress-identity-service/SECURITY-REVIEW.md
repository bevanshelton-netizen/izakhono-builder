# FORTRESS Identity Issuer — security review gate

Implemented foundation: durable D1 principal, tenant, session, login-throttle and audit tables; one-time bootstrap; PBKDF2 password derivation; generic credential failures; persistent IP/email throttling; HS256 10-minute JWT; 30-day opaque refresh token rotation; hashed refresh-token persistence; logout revocation; D1-backed session introspection; Secure host-only cookies; exact-origin + CSRF enforcement; audit events without plaintext credentials.

Before general customer launch: implement MFA/WebAuthn, password recovery/change, owner/admin lifecycle, refresh replay detection and atomic rotation, Creator-side access revocation/introspection on every request, alerting/retention, backup/restore, independent security review and browser end-to-end tests. Verify cookie route topology: __Host- cookies cannot cross hostnames; issuer paths must be served on the Creator origin. Do not enable public signup or claim full SSO/MFA readiness.
