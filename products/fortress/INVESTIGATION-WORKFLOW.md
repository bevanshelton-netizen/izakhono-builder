# FORTRESS Investigation Workflow

## Purpose
Turn consequential risk events into controlled, auditable investigations without allowing FORTRESS to independently move, custody, freeze or recover funds.

## Lifecycle
1. ALERT_CREATED — consequential risk event is recorded.
2. TRIAGED — analyst/system assigns priority and validates context.
3. INVESTIGATING — evidence, related events and network indicators are reviewed.
4. ESCALATED — specialist, institution or authorised provider is engaged where required.
5. RESOLVED — disposition and supporting evidence are recorded.
6. CLOSED — case is immutable for ordinary operational users; reopening requires controlled authority.

## Required evidence
- risk event ID
- decision and risk score
- reason codes
- engine results
- subject/merchant/transaction references where available
- timestamps
- analyst/system actor
- disposition
- supporting evidence references
- override reason when an analyst changes a recommended outcome

## Allowed dispositions
- CONFIRMED_FRAUD
- SUSPECTED_FRAUD
- FALSE_POSITIVE
- CUSTOMER_PROTECTION
- MERCHANT_COMPROMISE
- ACCOUNT_TAKEOVER
- SCAM_ATTEMPT
- MULE_ACTIVITY
- POLICY_VIOLATION
- NO_ACTION

## Safety boundary
FORTRESS can recommend or communicate a financial-control action to an authorised institution/provider. It cannot independently create, transfer, custody, freeze, recover or settle customer funds.

## Command Centre requirements
The UI must expose alert priority, decision, risk score, reason codes, engine health, evidence timeline, related events, analyst disposition, overrides and audit identifiers. Secrets and service-role credentials must never reach the browser.
