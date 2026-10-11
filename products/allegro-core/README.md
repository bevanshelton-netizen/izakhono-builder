# Allegro Core

Owned-first Allegro runtime. The local runtime is authoritative for intake and persistence; external services are adapters/fallbacks and must never be required for core availability.

## Runtime contract

- `GET /health` — service health and persistence state.
- `GET /health/dependencies` — non-blocking dependency configuration status.
- `POST /api/bookings` — creates and durably persists a booking.
- `GET /api/bookings/:code` — retrieves a persisted booking.
- `POST /api/growth` — creates and durably persists a growth lead.
- `POST /api/payment/webhook` — accepts provider webhook events into the owned event log; callers must supply an idempotency reference.
- `POST /api/selftest` — local authenticated runtime persistence test.

## Design rule

The owned runtime remains operational when Supabase or another external adapter is unavailable. External adapters may acknowledge replicated events, but cannot become the source of truth for basic Allegro intake.
