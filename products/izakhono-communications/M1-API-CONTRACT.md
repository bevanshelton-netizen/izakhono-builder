# IZAKHONO COMMUNICATIONS OS™ — M1 API Contract

## Purpose

Define the control-plane API boundary before any carrier or telephony engine is integrated.

## Tenant

- `POST /v1/tenants` — create tenant
- `GET /v1/tenants/:tenantId` — retrieve tenant
- `PATCH /v1/tenants/:tenantId` — update tenant status/profile

## Extensions

- `POST /v1/tenants/:tenantId/extensions`
- `GET /v1/tenants/:tenantId/extensions`
- `PATCH /v1/tenants/:tenantId/extensions/:extensionId`
- `DELETE /v1/tenants/:tenantId/extensions/:extensionId`

## Numbers

- `GET /v1/tenants/:tenantId/numbers`
- `POST /v1/tenants/:tenantId/numbers/search`
- `POST /v1/tenants/:tenantId/numbers/reserve`
- `POST /v1/tenants/:tenantId/numbers/:numberId/release`
- `POST /v1/tenants/:tenantId/numbers/:numberId/port`

The API calls carrier capabilities through an adapter. Customer-facing code never calls a carrier API directly.

## Routing

- `POST /v1/tenants/:tenantId/routes`
- `GET /v1/tenants/:tenantId/routes`
- `PATCH /v1/tenants/:tenantId/routes/:routeId`
- `DELETE /v1/tenants/:tenantId/routes/:routeId`

## IVR and queues

- `POST /v1/tenants/:tenantId/ivrs`
- `PATCH /v1/tenants/:tenantId/ivrs/:ivrId`
- `POST /v1/tenants/:tenantId/queues`
- `PATCH /v1/tenants/:tenantId/queues/:queueId`

## Calls

- `POST /v1/tenants/:tenantId/calls/validate-route`
- `GET /v1/tenants/:tenantId/calls`
- `GET /v1/tenants/:tenantId/calls/:callId`

The call validation endpoint validates the control-plane routing decision without claiming that a real PSTN call has completed.

## Provisioning

- `POST /v1/tenants/:tenantId/provision`
- `GET /v1/tenants/:tenantId/provision/:jobId`
- `POST /v1/tenants/:tenantId/provision/:jobId/resume`

All provisioning requests require an idempotency key. Replays must return the existing job rather than create duplicate resources.

## Standard response envelope

```json
{
  "data": {},
  "request_id": "uuid",
  "error": null
}
```

Errors use stable machine-readable codes and must not expose carrier credentials, SIP secrets or internal infrastructure details.

## M1 acceptance criteria

1. Tenant-scoped CRUD works.
2. Extension and number inventory operations are idempotent.
3. Routing decisions are deterministic and auditable.
4. IVR and queue definitions validate before activation.
5. Provisioning jobs can resume after failure.
6. Carrier adapters are isolated behind capability interfaces.
7. No API endpoint claims PSTN/voice service is live without runtime evidence.
