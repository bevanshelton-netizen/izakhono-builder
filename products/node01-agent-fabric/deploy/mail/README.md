# NODE01 real mail runtime

This deployment is the missing runtime layer for IZAKHONO MAIL. The existing NODE01 worker fabric is not itself an SMTP/IMAP server.

## Stack

- Postfix: SMTP/MTA and authenticated submission
- Dovecot: IMAP/mailbox access and SASL authentication
- Rspamd: DKIM signing and mail filtering
- Docker volumes: durable mailbox, queue, and configuration state
- Health/acceptance scripts: local service and external-path gates

## Required production inputs

Set these before deployment:

- `MAIL_DOMAIN` — the authoritative mail domain
- `MAIL_HOSTNAME` — public mail hostname, e.g. `mail.example.co.za`
- `MAIL_IP` — static public IPv4 address
- `ADMIN_MAILBOX` — initial administrative mailbox
- `ADMIN_PASSWORD` — supplied through a secret manager, never committed
- `DKIM_SELECTOR` — signing selector

The host must have a stable public IP, working reverse DNS/PTR to `MAIL_HOSTNAME`, and inbound TCP/25 plus submission TCP/465 or 587 and IMAPS TCP/993 permitted by the provider/firewall.

## DNS gates

Before calling the system production-ready, publish and verify:

- `A/AAAA` for `MAIL_HOSTNAME`
- `MX` for `MAIL_DOMAIN` → `MAIL_HOSTNAME`
- SPF TXT authorizing the production MTA
- DKIM TXT for `DKIM_SELECTOR._domainkey.MAIL_DOMAIN`
- DMARC TXT at `_dmarc.MAIL_DOMAIN`

## Security gates

- No open relay
- TLS certificate must match `MAIL_HOSTNAME`
- Authenticated submission only
- IMAP access over TLS
- DKIM signing enabled
- Rate limiting and abuse controls enabled
- Credentials supplied only as runtime secrets

This package intentionally does not claim public production status. Production is accepted only after the NODE01 production-gate harness verifies external inbound, external outbound, external reply routing, authentication headers, TLS, and mailbox persistence.