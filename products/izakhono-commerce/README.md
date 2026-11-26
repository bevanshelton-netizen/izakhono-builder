# IZAKHONO COMMERCE — Single-Seller B2B Core

**Version:** 0.1.0  
**Status:** Initial source implementation; not deployed or production-ready.

IZAKHONO COMMERCE is the first-party commercial transaction domain. This initial slice provides a single-seller catalogue and buyer-scoped order submission foundation.

## Implemented source capabilities

- Admin-key-gated seller creation.
- Admin-key-gated buyer onboarding with a one-time buyer API key (stored as a SHA-256 hash).
- Admin-key-gated product creation.
- Public published catalogue by seller slug.
- Buyer-key-gated order submission and buyer-scoped order retrieval.
- Server-side price snapshots, safe integer totals and currency consistency.
- Idempotent order creation using a buyer-scoped `Idempotency-Key`.
- Order lines and an `order.submitted` event persisted in the same database batch.
- Explicit pending payment and awaiting seller inventory confirmation states.

## API

- `GET /health`
- `GET /api/v1/catalog/:seller_slug`
- `POST /api/v1/admin/sellers` — `x-izakhono-commerce-admin`
- `POST /api/v1/admin/buyers` — `x-izakhono-commerce-admin`
- `POST /api/v1/admin/products` — `x-izakhono-commerce-admin`
- `POST /api/v1/orders` — `x-izakhono-commerce-buyer-key` and `Idempotency-Key`
- `GET /api/v1/orders/:order_id` — `x-izakhono-commerce-buyer-key`

The admin key is supplied only through runtime secret configuration; it is not included in source. Buyer API keys are returned once during onboarding and must be stored securely by the owner.

## Domain boundaries

- Commerce owns seller/buyer commerce records, catalogue, accepted price snapshots and orders.
- I-PAY remains authoritative for payment intents, provider verification, refunds and settlement evidence. This first slice does not initiate or confirm payments.
- ERP/inventory/MES remains authoritative for stock, reservations, valuation and manufacturing availability. This first slice does not reserve or promise stock.
- Finance/ERP owns accounting and tax ledgers.
- FLOW owns cross-product workflow orchestration.
- IZAKHONO ID/FORTRESS must provide the production identity, policy and security integration before broader deployment.

## Runtime and storage

The handler uses a D1-compatible database binding and standard Web APIs, with no application runtime dependency. D1 is an execution adapter for the initial implementation, not a declaration that Cloudflare is the permanent infrastructure owner. A self-hosted PostgreSQL/SQLite adapter may be selected through the owned runtime architecture before production deployment.

## Local checks

```sh
npm test
npm run check
```

The migration is `migrations/0001_commerce_core.sql`.

## Not implemented

Customer-specific contract price books, quotations and approval chains, stock integration, payment initiation, fulfilment, returns, multi-vendor marketplace, B2C checkout, tax calculation, production FORTRESS/IZAKHONO ID integration, deployment configuration and live acceptance.

No payment, inventory, compliance, deployment or production-readiness claim is made.
