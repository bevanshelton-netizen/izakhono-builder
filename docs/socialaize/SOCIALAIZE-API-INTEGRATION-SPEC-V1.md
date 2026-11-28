# SOCIALaiZe — API and Integration Specification V1

**Status:** Proposed contracts; no live provider connection is asserted.

## 1. API principles

- Version all public and internal contracts.
- Authenticate every non-public route.
- Derive workspace/entity/platform scope from trusted identity context.
- Authorise the specific action and resource on every request.
- Validate input and output schemas.
- Use idempotency for commands that can be retried.
- Return truthful asynchronous states.
- Record audit and correlation references.
- Never expose provider credentials to clients.

## 2. Core API groups (proposed)

- `/api/v1/workspaces` — workspace lifecycle and membership.
- `/api/v1/brands` — brand profile and brand-kit references.
- `/api/v1/connections` — OAuth start/callback, capability and revocation.
- `/api/v1/content` — briefs, drafts, variants, assets and approvals.
- `/api/v1/calendar` — schedules and publication plans.
- `/api/v1/campaigns` — campaign planning, approval and status.
- `/api/v1/publishing/jobs` — enqueue, inspect, cancel where supported and reconcile.
- `/api/v1/analytics` — source-attributed metrics and reports.
- `/api/v1/leads` — consent-aware intake and CRM handoff status.
- `/api/v1/ai/tasks` — AI task request, review and completion.
- `/api/v1/billing/entitlements` — read-only entitlement view from canonical billing.
- `/api/v1/audit` — authorised audit views.

These are proposed route families, not currently implemented endpoints.

## 3. Social provider adapter contract

Each adapter should expose capability discovery and, where officially supported:
- begin authorisation;
- exchange and refresh tokens server-side;
- inspect account identity and granted scopes;
- validate publishing capability and media constraints;
- submit a publication;
- retrieve publication status;
- process signed webhooks;
- reconcile provider-side state;
- revoke/disconnect authorisation.

Provider-specific restrictions, review requirements, app verification, user permissions, rate limits and content formats must be documented per adapter. Manual publishing remains a supported fallback.

## 4. Publishing state machine

`DRAFT -> PENDING_APPROVAL -> APPROVED -> SCHEDULED -> QUEUED -> SUBMITTED -> PUBLISHED`

Exceptional states: `REJECTED`, `CANCELLED`, `RETRY_WAIT`, `FAILED`, `UNKNOWN_REQUIRES_RECONCILIATION`.

A provider submission must not be labelled published until authoritative provider evidence or a defined verification procedure supports that state. Retries must not create duplicate public posts.

## 5. Campaign and spend controls

Organic publishing and paid advertising are distinct permissions. A campaign's creative approval does not authorise advertising spend. Paid-media writes require a verified customer-owned account, approved budget/currency/time window, explicit spend authority, destination validation and an auditable approval. Default is paused/manual.

## 6. AI provider contract

AI adapters accept typed task requests with explicit workspace scope, approved context, allowed output format, safety policy and cost ceiling. Responses include provider/model identity, task status, structured result, moderation/safety outcome, usage/cost metadata where available and provenance. AI may draft and recommend; externally visible publication or spending follows human/policy approval.

## 7. Webhooks

Verify signatures against the exact raw request body, enforce freshness and replay protection, deduplicate stable event IDs, acknowledge quickly and enqueue durable processing. Do not assume exactly-once delivery. Use bounded retries and dead-letter/manual review.

## 8. Internal integration contracts

- CREATE: request or reference approved creative packages; never bypass the portfolio creative source-of-record rule.
- ADS: submit approved distribution and advertising intents; do not duplicate spend controls.
- CRM: send consented lead/opportunity events through an authenticated, tenant-scoped handoff; CRM remains system of record.
- PAY: consume subscription/entitlement status; do not create a parallel ledger or wallet.
- ID/FORTRESS: verify identity, permission, secrets and audit context.

## 9. Connector readiness labels

`PLANNED`, `CONTRACT_REVIEWED`, `CREDENTIALS_CONFIGURED`, `SANDBOX_VERIFIED`, `PRODUCTION_APPROVED`, `ACTIVE`, `DISABLED`.

A source file, UI badge, successful local test or listed provider does not prove a production account is connected.
