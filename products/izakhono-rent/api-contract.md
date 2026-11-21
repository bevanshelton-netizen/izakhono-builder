# IZAKHONO RENT™ API contract

## Marketplace
- `GET /rent/listings` — browse published, verified listings; filter category, location, price, rental period.
- `GET /rent/listings/:id` — listing details, media, availability and transaction options.
- `POST /rent/listings` — owner creates a draft listing.
- `PATCH /rent/listings/:id` — owner updates an owned listing.
- `POST /rent/listings/:id/publish` — publish after required verification checks.

## Booking
- `GET /rent/listings/:id/availability` — availability windows.
- `POST /rent/quotes` — calculate rental subtotal, service fee, deposit and total.
- `POST /rent/bookings` — create pending booking after quote confirmation.
- `POST /rent/bookings/:id/payment` — hand off to the configured payment provider.
- `POST /rent/bookings/:id/confirm` — confirm only after verified payment state.
- `POST /rent/bookings/:id/cancel` — apply cancellation rules and refund state.

## Handover / disputes
- `POST /rent/bookings/:id/handover` — pickup/return evidence event.
- `POST /rent/bookings/:id/disputes` — open a dispute with evidence.
- `POST /rent/disputes/:id/resolve` — authorized resolution workflow.

## Security rules
1. Never mark a booking paid from client-side input.
2. Verify authenticated ownership for owner listing mutations.
3. Verify listing and account status before publishing.
4. Prevent overlapping confirmed bookings transactionally.
5. Keep deposit, service fee, subtotal and settlement states separate.
6. Treat payment provider callbacks as untrusted until signature/state verification succeeds.
7. Keep an audit event for payment, booking, handover, dispute and payout transitions.
8. Production endpoints must sit behind IZAKHONO/FORTRESS controls and rate limits.

## Integration order
IZAKHONO ID → listing service → availability/quote engine → iKhokha/payment adapter → booking state machine → handover evidence → dispute engine → owner settlement/payouts → analytics.
