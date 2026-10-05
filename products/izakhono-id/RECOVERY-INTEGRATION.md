# IZAKHONO ID Recovery Integration

`recovery_api.py` is the HTTP boundary for the secure account-recovery primitives in `account_recovery.py`.

## Endpoints

- `GET /healthz`
- `POST /api/v1/recovery/request` — enumeration-resistant password-reset request; always returns HTTP 202 with a uniform message.
- `POST /api/v1/recovery/reset` — consumes a single-use password-reset token and changes the password.
- `POST /api/v1/email/verification/request` — enumeration-resistant verification resend request.
- `POST /api/v1/email/verification/confirm` — consumes a single-use verification token and marks the email verified.

## MFA safety rule

Recovery never creates a bearer session and never disables MFA. A successful password reset revokes all existing sessions and outstanding login challenges. The customer must sign in through the normal IZAKHONO ID login boundary afterward; an enrolled TOTP/recovery-code factor is therefore still required.

## Owner-controlled mail

Use the existing `account_recovery.py` SMTP controls:

- `IZAKHONO_ID_EMAIL_MODE=smtp`
- `IZAKHONO_ID_PUBLIC_BASE_URL=https://<verified-recovery-origin>`
- `IZAKHONO_ID_SMTP_HOST`
- `IZAKHONO_ID_SMTP_PORT=587`
- `IZAKHONO_ID_SMTP_USERNAME`
- `IZAKHONO_ID_SMTP_PASSWORD`
- `IZAKHONO_ID_SMTP_FROM`
- `IZAKHONO_ID_SMTP_STARTTLS=true`

`log` mode is for development/testing only. Production must use owner-controlled SMTP and HTTPS.

## Run

From `products/izakhono-id` on the same host and Python environment as the ID service:

```bash
export IZAKHONO_ID_DATA=/var/lib/izakhono-id/data
export IZAKHONO_ID_RECOVERY_HOST=127.0.0.1
export IZAKHONO_ID_RECOVERY_PORT=9697
export IZAKHONO_ID_PUBLIC_BASE_URL=https://id.example.com
export IZAKHONO_ID_EMAIL_MODE=smtp
python3 recovery_api.py
```

The recovery process shares the ID SQLite database through `IZAKHONO_ID_DATA` and automatically creates the recovery-token tables on startup.

## Reverse proxy

For a single public customer origin, route these paths to the recovery service:

- `/account-recovery`
- `/verify-email`
- `/api/v1/recovery/*`
- `/api/v1/email/verification/*`

Do not expose port `9697` directly to the public internet. Terminate TLS at the owner-controlled reverse proxy and keep the recovery service bound to loopback/private network.

## Production gates remaining

- Wire the public reverse-proxy paths into the activated NODE Fabric host.
- Add the final Venture Factory "Forgot password" and email-verification controls once the verified public recovery origin is known.
- Verify real SMTP delivery and HTTPS end-to-end on the activated node.
- Run independent security/abuse testing before broad public customer onboarding.
