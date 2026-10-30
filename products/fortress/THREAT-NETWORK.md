# FORTRESS Threat Network

## Purpose

FORTRESS Threat Network is the provider-neutral intelligence layer for correlating risk across identities, devices, transactions, merchants and cases.

It is designed to identify coordinated patterns rather than treating each event as an isolated incident.

## Graph model

Nodes may represent:
- subject / customer identity
- device
- account
- merchant
- transaction
- beneficiary / counterparty
- IP / session context
- case
- risk event

Edges represent bounded relationships such as:
- authenticated_on
- transacted_with
- controlled_by
- associated_with
- reported_in
- shared_signal_with

## Risk propagation

A confirmed or high-confidence signal may increase the risk context of connected entities, subject to policy, confidence thresholds and lawful data-sharing constraints.

FORTRESS must never infer guilt solely from graph proximity. Network relationships are intelligence signals requiring appropriate evidence and review.

## Privacy and governance

- Data minimisation by design.
- Purpose limitation.
- Explicit retention policies.
- Lawful information-sharing agreements.
- Tenant isolation.
- No unrestricted cross-merchant customer profiling.
- Explainable network-derived reason codes.
- Human review for consequential outcomes where required.

## Decision boundary

The network may produce intelligence and risk context. It does not independently move, custody, freeze, recover or settle funds.

## Initial network signals

1. Shared device across unusually unrelated subjects.
2. Repeated high-risk beneficiary relationships.
3. Coordinated transaction timing.
4. Merchant compromise clusters.
5. Repeated account-takeover indicators.
6. Shared infrastructure or session-risk indicators.
7. Rapid movement across connected accounts or merchants.

## Operating principle

`ENTITY → RELATIONSHIP → PATTERN → RISK CONTEXT → DECISION → CASE → EVIDENCE → OUTCOME`

All network analytics remain sandbox-first until formally tested, approved and lawfully integrated into production decisioning.
