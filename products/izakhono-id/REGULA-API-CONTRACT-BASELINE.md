# Regula IDV Platform — confirmed API contract baseline

**Status:** Documentation-only integration baseline. This is not a live connector, sandbox validation, or production approval.

This note records only the integration details currently stated in Regula's public IDV Platform documentation. The licensed IZAKHONO tenant's host, workflow, API version, permissions and configured checks must still be confirmed before implementing or enabling the transport.

## Confirmed server-side handoff flow

Regula documents a server-side session-start flow in which the IZAKHONO backend authenticates to the IDV Platform, creates a session and returns a hand-off URL to the client. This keeps the platform API key out of browser and mobile code and permits backend-only metadata.

Documented request shape:

- Method: `POST`
- Path: `/api/v1/deeplink?workflowId=<workflow_id>`
- Header: `Authorization: ApiKey <server_side_api_key>`
- Content type: `application/json`
- Documented body fields: `metadata`, `locale`, `ttl`
- Documented response fields: `url`, `createdAt`, `expiresAt`, `workflowIds`

The URL and token are short-lived hand-off material. Treat them as secrets: return only to the authenticated, authorized subject, never log them, and do not persist the raw token. Confirm actual TTL limits and workflow IDs with the licensed tenant.

## Confirmed API-key requirements

Regula documents API keys for machine-to-machine communication. For the server-side token URL flow, its documentation identifies:

- `deeplink:write` for creating the hand-off link.
- Access to the target workflow.

The exact permission needed to retrieve session data must also be granted. Regula's session-data guide says an API key with `All Sessions:Read` is sufficient for session retrieval. Ask Regula to confirm the narrowest available read scope for the IZAKHONO tenant; do not default to administrator access.

Keys must be held only in IZAKHONO server-side secret management, scoped to the sandbox initially, rotated, and excluded from source control, client bundles, logs and issue comments.

## Confirmed session retrieval

Regula documents:

- Method: `GET`
- Path: `/api/sessions/<session_id>`
- Header: `Authorization: ApiKey <server_side_api_key>`
- Accept: `application/json`

The response may contain a session `id`, integer `status`, `properties`, `files` and `metadata`. The exact content depends on the configured workflow. File references can point to binary material stored by the platform; IZAKHONO must not download or retain those files until evidence access, minimization, retention and deletion rules have been approved.

## What is not yet confirmed

Do not implement assumptions for the following until Regula supplies the licensed tenant's API specification and workflow:

1. The tenant's API base URL, deployed version and network exposure.
2. Workflow ID and exact document/face/liveness checks enabled for South African documents.
3. The complete mapping of integer session statuses and per-check result fields to IZAKHONO's normalized outcome model.
4. The cancellation/state-transition endpoint and permitted transitions.
5. Callback/webhook availability, signature format, replay protection and retry semantics. Polling is the fallback only after the session API and rate limits are confirmed.
6. Exact evidence-file retrieval and deletion APIs, retention settings and backup deletion guarantees.
7. API-key scopes supported by this tenant and whether the documented scopes can be separated by operation.

A generic terminal session status must never, by itself, mark an IZAKHONO subject as verified. The configured workflow must demonstrate all mandatory controls, and IZAKHONO must map the actual result fields before it can issue a verified outcome. Unknown, missing, contradictory or partially completed checks remain review-required or incomplete.

## IZAKHONO integration sequence

1. Authenticate the caller through IZAKHONO ID and derive the active entity from the trusted membership/session context. Never accept an arbitrary client-supplied entity as authorization.
2. Validate purpose, jurisdiction, notice version, lawful basis and entity policy.
3. Create an entity-scoped IZAKHONO verification record with idempotency protection.
4. Server-side: call the documented deeplink operation using the approved workflow and sandbox key.
5. Return only the short-lived hand-off URL to the authorized client.
6. On refresh, retrieve the session server-side and normalize only explicitly mapped fields.
7. Store minimal outcomes and opaque evidence references. Do not store raw documents, selfies, videos or biometric templates in the IZAKHONO ID database.
8. Keep review, deletion, retention and audit controls entity-scoped.

## Official documentation

- [Starting an IDV session](https://docs.regulaforensics.com/develop/idv/integration/starting-session/)
- [Token URL authentication and hand-off](https://docs.regulaforensics.com/develop/idv/integration/starting-session/authentication/token-url/)
- [API keys](https://docs.regulaforensics.com/develop/idv/integration/starting-session/authentication/api-key/)
- [Retrieving session data](https://docs.regulaforensics.com/develop/idv/integration/checking-results/session-data-via-api/)
- [IDV Platform architecture](https://docs.regulaforensics.com/develop/idv/overview/architecture/)

## Release gate

This baseline permits implementation planning and synthetic-data sandbox work only. No live customer identity capture, biometric processing, production credentials or production activation is authorized by this document or by a code merge. Complete the vendor, POPIA, FICA-applicability, security, commercial and business approval gates in [IDENTITY-VERIFICATION-REGULA.md](./IDENTITY-VERIFICATION-REGULA.md) first.
