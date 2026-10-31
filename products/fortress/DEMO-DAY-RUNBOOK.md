# FORTRESS Executive Demonstration — Runbook

## Objective

Demonstrate the complete FORTRESS path from fragmented synthetic signals to explainable decision, case creation, network intelligence and analyst action in 10–15 minutes.

## Pre-Demo Gate

- Synthetic dataset loaded.
- Sandbox environment confirmed.
- `live_money_movement=false` confirmed.
- No production credentials in browser/client.
- Demo reset/replay tested.
- No real customer data.
- Decision reason codes enabled.
- Audit identifiers enabled.

## Act I — The Customer

Show a normal synthetic customer baseline.

Narrative: the customer normally uses a known device, established beneficiaries and predictable transaction behaviour.

## Act II — The Attack

Introduce:
1. unfamiliar device
2. remote-control/RAT indicator
3. behavioural drift
4. new beneficiary
5. high-value transaction
6. social-engineering indicator

Pause before the decision and ask:

**“How many of these signals would normally live in separate systems?”**

## Act III — FORTRESS Correlation

Show the engine pipeline:

Identity → Device → Behaviour → Transaction → Scam → Network → Decision

Show the reason codes and risk score.

Decision: **HOLD_FOR_REVIEW** in the synthetic scenario.

Emphasise that the decision is explainable and auditable.

## Act IV — Investigation

Open the automatically created case.

Show:
- risk event
- evidence timeline
- reason codes
- decision
- audit identifier
- analyst queue
- SLA clock

Introduce the second synthetic entity and show network correlation.

State clearly:

**“This is a correlation signal for an analyst to investigate — not an automated declaration of guilt.”**

## Act V — The Business Question

Ask the institution:

1. Where do these signals currently live?
2. How quickly can your existing stack correlate them?
3. Which controls act before payment completion?
4. How much analyst time is spent reconstructing events?
5. How do you identify coordinated patterns across accounts, devices and beneficiaries?
6. Which metrics would justify a 90-day pilot?

## Pilot Transition

Move immediately from demonstration to measurement.

Proposed next step:

**90-day controlled pilot**

- establish baseline
- integrate selected signals
- run shadow/controlled decisioning
- measure detection lift
- measure false positives
- measure latency
- measure analyst productivity
- assess network intelligence
- executive review

## Never Say

Do not say:
- “FORTRESS will eliminate fraud.”
- “FORTRESS guarantees savings.”
- “FORTRESS replaces your fraud stack.”
- “This customer is a criminal.”
- “We can freeze the money ourselves.”
- “We are already approved as a bank/payment institution.”

## Say

Use:

**“FORTRESS is designed to complement institutional controls by turning fragmented risk signals into an explainable decision and intelligence layer. The pilot determines whether that produces measurable improvement in your environment.”**

## Success Condition

The demo succeeds when the institution agrees to a technical discovery session and identifies one high-value use case suitable for a controlled pilot.
