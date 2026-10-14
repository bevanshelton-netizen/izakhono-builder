# One-Minute Execution Contract

IZAKHONO AI is designed around a simple customer promise: **describe the outcome, and get a result fast.**

## Fast path

The fast path is reserved for work whose dependency graph and resource requirements fit the latency budget. Typical examples include:

- generating a landing page from a known template;
- producing an advert from an existing product record;
- transforming supplied text;
- generating a business document from structured data;
- querying indexed IZAKHONO data;
- running a known workflow with deterministic tools.

## Parallelism

The planner must identify independent nodes and dispatch them concurrently. Research, copy, graphics and data retrieval should not wait for one another when their inputs are already available.

## Model routing

Use a model registry and capability profiles rather than hard-coding a provider. The router may select different models for classification, coding, reasoning, vision, extraction or synthesis. Provider changes must not alter task semantics.

## Speculative execution

For recurring workflows, the engine may prefetch or speculatively execute predictable safe operations. Speculation must be cancellable, bounded and free of irreversible side effects until the plan reaches an approved execution gate.

## Verification

Fast does not mean unverified. Every commercial, deployment or security-sensitive task has explicit verification gates. A result may be returned as **draft**, **ready for review**, or **verified live**; these states must never be conflated.

## Heavy jobs

If a task cannot fit the one-minute budget, return a job handle and first progress immediately. Continue execution outside the chat turn, persist checkpoints, retry recoverable failures and surface the final verified result when complete.

## Measurement

Record:

- time to first useful response;
- time to execution-plan creation;
- time spent waiting on tools;
- parallelism achieved;
- total completion latency;
- verification latency;
- model/tool cost;
- retries and fallback events;
- success rate.

The engine must optimize against measurements, not assumptions.
