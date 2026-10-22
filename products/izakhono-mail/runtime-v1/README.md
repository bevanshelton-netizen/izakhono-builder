# IZAKHONO MAIL Runtime v1

Owner-hosted production mail runtime for `izakhonoafrica.co.za`.

Target CEO mailbox: `bevans@izakhonoafrica.co.za`
Mail host: `mail.izakhonoafrica.co.za`

## Stack
- Docker Mailserver 16.0.1 — SMTP/IMAP and mail security
- Roundcube — webmail
- MariaDB — Roundcube state
- Caddy — HTTPS for webmail

## Production prerequisites
- Public IPv4 (IPv6 recommended)
- TCP 25, 465, 587, 993 and 443 reachable; TCP 80 for ACME
- PTR/reverse DNS: public IP -> `mail.izakhonoafrica.co.za`
- A record for `mail.izakhonoafrica.co.za`
- MX, SPF, DKIM and DMARC published for `izakhonoafrica.co.za`
- No conflicting services on mail/web ports

## Deploy on NODE01

```bash
cp .env.example .env
nano .env
chmod +x ops/*.sh
./ops/bootstrap.sh
```

The package does not contain production credentials. Do not commit `.env`.

## Client settings
- IMAPS: `mail.izakhonoafrica.co.za:993`
- SMTP submission STARTTLS: `mail.izakhonoafrica.co.za:587`
- Webmail: `https://mail.izakhonoafrica.co.za`

## Readiness contract

The runtime is **BUILD READY**, not **PRODUCTION VERIFIED**, until the real host proves SMTP send, inbound receive, IMAP login, TLS, SPF, DKIM and DMARC.
