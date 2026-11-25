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
- Tests for metric calculations, validation, anonymous responses and cross-tenant isolation.

## Security boundary
This is a domain library, not an exposed HTTP API. It does not authenticate callers. A future API adapter must authenticate through the approved IZAKHONO ID/FORTRESS path and enforce entity/platform permissions before constructing ExperienceStore with verified scope. Never trust scope from an untrusted request body or query parameter.

Every record is scoped by entity_id and platform_id. Composite foreign keys prevent cross-tenant relationships. Anonymous responses do not persist a respondent reference. Deployments must still assess IP, device and transport logs before promising anonymity.

## Tests
Run from repository root: python3 -m unittest discover -s products/izakhono-experience -p 'test_*.py' -v
No third-party package is required. No existing environment migration is applied.

## Not included
No HTTP routes, public survey links, identity middleware, email/SMS distribution, automated contact, AI sentiment/churn models, production deployment, backup certification, paid connectors or infrastructure purchases. These require separate FORTRESS, privacy, retention and production acceptance reviews.
