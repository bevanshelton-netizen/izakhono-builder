# IZAKHONO MAIL Runtime v1

Owned mail hosting for IZAKHONO portfolio domains, using the existing Stalwart mail plane and Roundcube webmail. The runtime attaches to the shared IZAKHONO HOST EDGE; it does not start a second public Caddy instance.

## Canonical stack

- **Stalwart** — SMTP, submission, IMAP, JMAP, domain/mailbox directory, DKIM and ACME certificate management.
- **Roundcube** — customer webmail over IMAPS and SMTP submission.
- **MariaDB** — Roundcube session/preferences database only.
- **IZAKHONO HOST EDGE / Caddy** — the only public HTTP/HTTPS edge; routes `webmail.izakhonoafrica.co.za` to Roundcube and forwards the mail-host HTTP-01 ACME challenge to Stalwart.
- **IZAKHONO Provisioner** — creates domains/mailboxes through the private Stalwart JMAP adapter only after DNS verification.

The previous Docker Mailserver deployment is superseded. Do not run DMS and Stalwart as parallel production mail engines for the same domain.

## Names and ports

- SMTP server-to-server: `mail.izakhonoafrica.co.za:25`
- SMTP submission: `mail.izakhonoafrica.co.za:587` (STARTTLS)
- SMTPS: `mail.izakhonoafrica.co.za:465`
- IMAPS: `mail.izakhonoafrica.co.za:993`
- Webmail: `https://webmail.izakhonoafrica.co.za`
- Stalwart admin: loopback only at `http://127.0.0.1:18081/admin`
- Stalwart bootstrap/JMAP: loopback only at `http://127.0.0.1:18081` (JMAP path `/jmap/`)

The mail runtime publishes no separate public web proxy. Public ports 80/443 remain owned by IZAKHONO HOST EDGE.

## Required infrastructure

- An owner-approved Linux host with Docker Engine and Compose v2.
- Public IPv4; IPv6 recommended.
- Inbound TCP 25, 465, 587 and 993 available to Stalwart.
- Shared HOST EDGE owns TCP 80 and 443.
- Outbound TCP 25 and 443 available.
- PTR/rDNS for the mail host points to `mail.izakhonoafrica.co.za`.
- The `izakhono-mail` Docker network exists (created by the owned HOST Compose stack).
- Public DNS A records for `mail` and `webmail`, MX, SPF, DKIM and DMARC.

## Owner-controlled bootstrap

1. Copy `.env.example` to `.env`; set a unique Roundcube DB password. Do not commit `.env`.
2. Start the owned HOST stack first so its shared edge and `izakhono-mail` network exist.
3. Run `./ops/preflight.sh`, then `./ops/bootstrap.sh`.
4. Complete Stalwart's first-run setup through an SSH tunnel to loopback port 18081. Never expose the bootstrap/admin listener publicly.
5. Create a Stalwart ACME provider using HTTP-01. HOST EDGE forwards only `/.well-known/acme-challenge/*` for the mail hostname to Stalwart. Record the provider ID in `STALWART_ACME_PROVIDER_ID`.
6. Set `STALWART_ADMIN_USERNAME` and `STALWART_ADMIN_PASSWORD` in the protected runtime environment. The JMAP endpoint must remain private/loopback.
7. Create the mail domain through the IZAKHONO Provisioner. It returns Stalwart's generated DNS zone material; publish the exact MX/SPF/DKIM/DMARC values through the approved DNS control plane.
8. Wait for DNS verification. Only then create customer mailboxes. The initial password is returned once and is never written to evidence files.
9. Run the full provider acceptance and independent send/receive tests before calling the service live.

## Provisioning contract

The Stalwart JMAP adapter:
- accepts only private/loopback JMAP endpoints;
- uses owner-held admin credentials supplied at runtime, never committed;
- creates or finds the mail domain and exports the server-generated DNS zone file;
- creates a mailbox only after the Provisioner verifies the required DNS;
- detects an existing account and returns `credentials_recovery_required` rather than falsely reissuing a password;
- stores only non-secret evidence (domain/account IDs, state and timestamps).

Example from the repository root after Stalwart bootstrap and DNS configuration:

```bash
node --env-file=products/izakhono-mail/runtime-v1/.env \
  products/izakhono-mail/src/mailbox-provisioner.mjs "IZAKHONO" bevans
```

The generated password is a one-time secret. Deliver it through the approved owner-controlled secret channel; do not paste it into source, issues, CI logs or chat transcripts.

## Backup and recovery

Backups require an `age` recipient and are encrypted before leaving the node. The archive excludes `.env`, admin passwords and other runtime secrets; those must be restored separately from the approved secrets store. Restore requires the matching age identity, integrity verification and a post-restore mail acceptance run.

## Production gate

This package is **BUILD READY**, not **PRODUCTION VERIFIED**, until evidence exists for:
- public DNS A/MX/SPF/DKIM/DMARC and PTR;
- TCP 25/465/587/993 and valid certificates on SMTP/IMAP;
- authenticated SMTP submission and independent outbound delivery;
- inbound delivery from an independent sender;
- IMAPS authentication and Roundcube login;
- DKIM signature verification and DMARC alignment;
- encrypted backup, successful restore and post-restore delivery;
- FORTRESS access controls, audit evidence and rollback.

A running container, a created account, or a successful CI run alone does not prove public mail delivery.
