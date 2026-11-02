# NODE01 MAIL ENGINE v1

## Purpose

NODE01 is the software orchestration layer for the IZAKHONO owned infrastructure. It provisions and verifies business email identities without making Gmail, Vercel or another hosted platform the production dependency.

## Architecture

`NODE01 → MAIL CONTROL → Postfix → Dovecot → Rspamd → DKIM → DNS/CoreDNS → Caddy/webmail → FORTRESS`

External providers are adapters/fallbacks only.

## Provisioning contract

Input:

- domain
- mailbox local-part
- display name
- tenant/business
- quota
- aliases

Output:

- mailbox identity
- mailbox credentials reference (never plaintext in source)
- MX/SPF/DKIM/DMARC records
- IMAP/SMTP endpoints
- verification job
- audit record

## Acceptance gate

A mailbox is **NOT live** until all of the following pass:

1. Domain DNS resolves through the authoritative path.
2. MX points to the owned mail ingress.
3. SPF is present and syntactically valid.
4. DKIM key is published and signature verification passes.
5. DMARC policy is present.
6. SMTP submission authenticates.
7. IMAP authentication works.
8. Internal delivery succeeds.
9. External delivery succeeds.
10. External reply reaches the mailbox.
11. TLS certificate validates.
12. No production secret is stored in the repository.

## Safety

NODE01 must generate credentials/secrets at runtime and store references in the FORTRESS secret store. Repository files may contain identity manifests and non-secret DNS templates only.

## First identities

The initial rollout uses the existing IZAKHONO ecosystem identities. The exact domain list is maintained in `mail/identities.json`. Domains that are not yet owned or delegated remain `PENDING_DOMAIN`; NODE01 must never claim them live.

## Rollout rule

Build the engine once. Add identities as data. Do not manually rebuild mail infrastructure for each business.

## Fallback

If the owned mail plane is unavailable, NODE01 may route through an explicitly configured external adapter. This is a reversible fallback and must be visible in health state. Vercel is not an email provider and is not used for the mail plane.
