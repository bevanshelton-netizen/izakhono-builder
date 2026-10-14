# IZAKHONO AI Execution Engine

## Mission

Turn a natural-language prompt into a verified result as quickly as the task permits.

**PROMPT → UNDERSTAND → PLAN → FAN-OUT → EXECUTE → VERIFY → DELIVER**

The target experience is sub-minute completion for lightweight tasks and immediate asynchronous execution for heavier tasks. A long-running job must never be confused with a slow chat turn: the engine returns a job identity and progress state while work continues.

## Independence

The execution engine is provider-neutral. Model providers, hosting providers, search providers and individual tools are adapters, not the system itself. No provider is the source of truth for workflow state, task identity, business logic or validated outputs.

## Core components

- **Intent Engine** — classify the request and identify the desired outcome.
- **Planner Engine** — compile the request into a typed execution graph.
- **Router** — select the lowest-latency model/tool combination that satisfies quality requirements.
- **Execution Engine** — execute independent nodes concurrently and dependent nodes in DAG order.
- **Worker Fabric** — research, code, design, data, content, QA and deployment specialists.
- **Verification Engine** — validate outputs against explicit acceptance gates.
- **Delivery Engine** — return the result, artifact, URL, status or durable job handle.
- **Memory/State** — persist task state independently of any model provider.
- **Observability** — measure first-result latency, completion latency, quality, cost, retries and failures.

## Speed rules

1. Never serialize independent work.
2. Prefer one structured plan over repeated model/tool turns.
3. Keep intermediate tool output outside the conversational context where possible.
4. Cache stable instructions, capabilities and reusable results.
5. Keep hot workers warm for common tasks.
6. Route simple tasks to fast models; reserve frontier reasoning for hard steps.
7. Use deterministic workflows when the process is known; use dynamic planning only where discovery is required.
8. Verify before claiming completion.
9. Fail over providers without changing the business workflow.
10. Return partial progress immediately for jobs that cannot honestly finish in one minute.

## One-minute service objective

For eligible lightweight requests:

- intent classification: <5s
- plan compilation: <5s
- parallel execution: <40s
- verification + delivery: <10s

These are engineering targets, not guarantees. The system must report actual latency rather than inventing compliance.
