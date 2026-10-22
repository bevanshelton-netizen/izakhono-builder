# IZAKHONO MAIL — Deployment Status

BUILD: READY
REPOSITORY: PUSHED
RUNTIME: NOT STARTED IN CHAT BUILD ENVIRONMENT
PUBLIC DNS: NOT VERIFIED
SEND/RECEIVE: NOT VERIFIED

The owner-hosted runtime package is committed under `products/izakhono-mail/runtime-v1/` on branch `feat/izakhono-mail-v1`.

Production certification requires the real NODE01/IZAKHONO host to start the containers and prove:
- SMTP submission and outbound delivery
- inbound SMTP delivery
- IMAP login
- TLS certificate validity
- SPF PASS
- DKIM PASS
- DMARC alignment/PASS
- PTR/reverse DNS
- webmail reachability

No production mailbox status is claimed until those gates pass.
