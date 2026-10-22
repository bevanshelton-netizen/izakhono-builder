# IZAKHONO MAIL — Deployment Status

BUILD: READY
REPOSITORY: PUSHED
RUNTIME: NOT PROVISIONED
PUBLIC DNS: NOT VERIFIED
SEND/RECEIVE: NOT VERIFIED

The provider-neutral runtime is committed under `products/izakhono-mail/runtime-v1/` on `main`.

NODE01 is no longer a prerequisite. The first public runtime can be provisioned on a suitable Linux/Docker provider and must satisfy the provider acceptance gate before production use.

Production certification requires the real public host to prove:
- SMTP submission and outbound delivery
- inbound SMTP delivery
- IMAP login
- TLS certificate validity
- SPF PASS
- DKIM PASS
- DMARC alignment/PASS
- PTR/reverse DNS
- webmail reachability
- backup creation and restore

No production mailbox status is claimed until those gates pass.
