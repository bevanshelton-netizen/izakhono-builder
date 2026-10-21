# Specialist Execution Worker

## Purpose

Consume one queued ABE specialist task, generate a structured result, persist execution evidence, and emit an auditable event. The worker must never claim an external action unless the runtime returns verifiable evidence.

## Input

- `run_id`
- `task_id`
- `agent`
- `task`
- `idea`
- `execution_mode`: `dry_run` or `live`

## Execution contract

1. Load the run and task.
2. Atomically claim the task from `queued` to `running`.
3. Validate that the task belongs to the run and the agent is allowed for the task.
4. Generate a structured specialist result containing:
   - objective
   - findings
   - recommendations
   - proposed_actions
   - blockers
   - confidence
5. Pass proposed actions to the Execution Adapter.
6. In dry-run mode, actions are simulated and receive explicit `dry_run` evidence.
7. In live mode, only approved reversible actions may execute through a verified IZAKHONO runtime adapter.
8. Persist the result and evidence on the task.
9. Mark the task `completed` only when the specialist result has been persisted and required evidence exists. Otherwise mark it `blocked` or `failed` with a reason.
10. Emit `specialist_started`, `specialist_completed`, `specialist_blocked`, or `specialist_failed` events as appropriate.
11. The CEO Orchestrator may advance the run stage only from persisted task evidence, never from an in-memory assumption.

## Initial agent outputs

### Research
Market/customer/problem validation, demand signals, competitive positioning, opportunity and risks.

### Product
MVP scope, customer journey, value proposition, launch requirements and product backlog.

### Revenue
First paid offer, pricing, monetization, unit economics, payment path and revenue assumptions.

### Operations
Execution workflow, infrastructure dependencies, controls, support model and continuous operating loop.

## Safety / integrity rules

- Default execution mode is `dry_run`.
- No payment, domain registration, DNS change, production deployment, customer communication or other irreversible action occurs without explicit approved live execution through the runtime.
- Every completed task must have an evidence record.
- Every external action must have a runtime result identifier.
- The worker must be idempotent: replaying the same task must not create duplicate irreversible actions.
- Never report `live`, `deployed`, `paid`, `launched`, or `completed` without persisted evidence supporting the claim.

## Next runtime implementation

Implement the worker as an adapter-compatible service/function that can be mounted into an existing IZAKHONO-owned gateway. Do not create or overwrite a Supabase Edge Function while the project function limit is exhausted.
