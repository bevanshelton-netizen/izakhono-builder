# IZAKHONO MAIL — Portfolio Provisioning Runbook

## Objective

Provision professional email for every authorized IZAKHONO platform from one owned-first mail plane. The same workflow must work for IZAKHONO-owned domains and reversible external domain/mail adapters.

## Target service

**IZAKHONO MAIL** is a tenant-isolated mail service under IZAKHONO HOST.

### Mail plane

- Postfix-class SMTP transport
- Dovecot-class IMAP/mailbox access
- Rspamd-class filtering and reputation controls
- DKIM signing
- SPF publication
- DMARC publication and reporting
- TLS for SMTP/IMAP/webmail
- per-domain/per-mailbox isolation
- abuse/rate limiting
- mailbox quotas
- backup and restore
- audit trail
- secure admin provisioning

## Standard address set

Every platform receives, where applicable:

- `info@DOMAIN`
- `admin@DOMAIN`
- `support@DOMAIN`
- `accounts@DOMAIN`
- `sales@DOMAIN`
- `partnerships@DOMAIN`
- `security@DOMAIN`
- `noreply@DOMAIN`

Specialised channels such as KORA NETWORK also receive:

- `news@DOMAIN`
- `sports@DOMAIN`

## Automated provisioning

`platform_created`
→ resolve verified domain
→ create tenant
→ create DNS zone/records
→ configure MX
→ publish SPF
→ generate DKIM identity
→ publish DKIM
→ publish DMARC
→ create mailbox set
→ create role aliases
→ enable webmail/IMAP/SMTP
→ run DNS/mail acceptance
→ send controlled test message
→ verify destination receipt
→ record evidence
→ mark `DELIVERY_VERIFIED`
→ hand over mailbox credentials securely.

## Security rules

1. No mailbox password or SMTP credential is committed to Git.
2. Secrets are injected only through the production secret store.
3. Tenant mailboxes cannot read another tenant's mail.
4. Administrative access is audited.
5. Sending limits and abuse controls are mandatory.
6. DKIM keys are unique per domain/identity.
7. Mail is not labelled LIVE until real delivery evidence exists.

## Current portfolio

The machine-readable source of truth is `mail/portfolio-mailboxes.yml`.

The manifest currently includes KORA NETWORK, I-CONNECT, FAISReady, DOXA-SURE, Edu-Build Institute, Allegro Vibez, IZAKHONO NAV, IZAKHONO ARTWORK, IZAKHONO INVEST, IZAKHONO BUILDER, IZAKHONO HOST, FORTRESS, IZAKHONO CLOUD, IZAKHONO CODE, IZAKHONO WORK, KORA GAMING and KORA MARKET.

Additional authorized platforms can be added without changing the mail engine.

## Physical activation gate

Source control defines and validates the system, but actual mailbox activation requires a reachable mail node, domain ownership/delegation, public DNS and network access, TLS certificates, storage, and secure secrets. These are execution gates, not reasons to redesign the system.
