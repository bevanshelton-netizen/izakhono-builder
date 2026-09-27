# IZAKHONO FLOW — NODE01 activation

## Purpose

This package turns the merged IZAKHONO FLOW source into a verifiable owned NODE01 runtime without changing public DNS or declaring the service public-live.

## Owner sequence

From the repository root on the owner Windows machine:

1. Run `START-APP-FABRIC-NODE01.cmd`.
2. Confirm the generated Desktop report `IZAKHONO-APP-FABRIC-NODE01-REPORT.json` says `PASS_INTERNAL_OWNED`.
3. Run `RUN-IZAKHONO-ONE-NODE01.cmd`.
4. Run `VERIFY-APP-FABRIC-NODE01.cmd`.

## What step 1 proves

The activation script must fail closed unless all of these pass:

- `izakhono-crm` is healthy.
- `izakhono-revenue` is healthy.
- `izakhono-tasks` is healthy.
- `izakhono-flow` is healthy.
- `izakhono-app-fabric-gateway` is healthy.
- Gateway -> CRM non-writing integration proof passes.
- FLOW accepts an owner-authenticated scoped read.
- FLOW health reports independent engine + no tracking.
- FLOW reports the owned CRM, REVENUE and TASKS adapters as configured.
- FLOW durable volume is writable.
- A FLOW volume snapshot is created in the owner backup directory.
- That snapshot restores into an isolated temporary Docker volume.
- The restore contains the exact persistence probe.
- The temporary restore volume and live probe marker are removed after the proof.

No customer event, payment, CRM deal or production workflow is created by the owner activation proof. End-to-end adapter writes are exercised only in isolated CI. Production actions occur only when a real platform emits a FLOW event.

## Owner secrets

`/opt/izakhono/secrets/app-fabric-runtime.env` is owner-only and includes:

- `CRM_ADMIN_TOKEN`
- `CRM_INGEST_TOKEN`
- `IZAKHONO_FABRIC_INTERNAL_TOKEN`
- `FLOW_ADMIN_TOKEN`
- `FLOW_INGEST_TOKEN`
- `REVENUE_FLOW_TOKEN`
- `IZAKHONO_TASKS_TOKEN`
- `IZAKHONO_TASKS_FLOW_TOKEN`
- optional `IZAKHONO_PAY_FLOW_URL` + `PAY_FLOW_TOKEN`
- optional `IZAKHONO_SUPER_AI_FLOW_URL` + `FLOW_SUPER_AI_INTERNAL_KEY` + `FLOW_SUPER_AI_WORKFLOW_KEY`
- `FLOW_ADAPTERS_JSON`

Existing values are preserved. Missing credentials are generated with OpenSSL and the file is kept mode 600.

At activation time the script constructs `FLOW_ADAPTERS_JSON` in memory for the three owned private-network adapters:

- `izakhono-crm -> http://crm:8080/api/flow`
- `izakhono-revenue -> http://revenue:8795/api/flow`
- `izakhono-tasks -> http://tasks:9991/api/flow`

PAY is added only when its real endpoint and matching token are present.

SUPER AI is added only when its FLOW-reachable `/api/v1/generate` endpoint and both matching trusted-workflow credentials are present. The FLOW-side aliases are `FLOW_SUPER_AI_INTERNAL_KEY` and `FLOW_SUPER_AI_WORKFLOW_KEY`; they must match the approved SUPER AI owner configuration. FLOW does not generate these values.

FLOW calls SUPER AI as product `izakhono-flow`, using trusted workflow mode, the owned route and internal data classification. Customer identity fields are removed from advisory metadata before the request.

Platform-specific fulfilment remains unconfigured until that platform provides its own approved adapter.

## What step 3 proves

`RUN-IZAKHONO-ONE-NODE01.cmd` refuses to start the SUPER APP FLOW bridge unless:

- the owned `izakhono_private` network exists;
- `izakhono-flow` is healthy.

IZAKHONO ONE retains its normal Docker network and additionally joins `izakhono_private`. It sets:

`IZAKHONO_FLOW_INTERNAL_URL=http://izakhono-flow:8794`

The launcher then requires both:

- `GET /api/flow` -> integrated independent FLOW descriptor;
- `GET /api/flow/health` -> HTTP 200 from the real internal FLOW engine.

## Evidence

The activation report schema is:

`izakhono.app-fabric.node01.report.v2`

It records health/image identifiers but never exports secret values.

FLOW backups are stored under:

`/opt/izakhono/backups/flow/`

## Status boundary

Passing this sequence means:

`SOURCE MERGED -> NODE01 INTERNAL FLOW PASS -> SUPER APP INTERNAL BRIDGE PASS`

It does **not** mean public-live.

Public promotion still requires the relevant EDGE/TLS/DNS route, approved exposure model, adapter acceptance tests and independent HTTPS verification. FLOW administration should remain private unless a separately reviewed public interface is created.
