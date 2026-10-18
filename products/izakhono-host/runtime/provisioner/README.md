# IZAKHONO Provisioner State Machine

This module is the native contract for customer provisioning. It prevents a customer from being marked `LIVE` merely because a ledger record exists.

## Required progression

`PLANNED → PAYMENT_VERIFIED → DOMAIN_READY → DNS_READY → SITE_READY → TLS_READY → MAIL_READY → INTEGRATIONS_READY → ACCEPTANCE_PENDING → LIVE`

`FAILED` and `PAUSED` are explicit non-live states.

## Safety rules

- Every provisioning request must have an idempotency key.
- Transitions are dependency-aware.
- Retries are bounded to five attempts with increasing delays.
- Audit events are appended for creation, attempts and state transitions.
- `LIVE` requires verified HTTPS, DNS, content and mail acceptance evidence.
- No module in this state machine claims public availability without acceptance evidence.

The state machine is deliberately provider-neutral. Domain registration, DNS, TLS, mail, CRM, WhatsApp, forms and payment-link adapters can be replaced without changing the provisioning contract.
