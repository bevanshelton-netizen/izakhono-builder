# IZAKHONO AI Workforce — Owner Acceptance Register v1.0

**Status:** Open decision register; no owner acceptance is implied  
**Parent:** PR #748 — IZAKHONO AI Workforce architecture v1  
**Purpose:** Capture accountable decisions and evidence before any production implementation is authorized.

## 1. Decision-control rules

1. Every decision has one accountable owner role and one explicitly named owner/team in the completed record. The role below is a routing target, not proof that a person has accepted responsibility.
2. No owner, approval, evidence reference, production endpoint, key, database, runner or deployment is inferred from repository code or documentation.
3. A decision is **UNCONFIRMED** until the accountable owner records ACCEPT, REJECT or DEFER and supplies the evidence required below.
4. ACCEPT means acceptance of the stated contract and its limitations. It does not authorize deployment, credentials, data migration or production writes unless a separate change authorization explicitly does so.
5. If owners disagree across a trust boundary, the dependent capability remains blocked. FORTRESS and the consuming enforcement owner must agree on authorization semantics.
6. A passing synthetic test validates only its test model. Production acceptance requires evidence from the actual approved enforcement boundary.
7. Update this register with a reviewable evidence reference, not a statement such as “discussed”, “looks good” or “works locally”.

## 2. Decision status

Allowed states:

- **UNCONFIRMED** — owner or evidence not yet recorded; default for every row below.
- **PROPOSED** — a written proposal exists but has not been accepted by the accountable owner.
- **ACCEPTED** — owner, date, contract version, evidence and limitations are recorded.
- **REJECTED** — owner declined the proposal; dependent work must be redesigned.
- **DEFERRED** — owner postponed the decision; dependent production capability remains blocked.
- **SUPERSEDED** — a later accepted decision explicitly replaces this record.

No row in this initial register is marked ACCEPTED.

## 3. Decision register

| ID | Decision | Accountable owner role to identify | Required acceptance evidence | Status |
|---|---|---|---|---|
| AW-OWN-001 | Canonical Agent Registry boundary | IZAKHONO architecture/service owner | Named service owner; authoritative API and lifecycle boundary; ownership of agent IDs, tenant binding, versioning and deletion/retention | UNCONFIRMED |
| AW-OWN-002 | Registry persistence and migration authority | Database/platform owner | Authoritative datastore; tenant isolation; transaction/outbox design; approved migration runner; backup/restore and recovery evidence | UNCONFIRMED |
| AW-OWN-003 | Human principal issuer and session semantics | FORTRESS Identity owner | Deployed issuer/audience contract; key validation; tenant/role claim authority; session expiry/revocation evidence; separation from service identity | UNCONFIRMED |
| AW-OWN-004 | Service/workload identity profile | FORTRESS security/identity owner and consuming service owner | Jointly accepted issuer, audience, subject, token type, key custody/rotation, workload binding, replay protection and verifier test evidence | UNCONFIRMED |
| AW-OWN-005 | Agent-task authorization decision profile | FORTRESS policy owner and enforcement owner | Joint choice of online reference or signed artifact; canonical request fingerprint; policy/version binding; expiry; constraints; exact enforcement-point verification | UNCONFIRMED |
| AW-OWN-006 | Revocation and outage objectives | FORTRESS security/policy owner | Revocation sources; maximum detection delay; cache/clock-skew rules; outage behaviour; key compromise response; measured negative/recovery tests | UNCONFIRMED |
| AW-OWN-007 | Human approval and delegation | FORTRESS governance owner | Approver eligibility/delegation policy; separate human identity; fingerprint scope; expiry/revocation; immutable audit evidence | UNCONFIRMED |
| AW-OWN-008 | RuntimeBinding registration and health | Runtime Fabric owner | Authoritative registration schema; tenant/workload/environment binding; health TTL; revocation/isolation state; verified registration test | UNCONFIRMED |
| AW-OWN-009 | HOST execution identity and receipts | HOST/platform execution owner | Named execution environment and authorized runner; authenticated command interface; receipt signature/key profile; outcome and cancellation evidence | UNCONFIRMED |
| AW-OWN-010 | Atomic state and evidence persistence | Persistence/evidence service owner | Transaction/outbox semantics; idempotency scope and conflict handling; durability acknowledgement; retention; checkpoint; restore and replay tests | UNCONFIRMED |
| AW-OWN-011 | Provider capability and data-handling matrix | AI Gateway/provider integration owner with security/privacy owner | Per-provider verified capability matrix; data classes; retention/training terms; portability exclusions; failure and fallback behaviour | UNCONFIRMED |
| AW-OWN-012 | Independent assurance and evidence access | Security assurance/audit owner | Separation of operational and auditor roles; evidence immutability controls; signed checkpoints; retention and independent verification procedure | UNCONFIRMED |

## 4. Dependency gates

| Capability | Minimum accepted decisions | No-go condition |
|---|---|---|
| Durable Agent Registry | AW-OWN-001, 002 | No named service/persistence owner, no tenant boundary, no migration authority |
| Human operator actions | AW-OWN-003, 007 | Human session confused with service identity or approval; no revocation evidence |
| Consequential agent tool execution | AW-OWN-004, 005, 006, 008, 009 | Unverified service/workload identity, FORTRESS decision, runtime binding or HOST runner |
| Durable task/evidence lifecycle | AW-OWN-002, 010 | State can commit without required evidence, or evidence can be acknowledged without durable state |
| Provider portability and AgentSync | AW-OWN-011 plus Registry and security decisions | Secrets or prohibited tenant data included; provider capability assumed rather than verified |
| Independent assurance | AW-OWN-010, 012 | Operators can silently rewrite/delete evidence or auditor access is not independently controlled |

An accepted architecture decision does not by itself establish that a capability is implemented. Implementation and production readiness require separate code review, test evidence, operational controls and release authorization.

## 5. Acceptance record — copy once per decision

```yaml
decision_id: AW-OWN-XXX
decision_area:
accountable_owner:
owner_team:
authority_to_accept:
decision: UNCONFIRMED # ACCEPTED | REJECTED | DEFERRED
approved_contract:
contract_version:
decision_date:
review_or_expiry_date:
scope:
accepted_requirements: []
rejected_or_deferred_requirements: []
issuer_audience_subject: null
tenant_and_environment_scope: null
expiry_clock_skew_renewal: null
revocation_source_and_detection_objective: null
key_custody_rotation_compromise: null
outage_and_fail_closed_behaviour: null
data_classification_retention: null
enforcement_point: null
required_positive_tests: []
required_negative_and_recovery_tests: []
evidence_references: []
known_limitations: []
residual_risks:
  - owner:
    treatment:
    due_date:
separate_change_authorization: null
```

The record must be completed from owner-supplied information. Do not fabricate names, dates, approvals, evidence IDs, or deployment facts.

## 6. Current disposition

- All twelve decisions remain **UNCONFIRMED** in this initial register.
- No accountable individual or team has been assigned by this document.
- No production implementation gate is cleared by this register.
- The synthetic conformance harness in `tests/contracts/ai_workforce/` does not satisfy production acceptance evidence.
- PR #748 remains a draft architecture/contract review. This register does not authorize merge, migration, credentials, runtime activation, production writes or deployment.

## 7. Review sequence

1. IZAKHONO architecture owner confirms the service-boundary decision owners.
2. FORTRESS and each consuming enforcement owner jointly resolve identity, decision, approval and revocation contracts.
3. Runtime Fabric and HOST owners supply registration and execution-interface evidence.
4. Persistence/evidence owner accepts atomicity, idempotency, retention and recovery requirements.
5. Security assurance owner defines independent evidence verification.
6. Only after these decisions are accepted should implementation work be separately proposed, reviewed and authorized.
