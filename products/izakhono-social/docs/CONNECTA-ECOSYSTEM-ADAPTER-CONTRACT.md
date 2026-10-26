# CONNECTA Ecosystem Adapter Contract

## Purpose

Define the safe interface used to connect specialised IZAKHONO worlds to CONNECTA without turning an unverified external service into a claimed live dependency.

## Adapter states

- `planned` — architecture defined; no endpoint activation claimed.
- `configured` — adapter metadata exists; endpoint/credentials still unverified.
- `verified` — endpoint or signed agreement and required evidence have passed.
- `active` — verified adapter is enabled in a production runtime and independently tested.
- `suspended` — previously active integration is intentionally disabled pending review.

## Required metadata

Every adapter record should define:

- stable `id`
- display `name`
- `world`
- purpose
- ownership/operator
- route
- activation state
- endpoint class where applicable
- authentication mode without storing secrets in the registry
- health check
- data exchanged
- rights/consent boundary
- verification evidence reference
- last verified timestamp
- fallback behaviour
- suspension/rollback procedure

## Security rules

1. Browser clients never receive server-only integration credentials.
2. Secrets live outside Git and outside public configuration.
3. External endpoints are allow-listed before activation.
4. Every external integration has timeout, failure handling and audit logging.
5. CONNECTA must remain usable when an optional adapter is unavailable.
6. Third-party rights, partner status and commercial relationships are never inferred from a configured URL.

## Data-minimisation rules

Adapters should exchange only the data required for the declared user journey. Identity linking must use IZAKHONO ID only where technically and legally appropriate and must not silently merge unrelated accounts.

## Commercial verification

A commercial adapter may expose partner offers, inventory, referrals or campaigns only after the applicable agreement, identity, terms, attribution and settlement evidence has passed. A partner name appearing in source code is not proof of partnership.

## User experience

If an adapter is unavailable, CONNECTA should show a truthful state such as `Coming soon`, `Temporarily unavailable`, or an internal fallback—not a fabricated live experience.

## Production gate

`active` requires:

- verified endpoint or signed agreement as applicable
- security review
- functional integration test
- independent health evidence
- rollback path
- monitoring/observability
- accurate public status

This contract is an architecture and governance artifact. It does not by itself activate any third-party service.
