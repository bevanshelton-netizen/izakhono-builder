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

- DigitalOcean: **REJECT** for this architecture. Its official documentation states SMTP ports 25, 465 and 587 are blocked on Droplets. citeturn0search1
- Hetzner Cloud: **CONDITIONAL**. Ports 25 and 465 are blocked by default; Hetzner says they may be unblocked after one month and a paid first invoice through a limit request. citeturn0search0
- OVHcloud: **PREFERRED CANDIDATE — VPS/dedicated only, non-Local-Zone**. Official documentation states port 25 is not blocked by default on dedicated servers or VPS, while Public Cloud and Local Zone products have restrictions. Verify the exact ordered product/location before provisioning. citeturn0search5turn0search7

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
