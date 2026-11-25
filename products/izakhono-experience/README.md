# IZAKHONO EXPERIENCE — domain foundation v1

**Status:** Alpha domain library; not a public or production service.

First-party experience-management capability for surveys, feedback, transparent metrics and accountable case resolution.

## Included
- Tenant-scoped SQLite schema with composite entity/platform foreign keys.
- Draft/active/paused/closed survey lifecycle and NPS, CSAT, CES or custom metric identifiers.
- NPS, rating, text and choice question types with validation.
- Anonymous, pseudonymous and identified response modes.
- Standard NPS: promoter percentage (9–10) minus detractor percentage (0–6); passives are 7–8.
- Closed-loop case transitions with required resolution evidence.
- ID session introspection bridge and mandatory fail-closed FORTRESS decision callback.
- Tests for metric calculations, validation, anonymous responses, cross-tenant isolation and identity/policy denial paths.

## Identity and authorisation boundary
The package is a domain library, not an exposed HTTP API. identity.py provides a service-to-service IZAKHONO ID introspection client and an authorised store factory. It accepts an opaque bearer session, obtains subject/entity/role only from the authenticated ID introspection response, validates active status and expiry, then requires a separate FORTRESS decision callback to return literal true for the requested permission.

Missing adapters, invalid/expired sessions, identity outages, policy outages, explicit denials and indeterminate policy responses all fail closed. Client-supplied entity IDs and roles are never used as authority. The ID internal key and URL are environment-only; the configured ID URL must use HTTPS.

**Important integration limit:** the FORTRESS permission-decision endpoint/adapter is not yet present in the inspected FORTRESS implementation. Until that governed adapter is implemented and connected, no HTTP route or public survey access may be enabled. The callback is an explicit integration seam, not a claim that FORTRESS authorisation is already live.

## Data handling
Every record is scoped by entity_id and platform_id. Composite foreign keys prevent cross-tenant relationships. Anonymous responses do not persist a respondent reference. Deployments must still assess IP, device and transport logs before promising anonymity. Define retention, deletion, access and export policies before production activation.

## Tests
Run from repository root: python3 -m unittest discover -s products/izakhono-experience -p 'test_*.py' -v
No third-party package is required. No existing environment migration is applied.

## Not included
No HTTP routes, public survey links, FORTRESS policy endpoint, email/SMS distribution, automated contact, AI sentiment/churn models, production deployment, backup certification, paid connectors or infrastructure purchases. These require separate FORTRESS, privacy, retention and production acceptance reviews.
