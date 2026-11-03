# IZAKHONO MAIL

IZAKHONO-owned business email hosting and email API product.

## Product promise

Professional email on your own domain, provisioned by IZAKHONO, with webmail and an API-first control plane.

## Planned API surface

- `POST /v1/domains`
- `POST /v1/domains/{domainId}/verify`
- `POST /v1/mailboxes`
- `GET /v1/mailboxes/{mailboxId}/messages`
- `GET /v1/messages/{messageId}`
- `POST /v1/messages`
- `POST /v1/messages/{messageId}/reply`
- `POST /v1/attachments`
- `POST /v1/webhooks`
- `GET /v1/delivery/events`
- `GET /v1/domains/{domainId}/dns`

These are product design targets until implemented and verified.

## Protocol compatibility

The owned mail plane targets SMTP for transport and IMAP/JMAP-compatible access, with REST/JSON as the preferred application interface.

## Owned-first architecture

Mail is a first-class IZAKHONO infrastructure plane alongside CONTROL, EDGE, DNS, RUNTIME, DATA, BACKUP and FORTRESS. The existing HOST architecture defines the mail plane as Postfix/Dovecot/Rspamd-class services with DKIM/SPF/DMARC and deliverability gates.

## Provisioning flow

Customer → domain → DNS verification → mailbox → security records → acceptance tests → webmail/API access.

## Readiness rule

Do not describe mail hosting as live until DNS, SMTP, mailbox delivery, TLS, authentication, spam controls, outbound reputation and end-to-end acceptance tests have passed.
