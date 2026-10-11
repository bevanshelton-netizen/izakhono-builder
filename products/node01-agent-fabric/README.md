# NODE01 Agent Fabric v0.1

NODE01 Agent Fabric is the execution layer for the IZAKHONO AI workforce. It turns a single objective into a validated task graph, dispatches independent specialist agents concurrently, records every result, and produces an immutable execution receipt.

## Architecture

```text
Objective
   |
   v
Planner -> Task Graph -> Policy Gate -> Scheduler
                         |              |
                         |        +-----+----------------+
                         |        |     |      |         |
                         v        v     v      v         v
                      Approval  Research Build Security Operations
                                   Agents run in parallel where safe
                                            |
                                            v
                                      Review / Join
                                            |
                                            v
                                    Evidence + Receipt
```

The fabric is deliberately provider-neutral. Agents are capability records plus an executor implementation. Model inference is optional and replaceable; the core engine works with deterministic executors and can later bind to IZAKHONO AI GATEWAY / owner-hosted models.

## Safety boundaries

- No arbitrary shell execution from an objective.
- Destructive or external side effects are blocked unless the task explicitly declares the required capability and approval policy permits it.
- Every task has an idempotency key and execution receipt.
- `public_live` is never inferred from generation alone.
- Secrets are referenced by name, never stored in task payloads or receipts.
- Parallelism is limited by declared dependencies and resource locks.
- External providers remain adapters, not the source of truth.

## Built-in workforce

The initial registry contains 24 specialist roles across research, build, security, business and operations. The registry is intentionally expandable to 150+ agents without changing the scheduler.

## Run locally

```bash
python -m node01 --objective "Create a release candidate for a customer website"
python -m node01 --health
python -m unittest discover -s tests -v
```

No third-party Python package is required for the core engine.

## Status

This package is the **code-level NODE01 Agent Fabric**. Physical NODE01 activation, public HTTPS, DNS/TLS, model availability and production-live status remain separate evidence gates under the IZAKHONO infrastructure directive.
