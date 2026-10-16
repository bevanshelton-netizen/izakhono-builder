# IZAKHONO CONNECT™ — CONNECT CONTROL™

## Purpose
CONNECT CONTROL is the operational command layer for IZAKHONO CONNECT. It centralises leads, coverage checks, orders, provider selection and provisioning status while keeping upstream connectivity providers replaceable.

## Operating flow

CUSTOMER → LEAD → COVERAGE CHECK → PRODUCT → PROVIDER SELECTION → ORDER → PROVISIONING → SECURITY → HANDOVER

## Dashboard modules

1. **Pipeline** — new leads, qualified leads, quoted, converted, closed.
2. **Coverage** — address, requested service, provider candidates, coverage state, last checked.
3. **Orders** — order number, customer, product, provider, payment state, order state.
4. **Provisioning** — overall status, current step, progress, blockers, retry count.
5. **Providers** — OpenWeb, Afrinet, Openserve, MTN, Telkom, Vumatel, MetroFibre and future providers; API readiness and commercial status.
6. **Products** — START, BUSINESS, SECURE, FLEET, ENTERPRISE.
7. **Exceptions** — failed coverage, supplier/API unavailable, payment pending, manual intervention required.

## Provisioning state machine

- PAYMENT_VERIFIED
- COVERAGE_CHECK
- PROVIDER_SELECTION
- SERVICE_ORDER
- ACTIVATION
- CUSTOMER_PORTAL
- FORTRESS_SECURITY
- HANDOVER

Each state must be idempotent. Failed steps remain retryable and must record attempts, output and error information.

## Provider abstraction

No customer-facing workflow should depend directly on one supplier. Provider adapters should expose a common contract:

- `checkCoverage(address, serviceType)`
- `quote(product, coverage)`
- `createOrder(order)`
- `getOrderStatus(reference)`
- `cancelOrder(reference)`

If an upstream API is unavailable, CONNECT CONTROL must fall back to a manual-provider workflow rather than pretending the service was provisioned.

## Commercial rule

IZAKHONO owns the customer relationship, catalogue, billing experience, provisioning orchestration, security layer and support experience. Upstream connectivity remains replaceable.

## Current implementation boundary

The Supabase backend contains the CONNECT provider, product, lead, order and provisioning foundations. Real-time supplier coverage/provisioning must only be marked live after actual provider credentials, API contracts and successful test transactions are verified.

## Next engineering wave

- CONNECT CONTROL authenticated admin UI
- coverage adapter interface
- order creation RPC/service
- provisioning worker/queue
- provider adapter registry
- payment webhook integration
- audit log and exception queue
- reseller portal
