# I-CONNECT — Initial API Contract

**Status:** Contract proposal for implementation; not a statement that every endpoint is deployed.

## Conventions

- Base path: /api/v1.
- JSON request/response bodies.
- Authenticated endpoints require a valid Supabase access token and server-side FORTRESS session verification for protected operations.
- Tenant scope is derived from verified membership; clients cannot select arbitrary tenant scope.
- Money uses integer minor units and ISO currency.
- Mutating requests accept Idempotency-Key.
- Every response includes request_id; errors include stable code, safe message and optional retryable.
- Pagination uses opaque cursor and bounded limit.
- Never return provider secrets, raw SIM credentials, private device keys or sensitive identity-document content.

## Identity and organisations

- GET /me — current profile, memberships and permitted capabilities.
- GET /organisations — organisations visible to the caller.
- POST /organisations — create organisation where the caller is permitted.
- GET /organisations/{organisationId} — tenant-scoped organisation details.
- GET /organisations/{organisationId}/members — permitted membership list.
- POST /organisations/{organisationId}/invitations — invite a member.
- PATCH /organisations/{organisationId}/members/{memberId} — change permitted role/status.

## Catalogue and subscriptions

- GET /catalogue — published products filtered by eligibility and market.
- GET /catalogue/{productId} — product and versioned plan details.
- POST /quotes — calculate a quote from server-controlled price book and eligibility.
- GET /subscriptions — caller's permitted subscriptions.
- POST /subscriptions — create subscription checkout intent; does not activate a service.

## Orders and payments

- POST /orders — create order from a valid quote.
- GET /orders/{orderId} — tenant-scoped order and lifecycle.
- POST /orders/{orderId}/cancel — cancel only where lifecycle and provider terms permit.
- POST /payments/intents — create server-side payment intent.
- POST /webhooks/payments/{provider} — provider-signed webhook ingress; verify signature and replay protection before ledger update.
- GET /invoices — permitted invoices.
- GET /invoices/{invoiceId} — invoice details.
- POST /payments/{paymentId}/reconcile — restricted finance/operator action; never client-accessible.

## Provisioning and providers

- GET /provisioning/jobs — tenant or platform-operator scoped jobs.
- GET /provisioning/jobs/{jobId} — job, step attempts and exception state.
- POST /provisioning/jobs/{jobId}/retry — operator-only, policy-checked retry.
- GET /providers/status — safe provider readiness and capability summary.
- GET /connectivity/services — customer service inventory.
- GET /connectivity/services/{serviceId} — service state and verified upstream references.
- POST /connectivity/services/{serviceId}/suspend — authorised action; upstream confirmation required.
- POST /connectivity/services/{serviceId}/resume — authorised action; upstream confirmation required.

## Messaging and safety

- GET /conversations — conversations visible to the caller.
- POST /conversations — create conversation/group.
- GET /conversations/{conversationId}/messages — paginated message envelopes.
- POST /conversations/{conversationId}/messages — submit message; returns queued state until transport evidence exists.
- POST /messages/{messageId}/receipts — trusted delivery receipt ingestion; authenticated service-to-service only.
- POST /incidents/sos — create a deliberate SOS event with consented location snapshot and trusted contacts.
- GET /incidents/{incidentId} — event state, route attempts and acknowledgements.
- POST /incidents/{incidentId}/acknowledgements — authenticated human acknowledgement with actor and timestamp.

## FORTRESS and audit

- FORTRESS device enrolment and revocation use the deployed fortress-device-identity Edge Function contract.
- GET /security/devices — user's registered devices.
- POST /security/sessions/verify — protected service-side check; do not expose privileged verification secrets.
- GET /audit/events — role-restricted audit search with minimised payloads.

## Standard lifecycle states

### Payment
CREATED -> PENDING -> VERIFIED | FAILED | EXPIRED | REFUNDED | DISPUTED.

Only a verified server-side event may set VERIFIED.

### Provisioning job
QUEUED -> RUNNING -> SUCCEEDED | FAILED | MANUAL_REVIEW | CANCELLED.

Retries create immutable attempts and preserve the original idempotency key. Unknown upstream outcomes are reconciled before another charge or activation attempt.

### Connectivity service
DRAFT -> ORDERED -> PROVISIONING -> ACTIVE -> SUSPENDED -> TERMINATED.

ACTIVE requires authoritative upstream or owned-network evidence. A sandbox success cannot activate a production service.

### Message
QUEUED -> ATTEMPTING -> SENT -> DELIVERED -> ACKNOWLEDGED, with terminal FAILED or EXPIRED where appropriate. Each transition requires evidence; delivery is not human acknowledgement.

## Security requirements

- Validate object-level tenant access on every read/write.
- Apply rate limits and abuse controls to login, invitations, messaging, SOS and webhook ingress.
- Verify webhook signatures, timestamps, replay windows and event uniqueness.
- Use transactional outbox/inbox patterns for payment and provisioning events.
- Do not let clients set payment status, provider status, service activation, delivery receipt or human acknowledgement.
- Require step-up authentication for role changes, payment refunds, device revocation and sensitive account changes.
- Log actor, action, target, timestamp, request ID and outcome without logging secrets or full sensitive payloads.
