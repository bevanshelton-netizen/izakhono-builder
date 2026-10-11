# IZAKHONO Mail Stack

Portfolio-wide business-email identity, routing and processing control plane.

## Purpose

Every IZAKHONO platform receives a professional business identity without requiring a paid mailbox per address.

The stack separates:
- platform identity;
- inbound routing;
- outbound transport;
- DNS authentication;
- mailbox storage;
- message processing and security policy.

This permits one controlled inbox/mailbox layer to serve many public aliases while every platform presents its own business address.

## Owned-first architecture

```
Platform app / website
  -> IZAKHONO Mail Identity Registry
  -> IZAKHONO Mail Gateway on NODE01
  -> message processor
  -> standards-based mail transport adapter
  -> public mail network

Inbound:
public MX
  -> approved inbound adapter / owned MTA
  -> IZAKHONO Mail Gateway
  -> message processor
  -> security / routing / audit
  -> authorised mailbox or platform queue
```

The transport adapter is replaceable. No platform may hard-code a commercial email provider as a permanent dependency.

## Thorough message processing

Every message entering the platform is intended to pass through the same deterministic processing contract before delivery:

1. Normalize sender and recipient addresses.
2. Validate sender, recipient count and message-size policy.
3. Generate a stable message identifier for deduplication/audit.
4. Classify risk indicators (normal, bulk, phishing, malware).
5. Resolve every recipient against the platform identity registry.
6. Route known recipients to the authorised mailbox/queue.
7. Quarantine critical-risk messages.
8. Send high-risk messages to security review rather than silently delivering them.
9. Keep unknown recipients unrouted rather than guessing a mailbox.
10. Record processing checks and disposition for auditability.

The implementation is in `mail-processor.mjs` and its contract tests are in `mail-processor.test.mjs`.

This processor is transport-agnostic: SMTP/IMAP, an owned MTA, or a replaceable relay can feed it without changing platform-facing email identities.

## Address policy

For a platform with a dedicated domain:

- `info@platform-domain`
- `support@platform-domain`
- `partnerships@platform-domain`
- `accounts@platform-domain`
- `noreply@platform-domain`

For a platform using the shared IZAKHONO AFRICA domain:

- `<slug>@izakhonoafrica.co.za`
- `<slug>-support@izakhonoafrica.co.za`
- `<slug>-partners@izakhonoafrica.co.za`
- `<slug>-accounts@izakhonoafrica.co.za`
- `noreply-<slug>@izakhonoafrica.co.za`

Addresses are generated from `platform-identities.json`.

## Security and deliverability gates

No address is marked LIVE until all applicable checks pass:

1. MX resolves to the active inbound route.
2. SPF authorises only approved senders.
3. DKIM signing verifies for the sender domain.
4. DMARC is published and passes alignment.
5. TLS is used for submission/relay where supported.
6. Sender address can successfully deliver to an external mailbox.
7. Reply to the public identity reaches the authorised IZAKHONO mailbox/queue.
8. No production secret is committed to the repository.
9. The transport provider can be replaced without changing platform-facing identities.

## NODE01 configuration

Runtime secrets belong on NODE01 or the approved secret store, never in Git.

Expected variables:

- `MAIL_API_TOKEN`
- `MAIL_TRANSPORT_MODE`
- `MAIL_RELAY_URL`
- `MAIL_RELAY_TOKEN`
- `MAIL_INBOUND_TARGET`
- `MAIL_DEFAULT_FROM_DOMAIN`

An owned MTA may be used when IZAKHONO has a suitable public IP, PTR/rDNS, open mail ports and a deliverability plan. Until those gates are proven, a replaceable standards-based relay may be used as an external bridge.

## Commands

```
node infra/mail-stack/verify.mjs
node infra/mail-stack/render-addresses.mjs
node infra/mail-stack/mail-processor.test.mjs
```

Windows:

```
VERIFY-IZAKHONO-MAIL-STACK.cmd
```

The generated CSV is an operational register only. DNS/mailbox provisioning still requires access to the authoritative DNS and active mail transport.

## Domain readiness

Public sender activation is controlled by `domain-readiness.json`.

Statuses:

- `DNS_UNRESOLVED` — no usable public DNS evidence; sender disabled.
- `ROUTED_AUTH_PARTIAL` — mail routing/authentication is partly present; sender disabled.
- `LIVE_VERIFIED` — DNS authentication plus real external send/reply verification passed; sender may be enabled.

The validator fails if any domain is marked `sender_enabled: true` before `LIVE_VERIFIED`.

Current 25 September 2026 evidence shows:
- `edubuildshelton.org.za`: MX/SPF/DKIM present, DMARC missing; not yet live-verified for portfolio relay use.
- `izakhonoafrica.co.za`, `faisready.co.za`, `doxahosting.co.za`: no usable public DNS evidence in the diagnostic run; senders remain disabled.
