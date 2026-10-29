# IZAKHONO Builder Contract v1

## Objective

Make an authorized IZAKHONO project behave like a continuous build-to-completion workstream rather than a sequence of manual NEXT prompts.

## Execution loop

`OBJECTIVE → PLAN → BUILD → TEST → REPAIR → VERIFY → PROMOTE → NEXT TASK`

The control plane may advance automatically whenever dependencies and evidence are satisfied.

## Builder adapters

The manifest supports provider adapters including `hercules`, `local-agent`, and `manual`.

A builder adapter receives:

- task id
- task title
- lifecycle stage
- action
- required evidence

It must return one of:

- `completed` — the task was executed and evidence is available;
- `waiting` — an external connection, credential, approval or capability is required;
- `failed` — the adapter attempted execution but could not complete the task.

## Hercules

Hercules remains the preferred application-builder adapter where connected. Hercules provides build, edit, test and publish capabilities through its ChatGPT/MCP integration. The IZAKHONO control plane must not store Hercules OAuth credentials in source control.

## Retry policy

Normal execution failures consume the manifest retry budget. External waiting states do not consume retry budget; the heartbeat wakes them again so a newly available provider connection can continue the work.

## Production evidence

No task may be marked live, launched or production-ready solely because code was generated. The required evidence must be recorded before promotion.

## Owner gates

The engine may stop only for genuine external dependencies, currently:

- builder connection
- credentials
- financial authorization
- physical infrastructure
- security exception

An owner gate is a dependency, not a manual NEXT prompt.

## Continuous heartbeat

`.github/workflows/izakhono-continuous-execution.yml` runs the engine on push and on a five-minute schedule. GitHub Actions supports scheduled workflows at a shortest interval of five minutes. The state file is committed back to the repository so execution survives individual runner instances.
