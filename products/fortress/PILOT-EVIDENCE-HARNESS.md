# FORTRESS Institutional Pilot Evidence Harness

## Purpose

The evidence harness turns the FORTRESS synthetic adversarial suite into a repeatable institutional-pilot measurement artifact. It compares a deliberately simple control path with FORTRESS decisions and produces deterministic executive metrics.

## Safety Contract

- Synthetic data only.
- Sandbox only.
- `liveMoneyMovement=false` is mandatory.
- The harness must fail closed if a decision result is not one of the approved FORTRESS decisions or if sandbox/live-money invariants are violated.
- Metrics are demonstration evidence until replaced by measured institutional pilot telemetry.
- FORTRESS does not move, custody, freeze, recover, or settle funds.

## Current Measurements

1. Detection rate across synthetic attack scenarios.
2. Benign-control false-positive rate.
3. Synthetic decision-latency proxy.
4. Reason-code coverage.
5. Audit-evidence completeness.
6. Network-correlation count.
7. Acceptance pass rate.
8. Analyst workload proxy based on consequential synthetic cases.

## Execution

```bash
node products/fortress/pilot-evidence-harness.mjs
node products/fortress/pilot-evidence-harness.mjs --markdown
```

The JSON output is intended for machine-readable evidence collection. The Markdown output is intended for executive review and pilot documentation.

## Institutional Pilot Upgrade Path

During a real 90-day pilot, replace the synthetic inputs and deterministic latency proxy with authorised telemetry from the institution's agreed control group and FORTRESS path. Preserve the same metric definitions so results remain comparable.

Required production evidence should include:

- agreed baseline/control methodology;
- measured fraud-loss avoidance or equivalent loss metric;
- measured detection lift;
- false-positive rate;
- decision latency;
- analyst handling time;
- case volume and SLA performance;
- network-pattern discoveries validated by investigators;
- explainability and reason-code completeness;
- audit completeness;
- integration effort and operational resilience.

No synthetic result may be presented as a production outcome.
