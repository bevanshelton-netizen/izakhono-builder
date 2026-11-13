# HOST runtime PostgreSQL and verified-payment bridge

The owned Compose stack now supplies PostgreSQL settings to the HOST control plane. The runtime image includes the HOST provisioner modules and applies `migrations/001_host_provisioning_records.sql` at startup. The runtime readiness endpoint (`/ready`) checks database connectivity; Compose waits for PostgreSQL health before considering HOST healthy.

## Required environment

- `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` configure the owned PostgreSQL service.
- `HOST_RUNTIME_TOKEN` protects the existing management API.
- `HOST_PAYMENT_BRIDGE_TOKEN` is a separate high-entropy secret shared only with the trusted internal payment-fulfillment adapter.

## Trusted payment handoff

A trusted internal adapter may POST to `/internal/payments/verified` with header `X-Izakhono-Payment-Token` and JSON `{ "payment": { ... }, "order": { ... } }`. The adapter MUST first verify the provider's signature over the exact raw callback, reconcile it against a server-side checkout order, and persist the provider-confirmed paid state. Never expose this endpoint as a public provider webhook and never derive expected amount, currency, customer, domain, or idempotency key from an untrusted callback or browser redirect.

The endpoint delegates to `PaidProvisioningBridge` and `PostgresProvisioningStore`. The durable ledger records only `PAYMENT_VERIFIED`; it does not create a site or mark a site public-live. A separate provisioning worker must consume accepted records and complete the DNS, HTTPS, content, and mail acceptance gates.

## Operational limits

- `/health` reports process health; `/ready` reports PostgreSQL readiness.
- The payment endpoint is disabled unless PostgreSQL is configured and the separate payment bridge token is set.
- Site/deployment state remains in the existing JSON state file. This change makes the paid-provisioning ledger durable in PostgreSQL; it does not yet migrate all tenant/site state.
- Production still requires an approved compute substrate, real iKhokha merchant credentials and verified callback contract, public DNS/TLS, and real mail acceptance. CI success is not production acceptance.
