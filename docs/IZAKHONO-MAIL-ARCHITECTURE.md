# IZAKHONO MAIL — Shared Communication Layer

## Purpose

IZAKHONO MAIL is the common email communication layer for IZAKHONO ONE and all connected applications. Applications call one internal mail contract rather than implementing their own email delivery, templates, merge tags, queues, or analytics.

## Applications

- IZAKHONO ONE
- IZAKHONO PAY
- IZAKHONO NAV
- IZAKHONO WORK
- KORA Network
- FAISReady
- IZAKHONO BUILDER
- IZAKHONO PROVISIONER
- Allegro Vibez
- Future IZAKHONO applications

## Control-plane responsibilities

1. Template storage and versioning
2. Brand profiles
3. Merge-tag definitions
4. Transactional email orchestration
5. Campaign orchestration
6. Delivery-provider routing
7. Retry and failure handling
8. Event ingestion
9. Delivery/open/click analytics
10. Audit logging
11. FORTRESS authorization boundaries

## Internal contract

`POST /api/mail/send`

Request concept:

```json
{
  "app": "izakhono-pay",
  "template": "payment-success",
  "to": [{"email": "customer@example.com", "name": "Customer"}],
  "data": {"amount": "R1,250.00", "reference": "PAY-123"},
  "metadata": {"tenantId": "tenant_123"}
}
```

The application supplies business facts. IZAKHONO MAIL owns rendering, provider routing, delivery events and audit records.

## Editor strategy

Use a portable visual editor rather than a hosted proprietary editor. The preferred integration target is an MIT-licensed editor capable of exporting portable JSON plus HTML/MJML/React Email. The editor remains a replaceable presentation layer; IZAKHONO owns templates, storage, APIs, authentication and sending infrastructure.

## Provider strategy

Provider adapters must remain replaceable. Initial adapters may target SMTP and external ESP APIs. No application should depend directly on a provider SDK for core business logic.

## Security

- Never expose provider credentials to the browser.
- Tenant isolation is mandatory.
- FORTRESS controls authorization for templates, recipients, campaigns and delivery actions.
- Transactional and marketing permissions are distinct.
- Every send receives an audit/event identifier.
- Secrets belong only in server-side runtime configuration.

## Delivery states

`queued -> rendering -> sending -> accepted -> delivered`

Failure states:

`render_failed | provider_failed | bounced | rejected | suppressed`

## Initial template families

### Transactional

- welcome
- email-verification
- password-reset
- payment-success
- payment-failed
- invoice
- receipt
- subscription
- security-alert
- provisioning-complete

### Marketing

- product-launch
- promotion
- newsletter
- lead-follow-up
- reactivation
- campaign

## Design principle

**One IZAKHONO mail brain. Every app speaks the same contract.**

External providers can change without rewriting the applications.
