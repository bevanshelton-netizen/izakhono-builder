# IZAKHONO AGENT CORE v1

The execution core for the IZAKHONO autonomous worker system.

It turns an approved goal into a deterministic plan, runs the plan through a state machine and agent harness, records an audit trail, verifies outcomes, and stops at explicit approval gates.

## Architecture

`GOAL -> PLAN -> AUTHORIZE -> EXECUTE -> VERIFY -> COMPLETE`

Failure path:

`EXECUTE -> DIAGNOSE -> RECOVER -> RETRY | BLOCKED`

Core components:

- **Planner** — creates typed steps from a goal.
- **State machine** — prevents illegal state transitions.
- **Harness** — executes only registered tools.
- **Policy** — enforces owned-first, least privilege, approval gates and evidence requirements.
- **Verifier** — requires explicit success evidence before completion.
- **Audit** — append-only execution events.
- **Memory** — stores reusable execution experience without making memory authoritative over current evidence.

## Safety boundary

The core does not execute arbitrary shell commands, publish externally, spend money, change DNS, rotate credentials, or make legal commitments without an explicit policy-approved tool and, where configured, an approval gate.

External providers are adapters. They are never the source of truth.

## Status

v1 is a deterministic orchestration kernel. Provider adapters, model routing and UI integrations plug into the typed interfaces rather than becoming dependencies of the core.
