# Final public activation

Use this only on the IZAKHONO owner host after the repository has been updated to the merged release.

The launcher intentionally asks for two values that must not be invented:

1. the approved public SIGN hostname;
2. an independently reachable HTTPS fallback URL.

Run:

`FINALIZE-IZAKHONO-SIGN-PUBLIC.cmd`

The launcher performs the safe sequence:

**NODE01 chain → MAIL readiness → SMTP evidence → SIGN public base → EDGE staging → EDGE dry run → optional EDGE apply → optional public DNS/TLS/fallback verification**

It stops automatically when a required gate is missing. In particular, it refuses to continue to public invitation delivery if SMTP is not configured.

The Desktop receives:

- `IZAKHONO-SIGN-FINAL-ACTIVATION.json`
- `IZAKHONO-SIGN-FINAL-ACTIVATION.log`
- and, when public verification is run, `IZAKHONO-SIGN-PUBLIC-VERIFY.json`

## What the launcher does not invent

It does not choose a hostname, DNS record, SMTP server, SMTP credential or fallback URL.

It does not edit public DNS because the authoritative DNS control plane is outside this repository package.

It does not call the service public-live unless public verification proves DNS, port 443, HTTPS health, the expected SIGN experience, TLS certificate evidence and the independent fallback.

## SMTP configuration

Machine-local file:

`/etc/izakhono/apps/izakhono-mail.env`

Actual outbound email requires at least:

- `MAIL_SMTP_HOST`
- `MAIL_SMTP_PORT`
- `MAIL_FROM_EMAIL`

and, where required:

- `MAIL_SMTP_USER`
- `MAIL_SMTP_PASSWORD`

TLS choices:

- `MAIL_SMTP_STARTTLS=true` for the usual port-587 route;
- or `MAIL_SMTP_SECURE=true` for implicit TLS, commonly port 465.

Secrets remain on NODE01 and are not committed.
