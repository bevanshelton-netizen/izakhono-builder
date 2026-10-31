# FORTRESS Independent Runtime Execution Evidence — 2026-10-31

## Result

**INDEPENDENT RUNTIME VALIDATION PASS**

- Scenarios replayed: **10**
- Passed: **10**
- Failed: **0**
- Acceptance rate: **100%**
- `sandboxOnly=true`
- `liveMoneyMovement=false`

## Execution Basis

The current FORTRESS pilot evidence harness was executed in an independent local Node.js runtime using the repository's deterministic scenario logic. The harness source was verified from GitHub before execution.

Source harness:
`products/fortress/pilot-evidence-harness.mjs`

Source harness SHA:
`57e9ed53dedefcffa63f5d5c9ec1e298518c7fd3`

## Scope

The execution covers the ten synthetic adversarial/control scenarios F01–F10 and verifies decision safety, expected decision classes, required reason codes, and the sandbox/no-money-movement boundary.

## Important Limitation

This is **not GitHub Actions CI evidence**. It is independent runtime validation. The CI execution gate remains open until a reproducible GitHub Actions workflow run produces the required logs and artifacts.

This evidence is also **not production performance evidence**. It makes no claim about real-world fraud-loss reduction, customer impact, production false-positive rate, regulatory effectiveness, or production latency.

## Safety Boundary

- Synthetic data only.
- Sandbox only.
- FORTRESS does not move, custody, freeze, recover, or settle funds.
- Live financial actions remain under authorised institutional controls and applicable law.
- Network correlation is an investigative signal, not a guilt determination.
