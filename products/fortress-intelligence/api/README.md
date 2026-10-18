# FORTRESS Intelligence API Engine

This directory defines the production-oriented backend boundary for IZAKHONO FORTRESS INTELLIGENCE™.

## Safety default

The engine is **mock/synthetic by default**. It must never call a live provider unless an approved provider adapter is explicitly enabled with its credentials and commercial/legal gates satisfied.

## Provider contract

Every provider adapter should implement:

- `health()`
- `capabilities()`
- `search(entity)`
- `match(entity)`
- `get_entity(id)`
- `get_sources(id)`
- `usage()`

Provider responses must be normalised into FORTRESS evidence records. Raw provider data must not be presented as an unexplained risk decision.

## Planned API surface

- `GET /health`
- `POST /screen`
- `GET /entity/:id`
- `POST /cases`
- `GET /cases/:id`
- `POST /monitor`

## Decision principle

**Signal → match confidence → corroboration → human review → disposition → audit trail.**

FORTRESS provides risk intelligence and workflow support; it does not declare that a person or organisation is guilty of wrongdoing.
