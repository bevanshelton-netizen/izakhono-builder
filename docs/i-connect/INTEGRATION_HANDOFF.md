# I-CONNECT Staging Integration Handoff

## Objective

Connect the verified I-CONNECT staging frontend to the separately prepared Core API, Customer Portal MVP, and Operations Console MVP without introducing production carrier, RICA, or payment credentials.

## Current verified boundary

- Dedicated Vercel project: `i-connect-staging`
- Staging application is independently hosted from the shared `izakhono-builder` application.
- The deployed staging shell is reachable and returns HTTP 200.
- No live carrier activation is enabled.
- No production payment credentials are embedded.
- Production RICA/compliance remains pending approved partner/regulatory integration.

## Integration sequence

1. Customer Portal -> Core API base URL
2. Core API -> PostgreSQL staging database
3. Customer creation -> order creation
4. Simulated payment webhook -> idempotent payment recording
5. Payment state -> `READY_TO_PROVISION`
6. Simulated provisioning -> `PROVISIONING`
7. Operations Console -> dashboard/order visibility
8. Audit events -> staging database
9. End-to-end smoke test with synthetic data
10. Security and release-boundary verification

## Required staging environment variables

- `I_CONNECT_API_BASE_URL`
- `DATABASE_URL`
- `PAYMENT_ADAPTER_MODE=simulation`
- `NETWORK_ADAPTER_MODE=simulation`
- `RICA_ADAPTER_MODE=simulation`

Never place production carrier, payment, RICA, customer identity, or banking credentials in this staging environment.

## Exit criteria

The integration is green only when the complete synthetic journey succeeds and the production safety boundary remains intact.

A green staging result does **not** constitute a live telecom service, MVNO activation, ICASA approval, or commercial launch.
