# FORTRESS Adversarial Scenario Catalogue

## Purpose
Exercise the FORTRESS decision layer against representative fraud, scam, account-takeover and cyber-enabled financial-crime patterns before any production decisioning is authorised.

## Scenario Contract
Each scenario supplies identity, device, behaviour, context, transaction and network signals and expects a bounded decision. Tests must verify both the decision and the reason codes.

## Core Scenarios

### F01 — Credential Stuffing / Account Takeover
- New device
- Failed-login burst
- Known compromised credential indicator
- Behavioural deviation
- High-value payment attempt
- Expected: `CHALLENGE` or `BLOCK`

### F02 — Remote Access Trojan
- Trusted customer identity
- Device shows remote-control/RAT indicators
- New session
- Payment destination changed
- Expected: `HOLD_FOR_REVIEW` or `BLOCK`

### F03 — Authorised-Payment Scam
- Normal authenticated session
- New beneficiary
- Unusual amount
- Social-engineering/high-pressure indicators
- Expected: `CHALLENGE` or `HOLD_FOR_REVIEW`

### F04 — Mule Account Pattern
- Previously low-risk account
- Rapid inbound/outbound velocity
- Multiple unrelated counterparties
- Network risk indicators
- Expected: `HOLD_FOR_REVIEW` or `ESCALATE`

### F05 — Impossible Travel
- Recent authenticated activity in geographically incompatible locations
- New device/session
- Payment immediately follows session change
- Expected: `CHALLENGE` or `BLOCK`

### F06 — Synthetic Identity
- Weak identity consistency
- Device/account linkage anomalies
- Repeated onboarding attempts
- Conflicting identity attributes
- Expected: `HOLD_FOR_REVIEW` or `BLOCK`

### F07 — Merchant Compromise
- Normally trusted merchant
- Sudden transaction-pattern deviation
- Elevated chargeback/failure indicators
- Multiple affected customers
- Expected: `HOLD_FOR_REVIEW` or `ESCALATE`

### F08 — Insider / Privilege Abuse
- Privileged actor
- Unusual access time
- Sensitive-data access spike
- Behaviour outside baseline
- Expected: `ESCALATE`

### F09 — Coordinated Fraud Ring
- Multiple identities/devices
- Shared network indicators
- Repeated beneficiary relationships
- Correlated transaction timing
- Expected: `ESCALATE`

### F10 — Benign High-Value Customer
- Strong identity assurance
- Known device
- Normal behaviour
- Established beneficiary
- High-value transaction consistent with history
- Expected: `ALLOW_WITH_MONITORING`

## Safety Invariants
1. A FORTRESS engine may recommend a financial-control action but cannot independently move, custody or recover funds.
2. Every non-ALLOW decision must contain reason codes.
3. Every consequential decision must have an audit identifier.
4. Missing critical identity or transaction context must never silently downgrade risk.
5. Scenario execution is sandbox-only until formal production approval exists.
6. Test fixtures must contain synthetic data only.

## Acceptance Targets
- 100% deterministic replay for identical inputs.
- 100% reason-code presence for challenged, held, blocked and escalated events.
- No scenario may produce an undefined decision.
- No scenario may invoke money movement.
- Every scenario must be replayable for regression testing.
