# IZAKHONO AI Workforce — Interface Contracts v1.0

**Status:** Proposed contract design; review required  
**Parent architecture:** `IZAKHONO-AI-WORKFORCE-ARCHITECTURE-V1.md`  
**Date:** 2026-11-23  
**Scope:** API and event contract design only. No production implementation, database schema, migration, credentials or runtime activation.

## 1. Contract principles

1. Every API is tenant-scoped and authenticated.
2. Every consequential operation is authorized by FORTRESS at the enforcement point.
3. A caller-supplied `approved: true` or role name is never authorization proof.
4. All writes carry a correlation ID and idempotency key.
5. All mutable resources expose a version/ETag; stale writes fail with conflict.
6. Agent identity is stable and immutable; configuration changes create a new AgentVersion.
7. Runtime registration, health, authorization and execution are separate facts.
8. Provider adapters declare unsupported capabilities explicitly.
9. Missing, stale or unverifiable evidence fails closed for consequential actions.
10. These contracts do not choose the production database or transaction implementation.

## 2. Common API envelope

All API requests use:
- `Authorization`: authenticated IZAKHONO principal or workload credential, validated by the receiving service;
- `X-IZK-Tenant`: tenant context, which must be checked against the authenticated principal and never trusted by itself;
- `X-Correlation-ID`: caller-provided or gateway-generated opaque correlation identifier;
- `Idempotency-Key`: required for non-idempotent writes and command requests;
- `If-Match`: required for updates to versioned resources.

All responses include:
- `request_id`, `correlation_id`, `timestamp`, `schema_version`;
- `status` and a stable machine-readable `error_code` on failure;
- `evidence_ref` for consequential operations when an evidence record has been durably acknowledged.

Never return secrets, raw access tokens, provider session material, identity documents or hidden provider memory in API payloads.

## 3. Agent Registry API

Base path (proposed): `/v1/agents`.

### 3.1 Create agent

`POST /v1/agents`

Request:
```json
{
  "tenant_id": "opaque-tenant-id",
  "owner_principal_id": "opaque-principal-id",
  "display_name": "Research Specialist",
  "agent_kind": "specialist",
  "provider_binding_ref": "provider-binding-id",
  "capability_refs": ["research.read.v1"],
  "policy_profile_ref": "policy-profile-id",
  "metadata": {"team": "research"}
}
```

The service derives the authenticated actor from the verified principal. The tenant and owner fields are consistency assertions and must match authorized scope. The caller cannot choose lifecycle state, verification level, internal ID or runtime registration status.

Response returns `agent_id`, immutable creation provenance, `lifecycle_state=PROPOSED`, `version=1` and evidence reference. Creation does not activate the agent or grant capabilities.

### 3.2 Read and list

- `GET /v1/agents/{agent_id}`
- `GET /v1/agents?lifecycle_state=ACTIVE&cursor=...`

List results must be tenant-filtered before pagination and search. No global enumeration endpoint is available to ordinary tenants. Return explicit pagination completeness and data freshness.

### 3.3 Update configuration

`PUT /v1/agents/{agent_id}/versions/{version_id}`

Creates an immutable new AgentVersion. It does not rewrite historical instructions or evidence. Require `If-Match` on the current agent resource. Reject stale writes with `409 VERSION_CONFLICT`.

### 3.4 Lifecycle command

`POST /v1/agents/{agent_id}/commands`

Supported command vocabulary:
- `VALIDATE`
- `PAUSE`
- `RESUME`
- `STOP`
- `ISOLATE`
- `REVOKE`
- `RETIRE`

Request includes command, reason, requested scope, expiry (where applicable), correlation ID and idempotency key. It cannot include a caller-asserted approval boolean. The command service obtains a FORTRESS decision and then sends the authorized command to NODE01/Runtime Fabric enforcement points.

Response distinguishes:
- `RECEIVED`: request durably recorded;
- `AUTHORIZING`: decision pending;
- `DENIED`: policy rejected;
- `DISPATCHED`: authorized command sent;
- `ACKNOWLEDGED`: required enforcement points confirmed;
- `PARTIAL`: some enforcement points did not confirm;
- `FAILED`: command failed;
- `UNKNOWN`: state cannot be proven.

A STOP command is not displayed as completed at RECEIVED or DISPATCHED. If any required executor is unreachable, return PARTIAL/UNKNOWN and keep the agent in a restricted state.

## 4. FORTRESS authorization decision contract

Proposed internal operation: `POST /v1/authorize`.

Request fields:
- `request_id`, `correlation_id`, `idempotency_key`;
- authenticated `actor` (principal/workload, issuer, authentication context);
- `tenant_id` and `organization_id`;
- `subject_agent_id` and optional `task_id`;
- `action`, `resource`, `environment`, `tool_id`;
- `purpose`, `data_classification`, `requested_capabilities`;
- `requested_at`, `expires_at`, `policy_context_ref`.

FORTRESS response:
- `decision`: `ALLOW`, `DENY` or `REQUIRES_APPROVAL`;
- `decision_id`, `policy_id`, `policy_version`;
- `scope_digest`, `audience`, `not_before`, `expires_at`;
- `constraints` (resource limits, allowed tools, data classes, environment);
- `approval_ref` where a human approval was completed;
- signed/verifiable decision artifact reference and audit evidence reference.

A decision is valid only for the exact actor, tenant, subject, action, resource, audience, scope digest and validity window. A changed request requires a new decision. A decision reference is not a bearer token; execution must verify it with FORTRESS or a cryptographically verifiable, short-lived capability bound to the execution audience.

### Approval lifecycle

`REQUESTED -> PENDING -> APPROVED | DENIED | EXPIRED | REVOKED`

Approval binds to a request fingerprint, actor, tenant, resource, action, purpose, expiry and policy version. Approval cannot be reused for a different request fingerprint. Agents cannot approve their own actions or approve actions on behalf of their owner unless a separately authorized delegation policy explicitly permits it.

## 5. Runtime registration contract

Proposed resource: `RuntimeBinding`.

Required fields:
- `runtime_binding_id`, `tenant_id`, `workload_id`;
- `logical_runtime_identity` (e.g. NODE01);
- `execution_adapter_id` and adapter version;
- `execution_environment_id` (separate from logical runtime identity);
- `registered_capabilities`;
- `registration_state`, `health_state`, `last_health_at`, `health_ttl`;
- `credential_reference` (opaque FORTRESS reference only);
- `registration_evidence_ref`, `revocation_state`.

Registration states:
`PENDING -> VERIFIED -> ACTIVE -> STALE | ISOLATED | REVOKED`.

Health cannot promote PENDING to VERIFIED. A health probe does not prove authorization. ACTIVE requires independently verified adapter identity, environment registration, tenant/workload scope, current FORTRESS policy and valid credential reference. Stale health blocks new consequential execution until revalidated.

The HOST adapter contract must authenticate each command, enforce an allowlist, validate the FORTRESS decision, bind the target environment, enforce timeout/resource limits, redact outputs, return an execution receipt and report cancellation semantics. The contract does not assert that such an adapter currently exists.

## 6. Task and execution receipt contract

Task states:
`REQUESTED -> AUTHORIZING -> QUEUED -> RUNNING -> VERIFYING -> SUCCEEDED`

Other terminal/recovery states:
`DENIED`, `CANCELLED`, `FAILED`, `TIMED_OUT`, `QUARANTINED`, `REQUIRES_HUMAN`, `UNKNOWN`.

A TaskAttempt records:
- task and attempt IDs, agent and agent-version IDs;
- tenant, owner principal and workload binding;
- input digest and data classification (not raw secrets);
- FORTRESS decision/approval references;
- tool/provider adapter versions;
- start/end times, timeout, retry number and idempotency key;
- output digest, verification result and evidence references;
- cancellation requested/acknowledged timestamps and residual-work status.

A receipt proves only what the issuing component observed. It must identify issuer, environment, time, scope and verification method. A NODE01 receipt does not independently prove HOST execution unless the HOST adapter signs/attests that execution.

## 7. Event and evidence contract

Canonical event envelope:
```json
{
  "event_id": "opaque-event-id",
  "schema_version": "1.0",
  "event_type": "agent.command.acknowledged",
  "occurred_at": "2026-11-23T20:00:00Z",
  "tenant_id": "opaque-tenant-id",
  "organization_id": "opaque-organization-id",
  "agent_id": "opaque-agent-id",
  "task_id": null,
  "workload_id": "opaque-workload-id",
  "actor": {"type": "principal", "id": "opaque-principal-id"},
  "source_component": "runtime-fabric",
  "correlation_id": "opaque-correlation-id",
  "causation_id": "opaque-causation-id",
  "idempotency_key": "opaque-key",
  "policy_decision_ref": "opaque-decision-id",
  "approval_ref": null,
  "classification": "internal",
  "redaction_profile": "workforce-event-v1",
  "payload_digest": "sha256:...",
  "evidence_ref": "opaque-evidence-id"
}
```

The event envelope is illustrative, not a deployed schema. Sensitive payloads are stored separately under classification, encryption and retention controls; events carry digests and references. Consumers must tolerate duplicate delivery and preserve event ordering only where an explicit partition/sequence contract guarantees it.

For consequential operations, the command cannot be reported as complete until both the enforcement acknowledgement and the durable evidence acknowledgement required by policy have been recorded. The production atomicity boundary (transactional outbox, shared transaction, or equivalent) remains a design decision pending persistence-owner confirmation.


### 7.1 Recovery audit as a canonical workforce event

Recovery audit records use the common event envelope above; they are not a second
audit authority or a parallel event bus. A recovery-specific payload adds:

- `recovery_case_id`, `operation_id` and the immutable
  `request_fingerprint`, all bound to the same tenant and, where
  applicable, organization, agent, task and workload scope;
- authenticated initiating `actor` (principal identity plus the
  authenticated session/authentication-context reference), distinct from the
  assigned operator and the separately authorized human approver;
- recovery reason, requested action, FORTRESS `policy_decision_ref`,
  `approval_ref` and policy version. These are references to
  authoritative FORTRESS records, not locally minted approval claims;
- reconciliation query IDs, execution-attempt correlation, receipt issuer and
  verification result, outcome certainty and final disposition;
- evidence references containing immutable evidence IDs, source, capture time,
  classification and content digest. Sensitive evidence remains in its
  separately controlled store; the event must not embed credentials, tokens,
  session material or unnecessary personal data.

The common envelope's `event_id`, `schema_version`,
`source_component`, `correlation_id`,
`causation_id`, `idempotency_key`,
`classification`, `redaction_profile`,
`payload_digest` and `evidence_ref` remain mandatory
where required by the envelope. A recovery sequence and previous-event digest
may be added as partition-scoped ordering/integrity metadata; consumers must
not infer global ordering from them.

FORTRESS remains the sole authority for authorization, policy decisions and
human approval. The recovery coordinator may request recovery actions and
record their provenance, but cannot synthesize, amend or override a FORTRESS
decision. An operator cannot approve their own recovery action. Changed
tenant, operation or request fingerprint requires a new authorization and
approval evaluation.

A terminal `CLOSED_SUCCEEDED` or `CLOSED_FAILED` disposition
requires independently verified, scope-matched outcome evidence. If execution
cannot be proven, record `CLOSED_UNRESOLVED` with outcome certainty
`UNKNOWN`, or keep the case open/escalated. Never translate missing
telemetry or an unacknowledged receipt into success.

The synthetic conformance model checks envelope alignment and cross-event
case/operation/fingerprint consistency. It does not establish a deployed event
schema, signed FORTRESS artifact, durable evidence store or atomic production
transaction.

## 8. AgentSync export manifest

Proposed manifest fields:
- package schema/version and unique package ID;
- source tenant and source agent ID (never silently remapped);
- agent version and provider/adapter metadata;
- portable content classes and classification labels;
- content digests, encryption metadata and signing key version;
- provenance and source policy references;
- excluded content report (credentials, sessions, inaccessible provider memory);
- scan status, compatibility requirements and expiry;
- export actor, timestamp and evidence reference.

Import creates a staged candidate agent/version. It does not overwrite an active agent or automatically reactivate permissions. Require tenant authorization, malware/content scan, schema validation, policy re-evaluation, owner approval where required and a restore verification receipt.

## 9. Stable error vocabulary

- `AUTHENTICATION_REQUIRED`
- `TENANT_SCOPE_DENIED`
- `POLICY_DENIED`
- `APPROVAL_REQUIRED`
- `APPROVAL_EXPIRED`
- `APPROVAL_REVOKED`
- `AGENT_NOT_FOUND`
- `AGENT_STATE_CONFLICT`
- `VERSION_CONFLICT`
- `RUNTIME_NOT_REGISTERED`
- `RUNTIME_HEALTH_STALE`
- `EXECUTION_ADAPTER_UNAVAILABLE`
- `EXECUTION_NOT_ACKNOWLEDGED`
- `IDEMPOTENCY_CONFLICT`
- `EVIDENCE_NOT_DURABLE`
- `DATA_CLASSIFICATION_BLOCKED`
- `PROVIDER_CAPABILITY_UNSUPPORTED`
- `RESTORE_SCAN_FAILED`
- `RESTORE_COMPATIBILITY_FAILED`

Error responses must not disclose cross-tenant resource existence, secrets, internal hostnames or protected policy details.

## 10. Contract test matrix

| Test | Expected result |
|---|---|
| Tenant A reads Tenant B agent | 404/tenant-safe denial; no metadata leak |
| Caller supplies tenant header for another tenant | Denied after principal-to-tenant validation |
| Caller submits `approved=true` without FORTRESS decision | Rejected; no execution |
| FORTRESS decision has wrong audience/action/resource | Rejected at enforcement point |
| Approval request fingerprint changes | Approval cannot be reused |
| Agent attempts self-approval or policy mutation | Denied and audited |
| Stale If-Match version update | 409 VERSION_CONFLICT |
| Duplicate idempotency key, same fingerprint | Return original operation result |
| Duplicate idempotency key, different fingerprint | 409 IDEMPOTENCY_CONFLICT |
| Runtime is healthy but not verified/registered | Execution denied |
| NODE01 logical identity supplied as physical host | Validation failure |
| HOST adapter does not acknowledge STOP | PARTIAL/UNKNOWN; restricted state retained |
| Evidence store unavailable for policy-required operation | Fail closed or explicit pending state; never claim complete |
| Provider cannot export hidden memory | Mark non-portable; do not fabricate export |
| AgentSync package has secret/session token | Reject/quarantine and record scan evidence |
| Restore policy differs from source policy | Re-evaluate under destination policy; do not inherit grants |
| Telemetry heartbeat is stale | Display UNKNOWN/STALE, not healthy |
| Task retries exceed configured bound | DEAD_LETTER/FAILED with evidence |

## 11. Open decisions and blockers

These decisions are intentionally not guessed:
1. Canonical service owner and API deployment boundary for Agent Registry.
2. Production persistence owner, engine, transaction model and migration authority.
3. FORTRESS signed decision/capability format and key lifecycle.
4. Runtime Fabric registration schema and actual authorized HOST adapter interface.
5. Durable evidence service owner, retention, checkpoint anchoring and atomicity mechanism.
6. Provider-by-provider capability and data-handling matrix.
7. Identity verification provider, lawful purpose, retention and revocation model.

## 12. Phase 1 disposition

This document is a reviewable contract proposal. It does not establish that any endpoint, database, adapter, signing key, queue, evidence service or provider integration is implemented or deployed.

Phase 1 implementation may begin only after the relevant owners approve these contracts and the existing Runtime Fabric/FORTRESS interfaces are reconciled. Until then, limit work to review, static schema examples and isolated contract-test fixtures. No production migration, deployment, DNS change, runtime activation or credential provisioning is authorized.
