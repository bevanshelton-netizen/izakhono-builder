# FORTRESS — Synthetic Institutional Fraud Demonstration

## Purpose

Provide a repeatable, executive-friendly demonstration of how FORTRESS correlates fragmented signals into an explainable risk decision and investigation workflow.

This demonstration uses synthetic data only. It is not a prediction about any real customer, institution, person, merchant, account or transaction.

## Scenario: Coordinated Account-Takeover + Scam Transfer

### T+0 — Initial access

A synthetic customer account signs in from a previously unseen device. Device telemetry reports a remote-control/RAT indicator. The session also shows a behavioural deviation from the customer's established baseline.

Signals:
- New device
- Remote-control indicator
- Behavioural drift
- Elevated session risk

FORTRESS engines involved:
- Identity Engine
- Device Engine
- Behaviour Engine

### T+2 minutes — Beneficiary creation

A new beneficiary is added. The beneficiary has no established relationship with the customer. The session exhibits elevated interaction velocity.

Additional signals:
- New beneficiary
- High-risk session context
- Velocity anomaly

Transaction Risk Engine increases the contextual risk score.

### T+4 minutes — Payment attempt

A synthetic high-value payment is initiated to the new beneficiary. A scam/social-engineering signal is present in the scenario context.

FORTRESS evaluates:

`identity + device + behaviour + context + transaction + network intelligence`

Result:

`risk score → reason codes → decision → action → audit evidence`

### T+5 minutes — Decision

Illustrative sandbox decision:

**HOLD_FOR_REVIEW**

Illustrative reason codes:
- REMOTE_CONTROL_INDICATOR
- NEW_BENEFICIARY
- BEHAVIOUR_DRIFT
- TRANSACTION_ANOMALY
- SOCIAL_ENGINEERING_SIGNAL

No funds are moved, frozen, recovered or settled by FORTRESS.

The decision is communicated as a recommendation to an authorised institutional control layer.

### T+7 minutes — Case creation

Because the decision is consequential, FORTRESS creates an investigation case containing:
- risk-event identifier
- risk score
- reason codes
- engine evidence
- subject reference
- transaction reference
- timestamps
- decision
- audit identifier

The case enters the appropriate analyst queue and SLA clock.

### T+12 minutes — Network intelligence

The synthetic demonstration introduces a second synthetic account that shares several risk indicators with the first case.

FORTRESS Network Intelligence correlates the synthetic entities and identifies a potential coordinated pattern.

Important distinction:

A correlation is an investigative signal, not proof of criminality.

The analyst must review evidence before disposition.

### T+20 minutes — Analyst investigation

The analyst reviews the evidence timeline and may classify the case as one of:

- CONFIRMED_FRAUD
- SUSPECTED_FRAUD
- FALSE_POSITIVE
- CUSTOMER_PROTECTION
- ACCOUNT_TAKEOVER
- SCAM_ATTEMPT
- MULE_ACTIVITY
- NO_ACTION

Every consequential decision remains auditable.

## Executive Demonstration Flow

The live walkthrough should take approximately 10–15 minutes:

1. Show the customer baseline.
2. Introduce the new device.
3. Introduce the remote-control signal.
4. Add the new beneficiary.
5. Initiate the synthetic transaction.
6. Show the FORTRESS decision and reason codes.
7. Show the audit identifier.
8. Show automatic case creation.
9. Introduce the second synthetic entity.
10. Show network correlation.
11. Open the investigation timeline.
12. Show the analyst disposition and SLA controls.

## What the Institution Should See

The demonstration is deliberately not positioned as a replacement for existing bank fraud systems.

The value proposition is the orchestration layer across fragmented signals:

- identity
- device
- behaviour
- transaction
- scam indicators
- network intelligence
- investigation
- auditability

The executive question is:

> Can FORTRESS identify additional risk earlier, explain why, reduce unnecessary friction, and improve investigation productivity when evaluated against the institution's existing controls?

## Pilot Measurement

A real institutional pilot should establish a baseline before measuring FORTRESS performance.

Primary metrics:
- detection lift
- fraud-loss avoidance
- false-positive rate
- decision latency
- analyst handling time
- cases generated per 1,000 events
- network-pattern discovery
- explainability coverage
- audit completeness
- integration effort

No performance improvement should be claimed until measured against agreed baseline data.

## Safety and Regulatory Boundary

- Synthetic data only for this demonstration.
- Sandbox-only execution.
- `live_money_movement = false`.
- FORTRESS does not custody customer funds.
- FORTRESS does not independently transfer, settle, freeze or recover funds.
- Financial-control actions remain with authorised institutional systems and legally permitted providers.
- No automated model is promoted directly into live consequential decisioning without controlled evaluation and institutional approval.
- Correlation does not equal guilt.
- Human investigation and institutional governance remain mandatory for consequential cases.

## Closing Executive Message

**Cybercrime succeeds when useful signals remain fragmented. FORTRESS is designed to turn those signals into a coordinated, explainable and auditable defence layer — making financial crime harder to execute and harder to monetise.**
