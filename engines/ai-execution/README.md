# IZAKHONO AI Execution Engine

## Mission

Turn a natural-language prompt into a verified result with the lowest practical latency.

**PROMPT → INTENT → PLAN → PARALLEL EXECUTION → VERIFY → DELIVER**

This engine is the execution core of the IZAKHONO AI platform. It is not the UI, not a model provider, and not a hosting provider.

## Independence contract

- Model providers are adapters, not the system of record.
- Workers are replaceable.
- Engine state is durable and provider-neutral.
- External infrastructure is treated as replaceable capacity.
- No provider-specific deployment state is required for business continuity.
- Every completed job carries verification evidence.

## One-minute fast path

Target budget: 60 seconds for ordinary buildable tasks.

1. Intent classification: <= 5s
2. Plan/route: <= 5s
3. Parallel execution: <= 40s
4. Verification/assembly: <= 10s

Heavy tasks may continue asynchronously, but the user should receive immediate status and the first useful artifact without waiting for every background operation.

## Execution rules

1. Prefer a single direct model call for genuinely single-step work.
2. Use deterministic workflows when the task shape is known.
3. Fan out independent work concurrently.
4. Avoid unnecessary model turns; batch tool work where safe.
5. Speculate only when the operation is safe, reversible, and cheap to discard.
6. Keep shared mutable state behind explicit commit gates.
7. Verify outputs before claiming completion.
8. Route around failed providers instead of stopping the business.
9. Record latency, cost, failures and verification evidence for every job.

## Initial worker classes

- intent
- planner
- research
- code
- design
- content
- data
- integration
- test
- verifier
- deploy
- delivery

## Platform integration

Every IZAKHONO platform retains its own domain engine. The AI Execution Engine orchestrates those engines; it does not replace them.

Examples:

- FAISReady → FAISReady Exam Engine
- Allegro VIBEZ → Allegro Music Engine
- IZAKHONO HOST → Hosting Engine
- IZAKHONO DNS → DNS Engine
- IZAKHONO MAIL → Mail Engine

The AI layer is therefore an execution fabric across independent business engines.
