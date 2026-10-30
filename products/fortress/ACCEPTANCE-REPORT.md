# FORTRESS Security Acceptance Report

## Suite
FORTRESS Adversarial Acceptance Suite — 10 synthetic scenarios.

## Scope
This benchmark validates the bounded FORTRESS decision layer before production decisioning. It is sandbox-only and does not move, custody, freeze, recover or otherwise manipulate funds.

## Acceptance Criteria
- Every scenario produces a defined decision.
- Every consequential decision contains a reason code.
- Every scenario remains sandbox-only.
- Live money movement remains disabled.
- Results are deterministic for identical inputs.
- F08 and F09 must escalate rather than silently downgrade to a lower-risk decision.

## Scenarios
| ID | Threat | Expected outcome |
|---|---|---|
| F01 | Credential stuffing / account takeover | Challenge or Block |
| F02 | Remote access trojan | Hold or Block |
| F03 | Authorised-payment scam | Challenge or Hold |
| F04 | Mule account | Hold or Escalate |
| F05 | Impossible travel | Challenge or Block |
| F06 | Synthetic identity | Hold or Block |
| F07 | Merchant compromise | Hold or Escalate |
| F08 | Insider / privilege abuse | Escalate |
| F09 | Coordinated fraud ring | Escalate |
| F10 | Benign high-value customer | Allow with monitoring |

## Execution Contract
The executable suite is `acceptance-suite.mjs`. It consumes only synthetic fixtures and emits a machine-readable benchmark with total, passed, failed, score percentage, sandbox status and live-money status.

## Production Gate
A passing simulation benchmark is evidence of engineering readiness only. It is **not** regulatory approval, production authorisation, or evidence that FORTRESS can independently control customer funds.
