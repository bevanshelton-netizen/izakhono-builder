# IZAKHONO PROVISIONER

Server-side runtime specification for CONNECT CONTROL.

## Responsibilities

The Provisioner consumes authenticated orders and advances the provisioning state machine without coupling the business logic to a hosting vendor.

### Pipeline

`PAYMENT_VERIFIED → COVERAGE_CHECK → PROVIDER_SELECTION → SERVICE_ORDER → ACTIVATION → CUSTOMER_PORTAL → FORTRESS_SECURITY → HANDOVER`

## Adapter contract

Every provider adapter should implement:

```text
checkCoverage(address, serviceType)
quote(product, coverage)
createOrder(order)
getOrderStatus(reference)
cancelOrder(reference)
```

Adapters must return normalized results. Provider-specific response formats never leak into the core provisioning state machine.

## Safety rules

- Never claim activation without an authoritative provider result.
- Retries must be idempotent.
- Every attempt is recorded.
- Errors become exceptions with actionable context.
- Credentials remain server-side.
- Manual fallback is explicit and visible.
- A provider can be disabled without changing customer-facing product definitions.

## Runtime target

The first production runtime should be deployable as a Docker container on IZAKHONO-controlled Linux infrastructure. Supabase/Postgres remains the current persistence layer.

No Vercel-specific runtime dependency is permitted.
