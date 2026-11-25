# IZAKHONO EXPERIENCE — domain foundation v1

**Status:** Alpha domain library; not a public or production service.

First-party experience-management capability for surveys, feedback, transparent metrics and accountable case resolution.

## Included
- Tenant-scoped survey, question, response, answer and case persistence.
- Draft/active/paused/closed survey lifecycle and NPS, CSAT, CES or custom metric identifiers.
- NPS, rating, text and choice question validation.
- Anonymous, pseudonymous and identified response modes.
- Standard NPS: promoter percentage (9–10) minus detractor percentage (0–6); passives are 7–8.
- Closed-loop case transitions with required resolution evidence.
- IZAKHONO ID session introspection and FORTRESS product-permission decision clients.
- Tests for metrics, validation, anonymous responses, tenant isolation and fail-closed identity/policy paths.

## Identity and authorisation boundary
The package is a domain library, not an exposed HTTP API. identity.py provides a service-to-service IZAKHONO ID introspection client and FORTRESS permission client. It derives subject, entity and role only from an active ID session, validates session expiry, and then asks FORTRESS to decide the exact product permission.

The FORTRESS endpoint is POST /v1/authorize-product. Its policy is default-deny and requires an exact match across subject, entity_id, role, product and permission. Wildcards and implicit role inheritance are not supported. The initial EXPERIENCE permission list is empty, so all requests remain denied until an owner-approved, reviewed policy change adds explicit grants.

FORTRESS decisions include a decision ID and policy version and are emitted as structured policy-decision logs. EXPERIENCE accepts only a traceable, versioned decision response. Missing configuration, invalid/expired sessions, identity outages, policy outages, explicit denials and indeterminate responses all fail closed.

## Service configuration
- IZAKHONO_ID_INTERNAL_URL — HTTPS base URL for the approved ID internal introspection service.
- IZAKHONO_ID_INTERNAL_KEY — service credential for ID introspection; configure only in approved secret management.
- IZAKHONO_FORTRESS_URL — HTTPS base URL for FORTRESS.
- IZAKHONO_FORTRESS_TOKEN — service credential for FORTRESS; configure only in approved secret management.

Never place credentials in source code, logs, prompts or client-side configuration. The FORTRESS process currently binds to loopback by default; remote service access requires a separately approved private, authenticated transport. Do not expose its listener publicly.

## Data handling
Every record is scoped by entity_id and platform_id. Composite foreign keys prevent cross-tenant relationships. Anonymous responses do not persist a respondent reference. Deployments must still assess IP, device and transport logs before promising anonymity. Define retention, deletion, access and export policies before production activation.

## Tests
Run from repository root:
- python3 products/izakhono-fortress/test_guard.py
- python3 -m unittest discover -s products/izakhono-experience -p 'test_*.py' -v

No third-party package is required. No existing environment migration is applied.

## Not included
No HTTP routes, public survey links, owner permission grants, email/SMS distribution, automated contact, AI sentiment/churn models, production deployment, backup certification, paid connectors or infrastructure purchases. These require separate privacy, retention, security and production acceptance reviews.

## Closed-loop case integrity (alpha hardening)

Case creation supports an optional idempotency key. Repeating the same request with the same key returns the existing case; reusing that key with a different request is rejected. A unique scoped index prevents duplicate key use within an entity/platform.

Each case has a monotonically increasing version. Transitions run in a SQLite write transaction and use a version-checked update; callers may supply `expected_version` to reject stale decisions. Every creation and transition appends a case event with actor, previous/new state, note, timestamp and version. `case_history(case_id)` returns this ordered history within the caller's tenant scope.

Existing alpha databases receive an additive schema upgrade for case version/idempotency fields and a baseline history event. That baseline is explicitly labelled as a migration snapshot; it does not fabricate historical actors or claim that pre-existing transitions can be reconstructed.

These controls improve alpha-level accountability and retry safety. They are not a substitute for an independently protected, tamper-evident production audit store, cross-process deployment validation, backup/restore testing or an approved production migration plan.
