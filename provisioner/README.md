# IZAKHONO PROVISIONER

Portable server-side runtime for IZAKHONO provisioning orchestration.

## Deployment principle

Deploy on IZAKHONO-controlled Linux infrastructure, private VM, bare metal, or another Docker-compatible host. Vercel is not required.

## Executable pipeline

The runtime delegates durable state to the existing Supabase provisioning engine:

`CONFIRMED PAYMENT → PROVISIONING JOB → 11 DURABLE STEPS → VERIFICATION → HANDOVER PACKAGE`

The database creates the steps through `ic_initialize_provisioning_steps` and enforces uniqueness on each `(job_id, step_key)`. Provider retries are recorded separately, so retries cannot create duplicate provisioning jobs or steps.

## Runtime contract

Environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — server-side secret only.
- `PORT` — defaults to `8080`.

HTTP contract:

- `GET /health`
- `POST /v1/provisioning/start` — `{ "transaction_id": "<confirmed payment UUID>" }`
- `POST /v1/provisioning/advance` — `{ "step_id": "...", "status": "completed", "output": {} }`
- `POST /v1/provisioning/advance` — failed step: `{ "step_id": "...", "status": "failed", "error": "...", "retry_minutes": 5 }`
- `POST /v1/provisioning/handover` — `{ "job_id": "..." }`

## Supabase RPC boundary

The HTTP runtime calls the existing executable functions:

- `ic_provision_from_payment`
- `ic_provisioner_complete_step`
- `ic_provisioner_fail_step`
- `ic_build_provisioning_handover`

The payment-start function is idempotent on `payment:<transaction_id>`.

## Provider adapter contract

```text
checkCoverage(address, serviceType)
quote(product, coverage)
createOrder(order)
getOrderStatus(reference)
cancelOrder(reference)
```

Provider-specific responses must be normalized before entering the core state machine.

## Safety rules

- Never claim coverage, ordering, activation, or handover without an authoritative upstream result.
- Retries must be idempotent.
- Every provider attempt is recorded.
- Verification evidence is persisted per step.
- Errors become actionable exceptions.
- Credentials remain server-side.
- Manual fallback is explicit and visible.
- A provider can be disabled without changing customer-facing products.
- No Vercel-specific runtime dependency.
