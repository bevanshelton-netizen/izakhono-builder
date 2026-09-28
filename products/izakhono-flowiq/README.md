# IZAKHONO FLOWIQ

IZAKHONO FLOWIQ is the portfolio workflow-orchestration engine. It accepts durable business events, projects them into workflow actions, and dispatches those actions through replaceable adapters.

It is an **independently deployable engine**. Shared IZAKHONO infrastructure is allowed, but FLOWIQ does not depend on DOCFLOW or another product engine to run.

## First production contract

FLOWIQ v1 accepts:

```
POST /v1/events
Authorization: Bearer <FLOWIQ_TOKEN>
```

DOCFLOW emits:

- `docflow.draft_created`
- `docflow.approved`
- `docflow.approve_and_send_requested`

The event is persisted before FLOWIQ returns success. Repeated events are idempotent.

For `docflow.approve_and_send_requested`, FLOWIQ creates three actions:

- `document_delivery`
- `crm_sync`
- `delivery_followup_schedule`

If the relevant downstream adapter is not configured, the action remains `awaiting_adapter`. FLOWIQ does **not** claim that a document was sent merely because the workflow event was accepted.

## Adapter boundaries

Optional adapters:

- `FLOWIQ_DELIVERY_URL` / `FLOWIQ_DELIVERY_TOKEN`
- `FLOWIQ_CRM_URL` / `FLOWIQ_CRM_TOKEN`
- `FLOWIQ_TASKS_URL` / `FLOWIQ_TASKS_TOKEN`

Configured adapters receive:

```json
{
  "action_id": "act_...",
  "action_type": "document_delivery",
  "event_id": "evt_...",
  "payload": {
    "workspace_id": "izakhono-africa",
    "legal_entity": "IZAKHONO AFRICA (PTY) LTD",
    "draft_id": "doc_..."
  }
}
```

No provider-specific implementation is hard-coded.

## Truthful state model

- `queued`: adapter exists and action is ready for execution.
- `running`: FLOWIQ is attempting the adapter.
- `completed`: adapter returned success.
- `retry`: an adapter attempt failed and can be retried.
- `awaiting_adapter`: workflow is safely persisted but there is no configured downstream service.

This prevents “queued” from being misrepresented as “sent”.

## Endpoints

- `GET /healthz` — process liveness.
- `GET /readyz` — database and auth readiness.
- `POST /v1/events` — accept one durable event.
- `GET /v1/events` — owner event ledger.
- `GET /v1/actions` — owner action ledger.
- `POST /v1/run-due` — process currently runnable actions.

All `/v1/*` routes require `FLOWIQ_TOKEN`.

## Persistence

SQLite WAL is used for the event, action, and audit ledgers. The NODE01 package mounts `/app/data` on a named persistent volume.

## Privacy and governance

FLOWIQ stores workflow metadata needed to execute a business process. It does not require behavioural tracking, advertising identifiers, or raw AI prompts. Protected domain data should remain in the owning source system; FLOWIQ should carry IDs and workflow metadata instead of unnecessary copies.

## NODE01

Production route:

**IZAKHONO CODE → IZAKHONO CONTROL → IZAKHONO NODE01 → FLOWIQ**

The service is internal by default. Public DNS is not required for DOCFLOW-to-FLOWIQ orchestration.
