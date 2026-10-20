# IZAKHONO MAIL — owned mail service

This directory defines the owned-first mail runtime using Stalwart.

## Protocols

- SMTP: 25
- SMTPS: 465
- Submission: 587
- IMAP: 143
- IMAPS: 993
- HTTPS/WebUI/API: 443

Stalwart provides SMTP, IMAP, JMAP and the management interface in one server image. The deployment uses persistent `/etc/stalwart` and `/var/lib/stalwart` volumes.

## Activation

On NODE01:

```bash
cd products/izakhono-host/mail
export STALWART_RECOVERY_ADMIN='admin:REPLACE_WITH_A_REAL_SECRET'
docker compose -f docker-compose.mail.yml up -d
```

Never commit the recovery credential. Prefer a protected `.env` or secret store.

## Mailbox provisioning

After initial setup, provision the domain and accounts through the Stalwart management API/CLI. Account passwords are customer secrets and must never be committed to Git.

## Acceptance gate

A mailbox is not considered LIVE until all of these are independently verified:

1. MX resolves to the owned mail edge.
2. SPF, DKIM and DMARC are published and validated.
3. SMTP submission succeeds with authenticated TLS.
4. IMAPS login succeeds.
5. An external sender can deliver to the mailbox.
6. The mailbox can send to an external recipient.
7. The received message is visible through IMAP/JMAP.
8. TLS certificates validate for the public mail hostname.

Until those checks pass, status remains `PENDING`.
