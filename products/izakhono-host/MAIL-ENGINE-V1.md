# IZAKHONO MAIL ENGINE V1

## Purpose

Provide a tenant-safe business-mail plane for IZAKHONO HOST without making a website deployment appear complete when outbound mail has not been proven.

## Modes

1. **Owned SMTP** — preferred production path. Mail transport runs on IZAKHONO-owned infrastructure and is exposed through a typed mail adapter.
2. **External SMTP/API adapter** — reversible fallback. Provider credentials remain server-side and are never committed to the repository.
3. **Mailto fallback** — presentation-only fallback. A website may open the visitor's mail client, but this is **not** transactional email acceptance.

## Acceptance gates

A customer mail service is not accepted as live until all applicable evidence exists:

- domain has a valid MX record;
- SPF is present and aligned with the selected sending path;
- DKIM is configured and verified for the sending identity;
- DMARC is present and aligned with the policy;
- SMTP/API transport is configured without exposing secrets;
- a real outbound test message is accepted by the transport;
- delivery is independently verified in the destination mailbox or provider delivery evidence;
- bounce/rejection handling is known;
- customer domain and tenant identity are isolated from other tenants.

## Current XQWAXQWAMILÉ state

The website is serving from its verified production deployment. Its current contact path is `mailto:info@xqwaxqwamile.com`, so browser mail-client fallback exists. Server-side transactional sending is still a mail-engine gate.

The repository currently contains `MAIL-ACCEPTANCE.sh` as a deterministic, read-only preflight. It never sends mail and never prints credentials. Run it with `MAIL_DOMAIN=<domain>`. Use `MAIL_ACCEPTANCE_STRICT=1` only when promoting the mail plane and requiring transport configuration.

## Hard external gate

No real transactional send can be certified from source code alone. The remaining promotion evidence requires either an activated owned SMTP node with public DNS/network reachability or an authorized SMTP/API transport with credentials. Credentials must be supplied through secret storage, never source control.
