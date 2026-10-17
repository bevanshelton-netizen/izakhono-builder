# IZAKHONO ONE — NODE 01 Activation Runbook

## Purpose

Prove the owned internal runtime before any public DNS, EDGE, or TLS change.

## Preconditions

- Docker Desktop is installed and running.
- WSL is available with the `Ubuntu` distribution.
- The repository is available on NODE 01.
- The private Docker network `izakhono_private` can be created by the APP FABRIC activation.
- `products/izakhono-one/.env.owned` exists locally on NODE 01 and contains only the required backend environment. It is intentionally ignored by Git.

## Activation order

### 1. APP FABRIC + FLOW

From the repository root, run:

`START-APP-FABRIC-NODE01.cmd`

Expected result:

`[PASS] CRM + REVENUE + TASKS + FLOW + APP FABRIC are healthy internally on the owned host.`

If it stops, do not continue. Public routes remain unchanged.

### 2. IZAKHONO ONE

Run:

`RUN-IZAKHONO-ONE-NODE01.cmd`

Expected evidence:

- `IZAKHONO_ONE_NODE01=INTERNAL_PASS`
- `BUILDER_INTEGRATION=SOURCE_BRIDGE_PASS`
- `FLOW_INTEGRATION=INTERNAL_HEALTH_PASS`
- `PUBLIC_HTTPS=NOT_YET_VERIFIED`

The final line is expected at this stage. It is not a failure.

## Verification endpoints

On NODE 01:

- `http://127.0.0.1:8781/health`
- `http://127.0.0.1:8781/api/builder`
- `http://127.0.0.1:8781/api/flow`
- `http://127.0.0.1:8781/api/flow/health`

## Failure handling

If either launcher stops:

1. Preserve the console output.
2. Do not change public DNS or EDGE configuration.
3. Do not expose `.env.owned` or any secret values in screenshots, tickets, or logs.
4. Report the first `REASON=` line and the failing command/step.

## Promotion gate

`SOURCE VERIFIED → NODE01 INTERNAL PASS → EDGE/TLS PASS → PUBLIC HTTPS 200 + VERIFIED EXPERIENCE → OWNED LIVE`

NODE 01 internal success does **not** constitute public launch. Public launch requires a separate verified HTTPS gate.
