# FORTRESS Network Risk Scoring Engine

The Network Risk Scoring Engine converts correlated Threat Graph patterns into a bounded, explainable network-risk context for the FORTRESS decision pipeline and analyst Command Centre.

## Inputs

- Pattern type
- Pattern score
- Pattern confidence
- Evidence count
- Reason codes
- Related entity identifiers

## Pattern weighting

Higher-impact patterns receive greater base influence:

- Account-takeover cluster
- Merchant-compromise pattern
- Coordinated transaction pattern
- Velocity cluster
- Rapid-movement pattern
- Shared device
- Shared counterparty

The score is bounded to 0–100. Confidence is separately calculated and never treated as proof of wrongdoing.

## Risk bands

- LOW: <40
- MEDIUM: 40–69
- HIGH: 70–89
- CRITICAL: 90–100

## Decision integration

The network result is passed into the existing FORTRESS core risk contract as a single network signal. This preserves one decision contract while allowing the graph to become an additional intelligence source.

`GRAPH PATTERNS → NETWORK SCORE → CORE RISK CONTRACT → DECISION → REASON CODES → CASE / AUDIT`

## Governance

Network proximity is intelligence, not guilt. Cross-entity correlation must respect lawful purpose, data minimisation, retention, tenant isolation and approved information-sharing arrangements.

## Safety boundary

The engine is sandbox-only. It cannot move, custody, freeze, recover or settle money. Any consequential financial control remains with an authorised institution/provider and an approved operational workflow.
