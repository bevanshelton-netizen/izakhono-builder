# FORTRESS CI Execution Recovery

## Objective
Obtain independently verifiable GitHub Actions execution evidence for the FORTRESS adversarial acceptance suite and institutional pilot evidence harness.

## Gate
The evidence gate is CLOSED until a workflow run completes successfully and produces both JSON artifacts.

Required outputs:
- fortress-acceptance.json
- fortress-pilot-evidence.json

Required safety assertions:
- sandboxOnly === true
- liveMoneyMovement === false

A successful code commit is not evidence of successful execution. A successful workflow run is required before the FORTRESS acceptance result may be represented as verified.

## Recovery procedure
1. Confirm the workflow exists under `.github/workflows/fortress-pilot-evidence.yml`.
2. Confirm it is triggered by pushes to `main` affecting `products/fortress/**` and by `workflow_dispatch`.
3. Confirm Node 20 is installed by the runner.
4. Execute `acceptance-suite.mjs`.
5. Execute `pilot-evidence-harness.mjs`.
6. Enforce the safety gate.
7. Upload both JSON reports as a workflow artifact.
8. Record the workflow run ID, conclusion, job result, and artifact presence.
9. Only then update institutional evidence as VERIFIED.

## Non-negotiable
No execution evidence means no PASS claim. Synthetic results remain synthetic and must never be presented as real-world fraud-loss reduction.
