# AI Execution Engine Acceptance Gate

A release is not considered live until these are demonstrated externally.

## Fast-path metrics

- P50 ordinary task completion <= 60 seconds.
- P95 ordinary task completion tracked separately; no false one-minute promise for heavy work.
- Intent routing <= 5 seconds target.
- Plan creation <= 5 seconds target.
- Independent workers overlap rather than serialize.
- Verification is included in the latency budget.

## Reliability

- Provider failure triggers an eligible fallback.
- Worker timeout does not stall unrelated workers.
- Failed jobs are resumable.
- Every job has durable status and evidence.
- Human approval is required for irreversible or financially consequential actions.

## Independence

- No business-critical state exists only inside a model-provider session.
- No provider-specific model name is required by the engine contract.
- Engine can run with alternate model adapters.
- Business engines remain independently callable without the AI layer.

## Commercial delivery

For a build request, the system must return the artifact, destination, verification status and any remaining user authorization required. It must never report an unverified deployment as live.

## Performance strategy

Known deterministic workflows should bypass unnecessary dynamic planning. Independent research/design/code/content work should fan out. Safe repeated operations may use caching or speculative execution. Tool batching should be preferred where semantics permit.
