# IZAKHONO PROVISIONER

Portable server-side runtime for CONNECT CONTROL provisioning orchestration.

## Deployment principle

Deploy on IZAKHONO-controlled Linux infrastructure, private VM, bare metal, or another Docker-compatible host. Vercel is not required.

## Pipeline

`PAYMENT_VERIFIED → COVERAGE_CHECK → PROVIDER_SELECTION → SERVICE_ORDER → ACTIVATION → CUSTOMER_PORTAL → FORTRESS_SECURITY → HANDOVER`

## Provider adapter contract

```text
checkCoverage(address, serviceType)
quote(product, coverage)
createOrder(order)
getOrderStatus(reference)
cancelOrder(reference)
```

Provider-specific responses must be normalized before entering the core state machine.

## Runtime contract

Environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — server-side secret only.
- `PORT` — defaults to `8080`.

HTTP contract:

- `GET /health`
- `POST /v1/provisioning/start` — `{ "order_id": "..." }`
- `POST /v1/provisioning/advance` — `{ "provisioning_id": "...", "step_key": "...", "status": "completed", "output": {} }`

## Safety rules

- Never claim coverage, ordering, activation, or handover without an authoritative upstream result.
- Retries must be idempotent.
- Every attempt is recorded.
- Errors become actionable exceptions.
- Credentials remain server-side.
- Manual fallback is explicit and visible.
- A provider can be disabled without changing customer-facing products.
- No Vercel-specific runtime dependency.
