# IZAKHONO TASKS

Owner-controlled scheduling and automation service for the IZAKHONO ecosystem.

## Why it exists

External assistant products can impose plan-specific ceilings on the number of active scheduled tasks. IZAKHONO TASKS does not implement an artificial five-task, ten-task or plan-credit ceiling.

**Active task limit: none in application policy.**

That does not mean infinite capacity. Real limits remain owner CPU, RAM, storage, network, downstream service capacity and sensible abuse protection.

## Built in v1.0.0

- one-time tasks
- recurring interval tasks
- daily schedules
- weekly schedules
- condition-watch mode
- pause / resume / delete
- task run history
- SQLite WAL persistence
- entity-scoped task and run data
- optional bearer-token boundary
- optional signed owner-runner webhook
- mobile-friendly owner dashboard
- minimum recurrence of 60 seconds to prevent accidental tight loops
- no per-task subscription credits
- no artificial active-task count cap

## Architecture

Owner / product
→ IZAKHONO TASKS
→ owner scheduler
→ optional signed IZAKHONO runner
→ IZAKHONO Intelligence / Work / plugins / internal services

The scheduler is deliberately separate from the executor. This allows IZAKHONO to replace the worker or AI model without rewriting scheduling.

## Runner contract

Set:

- `IZAKHONO_TASKS_RUNNER_URL`
- `IZAKHONO_TASKS_RUNNER_SECRET`

When a task is due, IZAKHONO TASKS POSTs:

```json
{
  "run_id": "run_...",
  "task": {
    "id": "tsk_...",
    "entity_id": "entity-id",
    "title": "PayFast approval watch",
    "instruction": "Check the current state and report only when it changes.",
    "task_mode": "condition_watch"
  },
  "scheduled_for": 1788950400
}
```

Signed headers:

- `X-IZAKHONO-Run-ID`
- `X-IZAKHONO-Timestamp`
- `X-IZAKHONO-Signature`

The signature is HMAC-SHA256 over `timestamp + "." + raw_body`.

A runner may return:

```json
{"output":"No meaningful change.","notify":false}
```

Condition watches can therefore run without disturbing the owner when no notification is needed.

## Entity boundary

Every task and every run belongs to an `entity_id`. API requests must carry the same entity in `X-IZAKHONO-Entity-ID`.

This follows the group rule: separate businesses, shared infrastructure.

## Local start

```bash
python3 products/izakhono-tasks/app.py
```

Open:

`http://127.0.0.1:9991`

For anything beyond localhost, put the service behind IZAKHONO EDGE/TLS and set a strong `IZAKHONO_TASKS_TOKEN`.

## Production gates

Do not call the service public-production-ready until:
- deployed to a real owner node;
- IZAKHONO EDGE/TLS is active;
- IZAKHONO VAULT manages secrets;
- IZAKHONO OBSERVE monitors scheduler health and missed runs;
- an owner runner is connected and validated;
- backup/restore is proven.
