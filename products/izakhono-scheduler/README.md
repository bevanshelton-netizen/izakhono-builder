# IZAKHONO Scheduler

Owned-first scheduling control plane for IZAKHONO automations.

## Architecture

`Scheduler Control Plane -> Durable Queue -> Owned Worker (NODE01 preferred) -> Execution -> Run Audit`

The scheduler owns job definitions, due-state and run history. Execution is deliberately separated so the runtime can move between NODE01, an IZAKHONO edge worker, or a verified external fallback without changing customer-facing automation logic.

## Core API

- `GET /health` — health check
- `GET /api/jobs` — list jobs
- `POST /api/jobs` — create/update a job
- `POST /api/jobs/:id/disable` — disable a job
- `POST /api/tick` — enqueue due jobs
- `POST /api/runs/claim` — atomically claim the next queued run
- `POST /api/runs/:id/complete` — complete/fail a run

All management endpoints require `Authorization: Bearer <SCHEDULER_SECRET>`.

## Safety rules

1. Never claim a job executed until a worker reports completion.
2. Keep scheduling state durable and auditable.
3. Keep business logic independent from the scheduler runtime.
4. Prefer IZAKHONO-owned execution first; preserve reversible fallbacks.
5. Do not store provider credentials in job prompts.

## First production job

`daily-izakhono-revenue-execution-check` should run at 08:00 Africa/Johannesburg and generate the daily CEO revenue execution brief. The scheduler can queue this job; the AI/worker layer is responsible for actually producing and delivering the brief.
