# IZAKHONO SUPERAGENT v1

## Objective

Give IZAKHONO the DeerFlow-class operating behaviour demonstrated in the reference: accept one high-level objective, decompose it, research, use tools, create artifacts, verify results, recover from retryable failures and continue until the objective is complete or a genuine authorization boundary is reached.

This is an **orchestration layer**, not a chatbot and not a copy of DeerFlow.

## Operating loop

`GOAL -> PLAN -> RESEARCH -> EXECUTE -> VERIFY -> SECURITY GATE -> RECOVER -> ARTIFACT -> RELEASE GATE`

The loop is persistent and evidence-driven. A task does not become complete merely because text was generated.

## What the SuperAgent can orchestrate

- Web/public-source research
- Owner-authorized file search and reading
- Code generation and software build workflows
- Data/database operations through approved adapters
- Repository operations
- Document, report and presentation artifact creation
- Deployment preparation and verification
- Multi-step business workflows
- Retry and recovery of transient failures
- Structured audit events and evidence
- Adversarial pre-deployment security checks

## Autonomy rule

The SuperAgent continues without asking the owner for routine next-step instructions. It stops only for:

1. payment or financial authorization;
2. legal commitment or approval;
3. account/credential permission;
4. irreversible external action;
5. public-release authorization/evidence where the release gate requires it;
6. an unrecoverable technical failure.

## Security boundaries

- No arbitrary shell execution from an owner prompt.
- Tools are explicit, typed adapters.
- Provider credentials remain outside generated source.
- External providers are adapters, not the source of truth.
- IZAKHONO internal repositories remain authoritative for generated source.
- Public-live status remains evidence-gated.
- Owned-first, externally reversible infrastructure remains mandatory.
- **A model assertion is never accepted as proof of security.**
- Ownership, payment, webhook, rate-limit and secret controls must be tested where applicable.
- Blocking findings from the IZAKHONO Security Gate stop release unless a documented human waiver exists.

## Security Gate

Before production release, SuperAgent invokes:

```text
node security-gate/audit.mjs <application-path>
```

It then executes the adversarial prompts in `security-gate/SECURITY-PROMPTS.md`, using the application's own test framework where possible.

The release decision is:

- `SECURITY GATE: PASS`
- `SECURITY GATE: BLOCKED`
- `SECURITY GATE: WAIVED`

A zero-result static scan is not treated as a security guarantee. The required adversarial tests are the proof layer.

## Relation to existing IZAKHONO Builder

The existing Builder already provides one-sentence build planning, deterministic validation, internal repository snapshots and release-candidate gates. SUPERAGENT v1 sits above that machinery and turns it into a reusable goal-oriented execution loop.

For software objectives, the SuperAgent can hand work to `/api/build-anything` and then consume the resulting validation/release evidence. For other objectives, it can select the appropriate approved tool adapter and create artifacts without forcing everything through the software factory.

## Future runtime adapters

The runtime should expose adapters for:

- `web_research`
- `file_search`
- `file_read`
- `code`
- `build`
- `repository`
- `deployment`
- `database`
- `messaging`
- `artifact`
- `security_gate`

Each adapter returns success/failure, evidence and retryability. This allows the orchestration engine to recover from transient provider/runtime failures without changing the core agent logic.

## Example

Owner says:

> Research the South African school-uniform market, identify an opportunity, prepare a business case, build a landing-page prototype and create a presentation.

SUPERAGENT should autonomously:

1. normalize the objective;
2. research the market;
3. collect evidence;
4. identify the opportunity;
5. create the business case;
6. generate the product/build plan;
7. invoke Builder for the prototype;
8. test the prototype;
9. run the security gate and adversarial checks;
10. produce the presentation and supporting files;
11. verify each artifact;
12. return the finished package and evidence;
13. stop only if an external authorization or genuine blocker is encountered.

## Status vocabulary

`PLANNED` -> `RUNNING` -> `VERIFYING` -> `SECURITY_CHECK` -> `RECOVERING` -> `COMPLETE`

or

`BLOCKED` with a precise reason and the minimum action required to continue.

## Principle

> **Don't just answer the task. Operate the task — and prove it is safe before release.**
