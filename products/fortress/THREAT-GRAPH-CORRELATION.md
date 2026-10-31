# FORTRESS Threat Graph Correlation

The correlation layer converts graph relationships into explainable risk patterns for analyst review.

## Graph

Identity → Device → Account → Transaction → Merchant → Counterparty → Case → Risk Event.

## Pattern detection

- Shared device
- Shared counterparty
- Coordinated high-risk activity
- Account-takeover clusters
- Merchant-compromise clusters
- Velocity clusters

A relationship is a risk signal, not proof of criminal conduct. Every pattern carries reason codes, a bounded score, confidence and evidence count.

## Safety

All correlation runs are sandbox-only. The engine cannot move, custody, freeze, recover or settle funds. Financial controls remain with authorised institutions/providers and approved operational workflows.
