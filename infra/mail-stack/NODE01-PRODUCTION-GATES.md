# NODE01 / IZAKHONO MAIL — Production Gates

This checklist is the release gate for production mail. Software readiness is not equivalent to LIVE status.

## Gate 1 — Runtime
- NODE01 mail runtime starts cleanly.
- Durable queue and mailbox stores initialize successfully.
- Health endpoint reports queue, mailbox persistence and transport status.
- Graceful restart restores queued jobs and mailbox contents.

## Gate 2 — SMTP / Submission
- TCP/25 accepts an SMTP greeting from an external network.
- Submission endpoint is reachable on the configured port.
- TLS certificate is valid for the public mail hostname.
- Submission authentication is supplied by the NODE01 credential/auth adapter; credentials are never stored in source code.
- Relay policy rejects unauthorized external relaying.
- Recipient policy rejects unknown local recipients where appropriate.
- Message size and recipient limits are enforced.

## Gate 3 — DNS / Authentication
- Public A/AAAA record resolves the mail host.
- MX records point at the intended NODE01 mail host.
- SPF authorizes the actual outbound sender path.
- DKIM signing is active and the public key is published.
- DMARC is published and aligned with the actual From domain.
- PTR/rDNS identifies the outbound mail host consistently.

## Gate 4 — External Delivery
- Send a real message from NODE01 to an independent external mailbox.
- Confirm the message arrives and inspect authentication results.
- Send a real message from an independent external mailbox to an IZAKHONO mailbox.
- Confirm NODE01 accepts and persists the message.
- Reply from the IZAKHONO mailbox to the external sender.
- Confirm the reply arrives externally.

## Gate 5 — Identity Registry
- Every production platform identity has a unique address.
- No generated address collides with another platform identity.
- Each identity maps to a known platform, mailbox and role.
- Disabled/unverified domains cannot be presented as production-ready.

## LIVE rule

IZAKHONO MAIL MUST NOT be labelled `LIVE` until Gates 1–5 are independently evidenced, including real external send, receive and reply plus SPF/DKIM/DMARC and TLS verification.
