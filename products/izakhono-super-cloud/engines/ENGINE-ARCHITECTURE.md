# IZAKHONO SUPER CLOUD — ENGINE FABRIC

The engine fabric turns the Super Cloud control plane into an operating cloud rather than a passive API.

## Core engines

1. **Scheduler Engine** — converts desired workload state into placement decisions.
2. **Node Agent Engine** — registers owned compute nodes, reports heartbeat/capacity and executes approved workload actions.
3. **Deployment Engine** — builds deployment plans, runs health gates and records promotion/rollback evidence.
4. **Domain Engine** — manages domain intent, DNS records, TLS certificates and ingress readiness.
5. **Storage Engine** — provisions object/database/cache resources and tracks lifecycle.
6. **Image Engine** — manages build artifacts, image metadata, digests and promotion channels.
7. **Observability Engine** — collects health, events, metrics and deployment evidence.
8. **Policy Engine** — enforces tenant isolation, production evidence, quotas and owned-first placement.

## Engine contract

Every engine exposes:

- `GET /health`
- `GET /v1/status`
- authenticated command endpoints under `/v1/*`
- idempotent command handling using a request/idempotency key
- structured event output
- explicit `planned`, `running`, `succeeded`, `failed`, and `blocked` states

## Safety boundary

Engines may prepare, validate and execute infrastructure actions only where the required adapter and credentials exist. They must never manufacture production evidence. `LIVE_VERIFIED` is reserved for evidence produced by real endpoint, DNS/TLS, health, backup/restore and rollback checks.

## Placement policy

`owned` capacity is preferred. External capacity is an explicitly labelled fallback. A deployment may not silently migrate from owned to external infrastructure.
