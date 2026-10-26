# IZAKHONO RENT™ — Payment Integration Gate

## Provider

IZAKHONO RENT uses **iKhokha iK Pay API** as the intended South African online-payment adapter. iKhokha officially documents iK Pay API as the custom-platform integration path and requires a website key generated from the merchant dashboard. citeturn0search2

## Production safety gate

The runtime adapter is intentionally fail-closed until the merchant's current iKhokha API contract is supplied/verified. No endpoint, request schema, callback signature algorithm, or credential is invented in source code.

Before production payment activation, configure:

1. iKhokha API base URL for the approved environment.
2. Merchant website key through secret management; never expose it to the browser.
3. The exact current iK Pay API request/response schema.
4. The exact provider callback/webhook signature scheme and canonical payload rules.
5. Provider event-id/idempotency semantics.
6. Approved success/cancel/return URLs.
7. Test credentials and a successful sandbox/test payment.

## Settlement rules

A browser redirect is never treated as proof of payment. A booking becomes financially confirmed only after a trusted server-side provider response/callback has been authenticated, matched to the booking, and reconciled for amount and currency.

The database must retain provider reference, event ID, amount, currency, status, timestamps and audit events. Duplicate provider events must be idempotent.

## Identity and security

Listings and bookings must remain tied to IZAKHONO ID identities. FORTRESS enforcement belongs at the API boundary and must cover authentication, authorization, rate limiting, audit logging and sensitive payment actions.

No production launch claim is made until the merchant account is approved and the integration passes a real provider test. iKhokha states that its profile must be FICA approved before payouts can begin. citeturn0search2
