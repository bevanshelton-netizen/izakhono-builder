# IZAKHONO MAIL — Provider Acceptance Gate

A compute provider is accepted only when it can support an independent production mail server.

## Mandatory capabilities

- Public static IPv4
- PTR/rDNS configurable to `mail.izakhonoafrica.co.za`
- Inbound TCP 25 reachable from the Internet
- Outbound TCP 25 reachable to external MX servers
- TCP 465 and/or 587 for authenticated submission
- TCP 993 for IMAPS
- TCP 80/443 for webmail and ACME
- Persistent storage and Docker Compose v2

## Provider selection rule

Do not provision the production mailbox until the provider's current policy and the actual allocated IP have passed the SMTP gate. A provider policy that requires a support request is not considered immediately ready unless that request has already been approved.

## Current research position — 22 October 2026

- **Contabo: PREFERRED FIRST CANDIDATE.** Current Contabo documentation says servers have unrestricted port access by default, each VPS receives a static public IPv4, and PTR/rDNS is managed through the Control Panel. The exact allocated server must still pass the external SMTP gate. citeturn0search0turn0search2turn0search3
- **DigitalOcean: REJECT for direct self-hosted SMTP.** Current DigitalOcean documentation states SMTP ports 25, 465 and 587 are blocked on Droplets.
- **Hetzner Cloud: CONDITIONAL.** Ports 25 and 465 are blocked by default and require an eligibility/unblock process; it is therefore not the first-runtime choice.

Provider selection remains reversible. The runtime must work independently of any provider-specific application stack.

## Final acceptance test

After provisioning, run:

1. DNS A/MX/PTR checks.
2. External TCP 25 connectivity test.
3. SMTP banner test.
4. IMAPS 993 TLS/authentication test.
5. SMTP submission 587 test.
6. External outbound delivery test.
7. External inbound delivery test.
8. SPF/DKIM/DMARC verification.
9. TLS certificate verification.
10. Backup and restore test.

Only then may `bevans@izakhonoafrica.co.za` be declared production-ready.
