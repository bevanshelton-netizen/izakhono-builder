# IZAKHONO APP FABRIC Gateway

The Gateway converts approved product events into scoped IZAKHONO CRM activity without exposing CRM administrator credentials to browsers.

## Routes

- `GET /health`
- `POST /api/fabric/intake` — restricted low-risk public events; disabled by default
- `POST /api/fabric/event` — internal server-to-server event path
- `POST /api/fabric/replay` — authenticated outbox replay

Public intake never accepts payment-confirmation events. Verified payment truth stays with the product's approved payment/webhook/reconciliation route.

## Portfolio coverage

The Gateway registry now covers every platform listed in the canonical IZAKHONO CRM portfolio registry. Wave 1 has concrete source adapters for FAISReady, Edu-Build Institute and Izakhono Clothing Manufacturing.

All other registered products can use the authenticated `opportunity.stage_changed` event immediately from their server-side adapters. The requested stage is accepted only when it exactly matches that platform's approved CRM stage list.

A platform with an unresolved legal entity is fail-closed and cannot emit CRM events until its entity boundary is approved.

## Security

Public intake is fail-closed unless `IZAKHONO_FABRIC_PUBLIC_INTAKE=true`. Configure `IZAKHONO_FABRIC_ALLOWED_ORIGINS` and place the service behind FORTRESS / EDGE rate limiting before public use.

Internal events require `IZAKHONO_FABRIC_INTERNAL_TOKEN`.

The CRM ingest credential is held only by the Gateway as `IZAKHONO_CRM_INGEST_TOKEN`.

## Reliability

If CRM delivery fails, the Gateway writes a bounded local outbox and returns HTTP 202. An authorised operator can replay the outbox later. Production deployment must put the outbox on persistent storage and add backup/monitoring before claiming production readiness.
