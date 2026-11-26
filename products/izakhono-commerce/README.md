# IZAKHONO COMMERCE — Single-Seller B2B Core

**Version:** 0.1.0  
**Status:** Initial source implementation; not deployed or production-ready.

IZAKHONO COMMERCE is the first-party commercial transaction domain. This initial slice provides a single-seller catalogue and buyer-scoped order submission foundation.

## Implemented source capabilities

- FORTRESS-session-gated seller, buyer and product administration.
- Seller records are bound to the authenticated FORTRESS tenant.
- Buyer onboarding is scoped to a seller owned by that tenant; buyer API keys are issued once and only their SHA-256 hashes are stored.
- Buyer API keys are seller-scoped and cannot submit orders to another seller.
- Public published catalogue by seller slug.
- Buyer-key-gated order submission and buyer-scoped order retrieval.
- Server-side price snapshots, safe integer totals and currency consistency.
- Idempotent order creation using a buyer-scoped `Idempotency-Key`.
- Order lines and an `order.submitted` event persisted in the same database batch.
- Explicit pending payment and awaiting seller inventory confirmation states.

## API

- `GET /health`
- `GET /api/v1/catalog/:seller_slug`
- `POST /api/v1/admin/sellers` — FORTRESS Bearer session
- `POST /api/v1/admin/buyers` — FORTRESS Bearer session; body includes `seller_slug`
- `POST /api/v1/admin/products` — FORTRESS Bearer session
- `POST /api/v1/orders` — `x-izakhono-commerce-buyer-key` and `Idempotency-Key`
- `GET /api/v1/orders/:order_id` — `x-izakhono-commerce-buyer-key`

Administrative routes require `Authorization: Bearer <FORTRESS access token>` and call the `FORTRESS_IDENTITY` service binding for live session introspection. Only `OWNER` and `SECURITY_ADMIN` principals are permitted. The introspection response must explicitly identify the `izakhono-commerce` audience; sessions for other IZAKHONO services are rejected. Buyer API keys are returned once during onboarding and must be stored securely by the owner.

## Domain boundaries

- Commerce owns seller/buyer commerce records, catalogue, accepted price snapshots and orders.
- I-PAY remains authoritative for payment intents, provider verification, refunds and settlement evidence. This first slice does not initiate or confirm payments.
- ERP/inventory/MES remains authoritative for stock, reservations, valuation and manufacturing availability. This first slice does not reserve or promise stock.
- Finance/ERP owns accounting and tax ledgers.
- FLOW owns cross-product workflow orchestration.
- FORTRESS Identity is the administrative identity authority; Commerce does not issue or validate human passwords or JWT signatures itself.
- Seller administration is tenant-scoped. A buyer credential is bound to one seller and cannot be replayed against another seller.
- The FORTRESS service binding must be private to the Commerce runtime and must return a verified `izakhono-commerce` audience. The current shared FORTRESS Identity source returns its configured single audience (default `izakhono-creator`); audience-specific introspection/issuance must be completed before production activation. Commerce therefore fails closed for Creator-audience tokens.
- No fallback admin key exists. If the identity binding is absent, unavailable, malformed or returns a token for another audience, administrative requests are rejected.

## Runtime and storage

The handler uses a D1-compatible database binding and standard Web APIs, with no application runtime dependency. D1 is an execution adapter for the initial implementation, not a declaration that Cloudflare is the permanent infrastructure owner. A self-hosted PostgreSQL/SQLite adapter may be selected through the owned runtime architecture before production deployment.

## Local checks

```sh
npm test
npm run check
```

The migration is `migrations/0001_commerce_core.sql`. The integration suite uses Node 22's built-in `node:sqlite` module and an in-memory SQLite database; it introduces no third-party runtime or database dependency.

## Not implemented

Customer-specific contract price books, quotations and approval chains, stock integration, payment initiation, fulfilment, returns, multi-vendor marketplace, B2C checkout, tax calculation, audience-specific FORTRESS issuer/introspection support, deployment configuration and live acceptance.

No payment, inventory, compliance, deployment or production-readiness claim is made.
