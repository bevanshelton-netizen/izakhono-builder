# ALLEGRO VIBEZ API Contract v1

All endpoints are designed behind an IZAKHONO-owned API gateway. Provider-specific credentials stay server-side.

## Identity
- `POST /api/v1/auth/register` — create creator account.
- `POST /api/v1/auth/verify` — verify email/token.
- `POST /api/v1/auth/session` — establish authenticated session.
- `GET /api/v1/me` — current user and creator profile.

## Creator
- `PUT /api/v1/creator/profile` — create/update creator profile.
- `GET /api/v1/creators/:id` — public creator profile.

## Music
- `POST /api/v1/releases` — create draft release.
- `POST /api/v1/releases/:id/media` — request a storage upload.
- `POST /api/v1/releases/:id/rights` — record rights declaration/evidence.
- `POST /api/v1/releases/:id/submit` — submit release for moderation.
- `GET /api/v1/releases/:id` — release status.
- `GET /api/v1/discover` — public catalogue.

## Commerce
- `POST /api/v1/checkout` — create a provider-neutral checkout session.
- `POST /api/v1/payments/webhook/:provider` — idempotent payment event ingestion.
- `GET /api/v1/transactions` — authenticated transaction history.

## Royalties & wallet
- `GET /api/v1/wallet` — creator balance.
- `GET /api/v1/royalties` — immutable royalty ledger entries.
- `POST /api/v1/payouts` — request payout when eligible.
- `GET /api/v1/payouts` — payout history.

## Security rules
1. Never trust a client-supplied payment success flag.
2. Every provider webhook is authenticated and idempotency-protected.
3. Money is stored in integer minor units, never floating point.
4. Royalty ledger entries are append-only; corrections use compensating entries.
5. Release publication requires rights confirmation and moderation approval.
6. Provider adapters are replaceable; core business logic is provider-neutral.
7. No endpoint is considered production-live until public reachability and an end-to-end acceptance receipt exist.
