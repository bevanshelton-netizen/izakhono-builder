# IZAKHONO J.A.R.V.I.S.

IZAKHONO-owned intelligent command centre for the IZAKHONO ecosystem.

## Product objective

A voice-first, multimodal AI operating system that can understand owner instructions, retrieve authorized business context, coordinate specialist agents, and execute approved workflows with auditable evidence.

## Current milestone: Foundation

This branch introduces the product specification, security boundaries, API contract, and a responsive command-centre interface prototype.

**Important:** The interface prototype is not connected to a live model, persistent memory, email, device control, or production tools. It must not claim those capabilities are active until their adapters are implemented, tested, and connected.

## Architecture

`Owner / authorized user → JARVIS interface → identity & policy gateway → orchestration engine → specialist agents → approved tools → evidence & audit log`

Core subsystems:

- **Experience:** responsive command centre, keyboard input, optional browser speech recognition, accessible status and activity views.
- **Identity and policy:** authenticated users, roles, scoped permissions, explicit approval for consequential actions.
- **Intelligence gateway:** provider-neutral model interface; model/provider selection stays server-side and replaceable.
- **Memory:** tenant-scoped, searchable records with provenance, retention controls, correction and deletion workflows.
- **Orchestration:** durable task graph, retries, timeouts, idempotency, cancellation and human approval gates.
- **Tools:** separately permissioned adapters for web research, files, repositories, email, calendars, business systems and deployments.
- **Evidence:** append-only action events, tool results, approvals, verification results and artifact references.
- **Infrastructure:** IZAKHONO-owned runtime first; external services are replaceable adapters, not the system of record.

## Non-negotiable safety rules

1. Never put provider credentials, admin secrets or service-role keys in browser code.
2. Treat model output, retrieved documents, webpages and tool results as untrusted data.
3. No arbitrary shell execution, unrestricted computer control, or open-ended tool access.
4. Require explicit confirmation for sending messages, spending money, publishing, deleting, changing access, or production deployment.
5. Apply least privilege, per-tool scopes, rate limits, audit records and idempotency keys.
6. Never represent a simulated capability as connected or live.
7. Store business memory by tenant and access scope; support retention and owner-controlled export/deletion.
8. The assistant may prepare consequential actions, but must pause at the approval gate before executing them.

## Persistence and intelligence gateway foundation

The Worker now exposes an owner-authorized D1 persistence API in `src/jarvis.ts`. It creates its own tables idempotently and scopes rows to the IZAKHONO tenant and owner identity. It supports conversation creation and listing, message history, idempotent user-message submission, owner-entered company/project/private memory, memory search and audit events.

When the existing server-side IZAKHONO SUPER AI workflow bindings are configured, message submission calls the reasoning workflow and persists the assistant response. Credentials remain server-side. Without those bindings, user messages are persisted and the API truthfully reports that intelligence is not connected. No external tools are exposed to the model in this milestone.

Run `npm run jarvis:typecheck` to type-check the new API module. The API uses the existing Builder owner authorization check. The static preview deliberately contains no administrator key and is not yet wired to this protected API.

## API contract (initial)

- `GET /api/jarvis/v1/status` — service readiness and enabled capability flags; never expose secrets.
- `POST /api/jarvis/v1/conversations` — create or resume an authorized conversation.
- `POST /api/jarvis/v1/conversations/:id/messages` — submit text and return a streamed assistant response.
- `GET /api/jarvis/v1/conversations/:id/events` — retrieve authorized conversation events.
- `GET /api/jarvis/v1/memory/search?q=...` — search only memory the caller may access.
- `POST /api/jarvis/v1/actions/:id/approve` — approve a specific immutable action proposal.
- `POST /api/jarvis/v1/actions/:id/reject` — reject a proposed action.
- `POST /api/jarvis/v1/actions/:id/cancel` — cancel a cancellable running action.

Every mutation must validate the session, tenant, permission, CSRF/origin policy where applicable, schema, idempotency key and audit requirements.

## Delivery sequence

1. Foundation UI and product contract.
2. Authenticated owner session and capability registry.
3. Provider-neutral model gateway with server-side secrets.
4. Conversation persistence and scoped memory.
5. Planner and durable orchestration.
6. Read-only tools first: status, search, files and reporting.
7. Approval-gated write tools: email drafts, CRM updates, publishing and deployment.
8. Voice input/output and multimodal image/document understanding.
9. Security, load, recovery, accessibility and end-to-end acceptance.
10. Owned-runtime deployment after infrastructure readiness and owner acceptance.

## Local preview

Serve `public/jarvis/index.html` through the existing IZAKHONO Builder static asset runtime, or open it directly in a browser. Browser speech recognition depends on browser support and permission. The preview uses demo data only.

## Release status

Foundation source is in a feature branch. This is not a production deployment and does not establish that JARVIS is publicly reachable.
