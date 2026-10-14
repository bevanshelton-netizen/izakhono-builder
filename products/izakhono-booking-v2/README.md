# IZAKHONO BOOKING v2

Operational booking SaaS build wave for the IZAKHONO business factory.

## Included

- conflict-safe availability checks
- customer records
- owner-gated booking confirmation/cancellation
- payment-intent adapter contract with iKhokha-first routing
- reminder queue generation
- dashboard metrics
- idempotency keys for public booking creation
- deterministic no-provider fallback
- evidence-gated live/release state

## Routes

- `GET /api/health`
- `GET /api/services?businessId=...`
- `GET /api/availability?serviceId=...&from=...&to=...`
- `POST /api/bookings`
- `POST /api/bookings/:id/confirm`
- `POST /api/bookings/:id/cancel`
- `POST /api/bookings/:id/checkout`
- `GET /api/dashboard/summary`
- `POST /api/reminders/enqueue`

Owner routes require `x-owner-secret` when `OWNER_BOOKING_SECRET` is configured.

Payment provider credentials are never committed to source. Checkout returns `provider_unconfigured` until a server-side payment adapter is configured and verified.
