# IZAKHONO MAIL

IZAKHONO MAIL is the owner-controlled outbound mail relay used by portfolio services such as IZAKHONO SIGN.

It provides a durable, idempotent application API while keeping the actual SMTP transport replaceable.

## API

Internal authenticated routes:

- `GET /healthz`
- `GET /readyz`
- `POST /v1/send`
- `GET /v1/outbox`
- `POST /v1/run-due`

Example:

```json
{
  "idempotency_key": "act_123",
  "to": {"name":"Recipient","email":"recipient@example.com"},
  "subject": "Signature requested: NDA",
  "body_text": "Open the secure signing link...",
  "metadata": {"draft_id":"doc_123"}
}
```

## SMTP

Transport is standard SMTP, not provider-specific.

Supported modes:

- implicit TLS, typically port 465: `MAIL_SMTP_SECURE=true`
- STARTTLS, typically port 587: `MAIL_SMTP_STARTTLS=true`
- SMTP AUTH PLAIN when `MAIL_SMTP_USER` is configured

Required for actual outbound transmission:

- `MAIL_SMTP_HOST`
- `MAIL_SMTP_PORT`
- `MAIL_FROM_EMAIL`
- credentials when required by the upstream server

The SMTP server can later be an IZAKHONO-owned mail server or a reversible external relay.

## Truthful state

If SMTP is not configured, messages remain durably stored as `awaiting_smtp`. They are not represented as sent.

After the SMTP server returns a successful response to the DATA transaction, the record becomes `outbound_accepted`. This means the outbound SMTP server accepted the message; it is not proof that the recipient opened or read it.

Repeated `idempotency_key` requests do not create duplicate outbound messages.

## Privacy

- no behavioural tracking
- no advertising identifiers
- no SMTP credentials in source control
- secrets remain in the NODE01 machine-local environment
- audit events do not record SMTP passwords
- portfolio metadata is kept separate from the mail transport

## NODE01

Use `owner-node/START-IZAKHONO-MAIL-SIGN.cmd`.

The launcher first verifies the existing DOCFLOW/FLOWIQ/CRM/SIGN internal chain, then deploys MAIL and binds SIGN to it on the private `izakhono-internal` network.

If SMTP is not yet configured, this is still a valid internal deployment: SIGN will create an envelope and MAIL will safely queue the invitation until a real SMTP route is configured.
