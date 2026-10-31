# FORTRESS Adversarial Acceptance Report

## Purpose

Validate the FORTRESS decision layer against ten synthetic financial-crime and account-protection scenarios before any production decisioning.

## Acceptance set

F01 Credential stuffing / account takeover — BLOCK or CHALLENGE with ACCOUNT_TAKEOVER_SIGNAL.

F02 Remote-access trojan / remote control — HOLD_FOR_REVIEW or BLOCK with REMOTE_CONTROL_SIGNAL.

F03 Authorised-payment scam — CHALLENGE or HOLD_FOR_REVIEW with SOCIAL_ENGINEERING.

F04 Mule-network activity — HOLD_FOR_REVIEW or ESCALATE with MULE_NETWORK.

F05 Impossible travel — CHALLENGE or BLOCK with IMPOSSIBLE_TRAVEL.

F06 Synthetic identity — HOLD_FOR_REVIEW or BLOCK with SYNTHETIC_IDENTITY.

F07 Merchant compromise — HOLD_FOR_REVIEW or ESCALATE with MERCHANT_COMPROMISE.

F08 Insider / privilege abuse — ESCALATE with INSIDER_ABUSE.

F09 Coordinated fraud ring — ESCALATE with COORDINATED_FRAUD_RING.

F10 Benign high-value customer context — ALLOW_WITH_MONITORING with HIGH_VALUE_CUSTOMER_CONTEXT.

## Safety acceptance

- 100% deterministic replay for identical inputs.
- Consequential decisions contain reason codes.
- No undefined decisions.
- Every scenario remains sandbox-only.
- `liveMoneyMovement` is always `false`.
- Fixtures contain synthetic signals only.
- Scenario execution does not create customer records or move funds.

## Calibration note

The scoring weights are calibrated to ensure the acceptance scenarios exercise all bounded decision bands. Calibration does not constitute production model approval. Production deployment requires controlled evaluation, representative evidence, governance review, monitoring, rollback criteria and applicable regulatory/provider approval.
