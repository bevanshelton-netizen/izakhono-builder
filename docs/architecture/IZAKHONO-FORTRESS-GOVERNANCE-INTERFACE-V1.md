# IZAKHONO FORTRESS Governance Interface
## Version 1.0 — Identity, authority, policy and approval contract

- **Status:** Proposed architecture and interface specification; documentation only
- **Date:** 26 November 2026
- **Depends on:** [IZAKHONO Intelligent Operating Ecosystem Architecture V1](./IZAKHONO-INTELLIGENT-OPERATING-ECOSYSTEM-ARCHITECTURE-V1.md) and [IZAKHONO Shared Platform Contracts V1](./IZAKHONO-SHARED-PLATFORM-CONTRACTS-V1.md)
- **Authority:** Subject to owner review and approval. This document does not assert that FORTRESS is implemented, certified or production-ready. It does not authorise production changes, access grants, credential creation, infrastructure provisioning or expenditure.

---

## 1. Purpose

FORTRESS is the shared security and authority governance capability for the IZAKHONO ecosystem. It provides a consistent way to establish who or what is acting, determine what that actor may do, constrain the scope and duration of authority, obtain approvals for consequential actions, protect credentials, and preserve trustworthy audit evidence.

This document defines the proposed logical interface between FORTRESS and product domains, agents, services, operators and infrastructure control planes. It builds on the tenant, actor, policy-decision, approval, audit and runtime-binding concepts in the Shared Platform Contracts specification.

The objective is not to centralise every business permission or make FORTRESS the owner of every product record. Domain services remain responsible for their resources and business rules. FORTRESS supplies identity assurance, policy decisions, delegated authority controls, approval governance, secret-access authorisation and security audit contracts.

## 2. Scope and non-goals

### 2.1 In scope

- Human, service, agent and system principal identity contracts.
- Authentication context and trust establishment.
- Tenant membership and service identity scoping.
- Role, attribute, resource and relationship-based policy evaluation.
- Delegation and constrained agent authority.
- Policy decision and enforcement interfaces.
- Risk classification and exact-scope human approval.
- Credential and secret reference access governance.
- Revocation, expiry, suspension and emergency containment.
- Security event and audit evidence contracts.
- Failure semantics, conformance requirements and staged implementation.

### 2.2 Non-goals

FORTRESS V1 does not prescribe a specific identity vendor, policy engine, secrets vault, database, cryptographic algorithm, deployment topology or hosting provider. Those choices require separate evidence-based architecture decisions.

FORTRESS does not replace domain validation, application-level input validation, secure software development, endpoint protection, network controls, backup security or operational incident response. A policy permit is not proof that a request is safe, valid or successfully executed.

FORTRESS does not give agents unrestricted autonomy, allow agents to approve their own requests, or convert a user's identity into an unrestricted service credential.

## 3. Normative language and design principles

**MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** express requirement strength.

1. **Deny by default:** absent, ambiguous, expired or unverifiable authority results in denial.
2. **No ambient authority:** identity alone never grants access to every capability available to a process.
3. **Least privilege:** grants are restricted by tenant, actor, action, resource, purpose, environment and time as applicable.
4. **Separation of duties:** a requester cannot satisfy an approval requirement merely by being the requester; self-approval is prohibited for designated high-risk classes.
5. **Explicit delegation:** delegated authority is bounded and cannot exceed the authority of the delegator.
6. **Re-evaluation:** authority is checked at the enforcement point and rechecked when relevant state, scope or time changes.
7. **Evidence and accountability:** security decisions and consequential actions are correlatable and auditable.
8. **Secret minimisation:** secret values are never placed in ordinary events, prompts, logs, URLs or approval descriptions.
9. **Tenant isolation:** cross-tenant access is denied unless a distinct, explicit and auditable policy permits it.
10. **Provider independence:** FORTRESS owns the logical contracts and policy semantics; replaceable providers remain behind adapters.
11. **Human authority remains explicit:** approval is a controlled decision, not a blanket transfer of control to an agent.
12. **Safe failure:** dependency failures must not silently downgrade controls or create permissive fallback behaviour.

## 4. Logical architecture and trust boundaries

FORTRESS is a logical governance capability composed of separable responsibilities:

| Component | Responsibility |
|---|---|
| Identity Registry | Canonical principal records, lifecycle and identity relationships |
| Authentication Broker | Verifies presented authentication evidence through approved authenticators |
| Tenant and Membership Authority | Validates tenant membership, service grants and organisational scope |
| Policy Administration | Owns policy definitions, versions, status and controlled publication |
| Policy Decision Point (PDP) | Evaluates a request against identity, context, resource and policy |
| Policy Enforcement Point (PEP) | Blocks or permits the actual operation based on a current decision and obligations |
| Delegation Authority | Issues, constrains, expires and revokes delegated grants |
| Approval Service | Records human approvals bound to exact proposed actions |
| Secret Access Broker | Authorises and brokers access to protected credential references |
| Audit and Security Event Service | Records security decisions, lifecycle transitions and consequential actions |
| Risk and Incident Controls | Supports containment, suspension, emergency revocation and investigation |

These are logical boundaries, not a claim that eleven deployed services exist. A first implementation may combine components, provided the interfaces and authority boundaries remain explicit.

### 4.1 Trust flow

1. A caller presents an authenticated principal and request context.
2. The receiving service validates the authentication evidence and constructs trusted context; caller-supplied identity fields are not accepted as proof.
3. The service resolves tenant membership, actor type, resource ownership and request purpose.
4. The PDP evaluates the request against the active policy version and relevant attributes/relationships.
5. The PDP returns a bounded decision and obligations.
6. The PEP enforces the decision at the resource or action boundary.
7. If approval is required, the operation remains pending until the exact approval is verified and all conditions are still valid.
8. The domain service performs its own business validation and executes the operation.
9. Decision, approval, enforcement and execution outcomes are correlated in audit evidence.

A service MUST NOT treat a successful authentication as an authorisation decision. A service MUST NOT treat a PDP response as evidence that its PEP enforced the result.

## 5. Principal and identity model

### 5.1 Principal types

The initial principal vocabulary is:

| Principal type | Meaning | Typical lifecycle owner |
|---|---|---|
| `human` | A person using an IZAKHONO product or operating the platform | Identity administration / authorised organisation administrator |
| `service` | A workload or application component acting under a registered service identity | Service owner |
| `agent` | A governed AI agent with a distinct identity and bounded capabilities | Agent owner / AI Workforce governance |
| `system` | A narrowly defined platform process or scheduled system actor | Platform owner |

A principal is a security identity, not a username, email address, API key or machine. Authentication credentials are evidence used to establish control of a principal and MUST be stored and rotated separately.

### 5.2 Canonical principal record

Proposed logical representation:

```json
{
  "principal_id": "prn_example",
  "principal_type": "agent",
  "display_name": "SIGNAL Source Verification",
  "owner_ref": "owner_or_service_reference",
  "status": "active",
  "tenant_scope": ["tn_example"],
  "identity_version": 1,
  "created_at": "2026-11-26T05:00:00Z",
  "expires_at": null
}
```

All values are illustrative. The record MUST NOT contain passwords, private keys, bearer tokens or other secret values.

Required lifecycle states: `pending`, `active`, `suspended`, `revoked`, `expired`. Transitions MUST be authorised and auditable. A revoked identity MUST NOT be silently reactivated; reactivation, if permitted by policy, requires a distinct reviewed transition with evidence.

### 5.3 Identity assurance

Authentication mechanisms and assurance levels must be selected according to risk. The architecture SHOULD support stronger authentication for privileged human operations, including phishing-resistant multi-factor authentication where feasible.

Authentication evidence MUST include issuer/authenticator context, subject, audience, issued and expiry times, relevant assurance information and integrity validation. Tokens MUST be audience-restricted, short-lived where practical and validated for issuer, signature/integrity, expiry, not-before and intended audience.

A caller-provided `actor_id`, `principal_id`, `tenant_id`, role or email address is an untrusted claim until verified against authenticated evidence and authoritative membership data.

### 5.4 Human identity lifecycle

Human onboarding, role changes, suspension and offboarding MUST have an authorised owner and recorded reason. Access MUST be removed or adjusted promptly when employment, organisational membership or responsibility changes. Dormant privileged accounts SHOULD be reviewed and disabled under a documented policy.

Recovery processes MUST resist account takeover. Recovery MUST NOT bypass stronger authentication or approval requirements for privileged actions.

### 5.5 Service and agent identity lifecycle

Every service and agent principal MUST have a named accountable owner, documented purpose, permitted tenant scope, approved tool/capability profile, expiry or review interval, and revocation path.

Credentials MUST be unique to the workload or agent where practical. Shared human credentials MUST NOT be used as service identities. Agent identities MUST be distinct from the initiating human and from other agents.

## 6. Tenant, resource and purpose context

Every tenant-scoped request MUST resolve:

- authenticated `principal_id` and actor identity;
- `tenant_id` and verified membership or service grant;
- action and resource type/identifier;
- resource owner domain and tenant ownership;
- declared purpose from a controlled vocabulary;
- environment and request origin;
- correlation and causation identifiers;
- relevant data classification and risk context.

Tenant identifiers supplied by callers are selectors only. FORTRESS or the authoritative membership service MUST verify them. A resource ID is not a capability and MUST NOT grant access by possession.

Cross-tenant support or platform administration MUST use a distinct policy path with explicit scope, reason, time bound and audit record. Broad standing cross-tenant access SHOULD be avoided. Support access SHOULD be time-limited and attributable to an individual operator.

Purpose limitation is enforceable context, not a free-text justification. Purpose values MUST be registered and mapped to allowed processing and data access. A purpose mismatch MUST deny the request.

## 7. Authorisation model

### 7.1 Combined policy model

FORTRESS SHOULD use a policy model capable of combining:

- **RBAC:** roles express stable job or service responsibilities.
- **ABAC:** attributes express context such as tenant, environment, classification, time, assurance and risk.
- **Relationship-based checks:** relationships express ownership, membership, assignment, delegation and resource relationships.

No one model is sufficient for all decisions. Roles MUST NOT become unrestricted bundles of permissions. Attribute and relationship checks MUST be evaluated against authoritative, current data.

### 7.2 Permission vocabulary

A permission is a structured capability, not an informal role label. Its logical scope includes:

```json
{
  "action": "experience.case.resolve",
  "resource_type": "experience.case",
  "tenant_id": "tn_example",
  "purpose": "support.case_resolution",
  "environment": "production"
}
```

Policy evaluation MUST consider the exact action, resource, tenant, purpose and environment. Additional constraints may include resource owner, classification, record state, time window, geographic/legal boundary, authentication assurance, delegated grant and approval status.

Wildcard permissions SHOULD be restricted to tightly governed administrative policy and MUST NOT be used as a shortcut for product integration.

### 7.3 Decision interface

Proposed request:

```json
{
  "authorization_request_id": "authreq_example",
  "principal_id": "prn_example",
  "actor": {
    "actor_type": "agent",
    "actor_id": "agt_example",
    "on_behalf_of": "usr_example"
  },
  "tenant_id": "tn_example",
  "action": "experience.case.resolve",
  "resource": {
    "resource_type": "experience.case",
    "resource_id": "case_example",
    "owner_domain": "experience"
  },
  "purpose": "support.case_resolution",
  "environment": "production",
  "context": {
    "correlation_id": "cor_example",
    "requested_at": "2026-11-26T05:00:00Z"
  }
}
```

Proposed response:

```json
{
  "decision_id": "pdec_example",
  "decision": "deny",
  "reason_code": "approval_required",
  "policy_id": "pol_experience_case_resolution",
  "policy_version": "4",
  "evaluated_at": "2026-11-26T05:00:00Z",
  "expires_at": null,
  "approval_id": "apr_example",
  "obligations": [],
  "audit_ref": "aud_example"
}
```

The response is illustrative and consistent with the Shared Platform Contracts decision shape. It is not a deployed endpoint or executable schema.

### 7.4 Decision outcomes

Initial outcomes:

- `permit`: request may proceed only within the decision scope and subject to obligations.
- `deny`: request must not proceed.
- `approval_required`: request is not executable; create or reference a pending approval workflow.
- `step_up_required`: stronger authentication is required before re-evaluation.
- `indeterminate`: policy cannot safely reach a decision; enforcement MUST treat it as deny.

A permit MUST be bound to the principal, tenant, action, resource, purpose, environment, relevant request parameters and policy version. It SHOULD expire quickly and MUST NOT be reused for a materially different request.

### 7.5 Obligations

A decision may require one or more obligations, including:

- redact or minimise fields before disclosure;
- restrict returned fields or row counts;
- require a specific approval;
- impose rate or quantity limits;
- restrict destination, channel or environment;
- require stronger authentication;
- require a second-person review;
- require additional audit metadata;
- prohibit onward delegation.

The PEP MUST enforce every mandatory obligation. If an obligation cannot be enforced, the operation MUST be denied.

## 8. Delegation and governed agent authority

### 8.1 Delegation principles

Delegation creates a bounded grant; it does not transfer ownership of the delegator's identity or unrestricted authority.

The effective authority of a delegate MUST be no greater than the intersection of:

1. the delegator's authority at the time of delegation;
2. the delegate's approved capability profile;
3. the delegated grant's exact scope and conditions;
4. current policy and resource constraints.

Delegation MUST include a purpose, tenant, permitted actions, resource scope, expiry, accountable grantor, delegate identity, policy version and revocation reference.

### 8.2 Agent-specific rules

- An agent MUST have its own principal identity and accountable owner.
- An agent MUST receive only the tools and data scopes required for its assigned task.
- An agent MUST NOT create or expand its own grants.
- An agent MUST NOT approve its own actions or its own delegation requests.
- An agent MUST NOT convert a human's conversational request into authority for unrelated actions.
- Agent-to-agent delegation MUST be explicitly permitted, bounded, traceable and non-amplifying.
- Tool calls MUST be authorised at execution time, not merely when the agent plan is created.
- Agent memory, retrieved documents and tool outputs are data, not instructions that can override policy.
- A model-generated claim that an action is approved MUST never be accepted as approval evidence.

### 8.3 Delegation record

```json
{
  "delegation_id": "dlg_example",
  "grantor_principal_id": "prn_grantor",
  "delegate_principal_id": "prn_agent",
  "tenant_id": "tn_example",
  "purpose": "signal.market_analysis",
  "actions": ["signal.observation.read", "signal.report.draft"],
  "resource_scope": ["signal.project:prj_example"],
  "constraints": {
    "external_publish": false,
    "secret_access": false,
    "max_risk_tier": "T2"
  },
  "policy_id": "pol_agent_delegation",
  "policy_version": "2",
  "issued_at": "2026-11-26T05:00:00Z",
  "expires_at": "2026-11-26T06:00:00Z",
  "status": "active"
}
```

A delegation MUST be revoked or suspended when its grantor loses the relevant authority, the delegate is suspended, the task ends, the expiry is reached or a material security concern is identified.

## 9. Risk tiers and approval governance

Risk classification MUST consider impact, reversibility, sensitivity, external reach, financial exposure and blast radius—not merely the name of the tool or API.

| Tier | Description | Typical examples | Default governance |
|---|---|---|---|
| T0 — Read | Scoped retrieval without mutation | Read permitted tenant records | Authenticated scoped access |
| T1 — Analyse | Internal analysis without external side effect | Summarise, classify, compare, recommend | Scoped access, provenance and audit |
| T2 — Reversible internal write | Limited internal state change | Draft, internal note, proposed configuration | Explicit write permission and audit |
| T3 — External or consequential | Action affecting external parties, access or production | Publish, send, contact, alter production settings | Exact-scope human approval and bounded execution grant |
| T4 — High-impact or destructive | Material financial, legal, security or irreversible impact | Spend, transfer, delete critical data, destructive migration, credential rotation affecting services | Named authorised approver, strong confirmation, separation of duties and independent safeguards |

The policy owner MUST define the risk mapping for each action. A human approval does not legalise an otherwise prohibited action or replace domain, legal or safety controls.

### 9.1 Approval request

A pending approval MUST identify:

- exact proposed action and version;
- tenant, principal, requester and accountable owner;
- exact resources and affected parties;
- complete material parameters (including amount, destination, environment and scope where relevant);
- purpose, rationale and supporting evidence;
- risk tier and policy ID/version;
- required approver class and separation-of-duties rule;
- expiry, conditions and execution constraints;
- consequences and reversibility;
- correlation ID and audit reference.

### 9.2 Approval decision and binding

Approval MUST bind to the exact action and material parameters reviewed. Changing the target, amount, destination, environment, resource, permissions, content, timing window or material scope MUST invalidate the approval or require re-approval.

Approvals MUST be attributable to an authenticated authorised human (or a specifically authorised non-human authority where a separately approved policy permits it), time-limited, single-purpose and non-transferable.

The requester MUST NOT self-approve T4 actions. For designated T3/T4 operations, the same principal MUST NOT request, approve and execute the operation without a documented independent-control exception. Approval interfaces MUST show the actual action and its material parameters, not a vague summary generated by an agent.

### 9.3 Approval lifecycle

Proposed states: `draft`, `pending`, `approved`, `rejected`, `expired`, `cancelled`, `consumed`, `invalidated`.

An approval may be consumed only once unless policy explicitly defines safe repeat semantics. Execution MUST verify approval status, expiry, approver authority, action hash or equivalent canonical parameter binding, policy version and outstanding obligations immediately before execution.

An approval MUST NOT be treated as a general-purpose bearer token. The implementation should use an opaque approval reference with server-side verification and narrowly scoped execution binding.

## 10. Secrets and credential access interface

### 10.1 Separation of metadata and secret material

FORTRESS governs access to secret references and the authorised retrieval/use of secret material. Secret values MUST be held in a dedicated protected secret-management facility selected through a separate architecture decision.

Application databases, event streams, logs, analytics stores, prompts, source control and approval records MUST NOT store raw secret values.

A secret reference may expose non-sensitive metadata such as identifier, owning service, purpose, classification, version reference, status and rotation policy. It MUST NOT reveal the secret value.

### 10.2 Secret access request

A request to use a secret MUST identify the authenticated workload principal, tenant, secret reference, purpose, target service/resource, environment, operation (read/use/rotate/revoke), and correlation context.

FORTRESS MUST verify:
- the principal is active and is the intended workload;
- the secret is active and belongs to the expected owner/scope;
- the requested operation and purpose are permitted;
- tenant and environment match;
- delegation, if present, allows this exact access;
- rotation/revocation state does not prohibit use;
- policy obligations can be enforced.

Where feasible, use short-lived, audience-bound credentials or brokered secret use instead of returning reusable long-lived secret values to callers. Secret access MUST be logged without recording the secret itself.

### 10.3 Rotation and emergency revocation

Secret rotation MUST support version overlap only for a defined migration window and MUST record the old/new version references and affected workloads without recording secret values.

Emergency revocation MUST block new use promptly and trigger a documented impact/recovery workflow. Revocation of a secret does not automatically prove that copies, caches or downstream credentials have been eliminated; remediation evidence is required.

No secrets, keys, tokens or credentials are to be created or changed as part of this documentation work.

## 11. Policy lifecycle and change control

Policies MUST have an accountable owner, unique ID, version, purpose, scope, status, effective period, review date, test evidence and change history.

Proposed lifecycle: `draft` → `validated` → `approved` → `active` → `superseded` or `retired`. A policy MUST NOT become active merely because it was committed to source control.

Policy changes SHOULD follow:
1. author and document the proposed change;
2. run schema, unit, regression and negative security tests;
3. compare decisions against representative existing requests;
4. review impact, exceptions, tenant boundaries and failure behaviour;
5. obtain approval from the designated policy owner;
6. publish an immutable version through a controlled release path;
7. verify active version and decision telemetry;
8. retain rollback or safe-disable procedure.

Emergency policy changes require a separately governed emergency path, explicit actor attribution, limited duration and retrospective review.

A policy rollback MUST NOT silently restore revoked credentials, expired approvals or previously revoked identities.

## 12. Revocation, expiry and emergency containment

Revocation is a first-class security operation. The system MUST support revocation or suspension of:
- human and non-human principals;
- credentials and sessions;
- tenant memberships and service grants;
- delegated authority;
- approvals not yet consumed;
- policy versions and enforcement caches;
- secret references and secret versions;
- runtime or infrastructure bindings where they are security-relevant.

Revocation propagation targets and maximum delay MUST be specified for each implementation. High-risk credentials and grants SHOULD use short lifetimes to reduce reliance on propagation alone.

Emergency containment SHOULD support a scoped kill switch for a principal, agent, service, tenant integration or capability. A kill switch MUST be independently authorised, auditable, observable and tested. It MUST NOT depend exclusively on the component being contained.

## 13. Audit and security event contract

### 13.1 Required events

At minimum, implementations MUST be able to record:
- authentication success/failure and step-up challenges;
- principal creation, update, suspension, revocation and recovery;
- tenant membership and service-grant changes;
- policy publication, activation, retirement and rollback;
- authorisation permit, deny, indeterminate and approval-required decisions;
- approval request, decision, invalidation, expiry and consumption;
- delegation issue, use, expiry and revocation;
- secret access, denial, rotation and revocation;
- privileged configuration and administrative actions;
- enforcement failure, audit pipeline failure and emergency containment;
- consequential operation attempt and verified outcome.

### 13.2 Audit fields

Security audit records SHOULD include:
- audit ID and event type/version;
- tenant and data classification;
- actor, principal and delegation chain;
- action, resource and purpose;
- decision, policy ID/version and obligations;
- approval and approver references where relevant;
- timestamp, source service/version and environment;
- correlation and causation IDs;
- outcome and reason code;
- minimal change metadata or protected evidence reference;
- integrity metadata and retention classification.

Audit records MUST NOT contain credentials, secret values, private keys, raw authentication tokens or unnecessary sensitive personal data. Audit access MUST itself be authorised and audited.

Audit storage design MUST define tamper resistance, time synchronisation, integrity verification, retention, export, legal hold, deletion handling and restricted administrative access. Append-oriented records do not override applicable lawful retention and deletion obligations.

### 13.3 Audit pipeline failure

For high-risk operations, inability to produce the required audit evidence MUST block execution. For lower-risk operations, any buffering or deferred audit mode must be explicitly risk-assessed, bounded, durable and detectable. Silent loss of security audit events is prohibited.

## 14. Enforcement and integration requirements

Every product domain and platform service integrating with FORTRESS MUST:
1. authenticate the caller and validate the intended audience;
2. establish trusted tenant and actor context;
3. resolve authoritative resource ownership and classification;
4. request a decision for the exact operation;
5. enforce permit/deny and every obligation at the point of action;
6. verify approval and delegation at execution time where required;
7. perform domain-specific validation and concurrency checks;
8. record action outcome and correlate it to the decision;
9. handle revocation, expiry and policy changes;
10. fail closed when authority cannot be verified.

A product MUST NOT rely solely on front-end visibility controls. APIs, background workers, scheduled jobs, internal service calls and agent tools MUST enforce the same authority model.

### 14.1 Integration boundaries

| Consumer | FORTRESS responsibility | Consumer responsibility |
|---|---|---|
| SIGNAL | Scope data access, connector credentials, report publication and agent delegation | Validate source terms/licences, evidence quality and domain semantics |
| EXPERIENCE | Protect feedback, employee/customer records, case access and escalation actions | Own case lifecycle, survey rules, resolution validity and privacy notices |
| AI WORKFORCE | Agent identity, tool grants, delegation, approval and audit | Task planning, tool schemas, evidence and outcome verification |
| CODE | Authorise repository/workspace operations, dependency actions and release approvals | Validate code, tests, repository rules and engineering safety |
| INFRASTRUCTURE / HOST | Govern operator/service access, provisioning authority and protected infrastructure references | Execute approved infrastructure lifecycle and verify substrate state |
| MULTI-EDGE | Govern routing changes, certificates, provider credentials and production actions | Validate traffic, routing, availability and delivery outcomes |
| J.A.R.V.I.S. / CONNECTA | Govern user/service actions and data access | Enforce application workflow and domain rules |
| Runtime Fabric | Authorise runtime lifecycle operations and binding changes | Verify execution environment and runtime binding evidence |

### 14.2 NODE01 and execution substrate separation

**NODE01 IS SOFTWARE. NODE01 IS NOT A MACHINE.**

FORTRESS may authorise a software runtime identity or a Runtime Fabric operation, but it MUST NOT conflate NODE01 with a physical, virtual or container execution environment. Infrastructure identities, execution-environment identifiers, operator credentials and runtime software identities remain separate principals/resources with explicit bindings and scopes.

A permission to invoke NODE01 software capability does not automatically grant infrastructure administration. A permission to manage an execution environment does not automatically grant application-level authority inside NODE01. Runtime binding verification remains a separate precondition governed through the shared runtime contract.

## 15. Failure semantics and safe degradation

| Condition | Required behaviour |
|---|---|
| Authentication invalid or expired | Reject; do not infer identity |
| Tenant membership missing or stale | Deny tenant-scoped request |
| PDP unavailable or times out | Treat as indeterminate/deny for protected operations |
| Policy missing, malformed or inactive | Deny |
| Resource ownership cannot be verified | Deny or return non-disclosing not-found |
| Approval missing, expired or mismatched | Do not execute |
| Delegation expired or revoked | Deny delegated action |
| Secret broker unavailable | Do not expose cached or fallback secret outside approved policy |
| Revocation status cannot be checked | Apply documented short-lived grant policy; high-risk actions deny |
| Audit unavailable | Block high-risk action; lower-risk buffering only under approved bounded policy |
| Obligation unsupported by PEP | Deny |
| Clock skew invalidates token/approval | Reject and raise diagnostic event |
| Policy cache version stale | Refresh or deny according to bounded consistency policy |

No emergency or availability mode may silently disable authentication, authorisation, approval, tenant isolation or audit requirements.

## 16. Privacy, data protection and governance

FORTRESS must support privacy-by-design and applicable legal obligations, including POPIA where relevant. This specification is not a legal compliance certification.

Identity and audit data MUST be minimised, purpose-limited, access-controlled and retained according to an approved schedule. Sensitive personal data SHOULD be excluded from policy attributes unless strictly necessary and lawfully justified. Policy decisions should use stable references and coarse-grained attributes where possible.

The implementation MUST define:
- data controller/operator responsibilities and relevant agreements;
- lawful purpose and notice for identity and security telemetry;
- retention and deletion schedules;
- data-subject request handling where applicable;
- privileged access monitoring;
- cross-border processing and provider review;
- breach and incident escalation;
- separation of customer, employee and platform-operator records.

## 17. Conformance and security test catalogue

An implementation claiming FORTRESS interface conformance MUST pass automated positive, negative, boundary and failure tests.

### 17.1 Identity and tenant tests

- Reject forged or caller-supplied principal identity.
- Reject expired, wrong-issuer and wrong-audience authentication evidence.
- Reject suspended, revoked and expired principals.
- Reject tenant ID substitution and cross-tenant resource access.
- Reject a service identity outside its registered tenant/environment scope.
- Verify offboarding and membership removal invalidate subsequent access within the documented revocation target.

### 17.2 Policy and enforcement tests

- Missing policy, PDP timeout and malformed context produce deny.
- Permit is bound to exact action, resource, tenant and purpose.
- PEP rejects expired, altered or replayed decision context.
- Obligations are enforced, not merely returned to the caller.
- Role membership alone cannot bypass resource ownership or classification.
- A policy version change invalidates decisions where required.
- API, worker, scheduler and agent tool paths enforce equivalent policy.

### 17.3 Delegation and approval tests

- Delegate cannot exceed grantor authority.
- Delegation expires and revokes as specified.
- Agent cannot self-grant, self-approve or elevate another agent.
- Approval cannot be reused for altered amount, destination, resource, environment or action.
- Requester cannot self-approve prohibited risk classes.
- Approval expiry, invalidation and one-time consumption are enforced.
- A model-generated statement of approval is rejected as authority evidence.

### 17.4 Secrets and audit tests

- Secret values never appear in logs, events, prompts, audit records or error responses.
- Unauthorised secret reference access is denied.
- Revoked secret references cannot be newly used.
- Audit records identify actor, policy, approval and outcome without secret leakage.
- High-risk actions fail when required audit persistence is unavailable.
- Audit access is separately authorised and recorded.
- Tampering, deletion and clock-skew detection are tested against the selected implementation.

### 17.5 Required test evidence

Each test result SHOULD retain test ID, test suite/version, environment, policy version, input fixture reference, expected result, actual result, timestamp and execution evidence. Test fixtures MUST use synthetic identities and data; production credentials MUST NOT be embedded in test fixtures.

## 18. Operational metrics and review

The implementation SHOULD expose security metrics that do not leak sensitive values:

- authentication success/failure and step-up rates;
- authorisation permit/deny/indeterminate rates by service and reason;
- policy evaluation latency and availability;
- approval queue age, expiry, rejection and invalidation rates;
- delegation counts, age and revocation latency;
- secret access denials, rotation status and revocation latency;
- privileged action volume and exception usage;
- audit delivery delay, integrity failures and retention health;
- cross-tenant denial attempts and policy violations;
- agent tool-denial, escalation and attempted scope-expansion rates.

Metrics must be interpreted with context. A low denial rate is not inherently evidence of strong security; it may indicate over-permissive policy or inadequate detection. Review policy exceptions and privileged grants periodically.

## 19. Implementation sequence and release gates

This is a proposed, evidence-gated sequence. It does not authorise implementation or spending.

| Phase | Work package | Exit evidence |
|---|---|---|
| 0 — Discovery | Inventory existing identity, auth, roles, secrets, audit and policy code; map owners and gaps | Verified current-state inventory and non-duplication plan |
| 1 — Contract | Approve principal, context, decision, delegation, approval and audit schemas | Versioned schemas, ADRs and contract tests |
| 2 — Identity foundation | Implement principal lifecycle and authentication adapters | Verified identity lifecycle, negative tests and recovery controls |
| 3 — Policy foundation | Implement policy administration, PDP and PEP integration | Deny-by-default tests, tenant isolation and decision evidence |
| 4 — Approval and delegation | Implement exact-scope approval and constrained grants | Replay/tampering/expiry/self-approval tests |
| 5 — Secrets and audit | Integrate protected secret broker and durable security audit | Secret-leak tests, revocation evidence and audit integrity controls |
| 6 — Domain adoption | Integrate one low-risk domain path, then expand incrementally | Domain conformance evidence and rollback readiness |
| 7 — Operational assurance | Incident exercises, access reviews, monitoring and independent security assessment | Approved operational runbooks and documented assurance results |

No phase is considered complete from documentation or a successful build alone. Production readiness requires verified deployment, access controls, recovery, monitoring, operational ownership and security testing.

## 20. Architecture decisions required

The following ADRs remain open and MUST be resolved with evidence before implementation choices become binding:

1. **ADR-FORTRESS-001 — Identity authority:** authoritative principal registry and identity lifecycle ownership.
2. **ADR-FORTRESS-002 — Authentication and assurance:** supported authenticators, session/token model and privileged authentication.
3. **ADR-FORTRESS-003 — Policy engine:** policy language, evaluation engine, distribution and version consistency.
4. **ADR-FORTRESS-004 — Authoritative attributes:** source of truth for tenant membership, resource ownership, classification and relationships.
5. **ADR-FORTRESS-005 — Approval workflow:** approver authority, notifications, immutable action binding and consumption semantics.
6. **ADR-FORTRESS-006 — Delegation model:** grant representation, attenuation, revocation and agent-to-agent constraints.
7. **ADR-FORTRESS-007 — Secrets facility:** protected storage, brokered access, rotation and emergency revocation.
8. **ADR-FORTRESS-008 — Audit integrity and retention:** storage, tamper evidence, export, legal hold and deletion.
9. **ADR-FORTRESS-009 — Revocation consistency:** propagation targets, cache invalidation and offline behaviour.
10. **ADR-FORTRESS-010 — Privileged operations:** break-glass criteria, separation of duties and retrospective review.
11. **ADR-FORTRESS-011 — Privacy and jurisdiction:** retention, lawful processing, cross-border and data-subject requirements.
12. **ADR-FORTRESS-012 — Existing implementation alignment:** verified inventory and incremental adoption plan that preserves working systems.

## 21. Readiness and explicit boundaries

This document establishes a proposed governance interface only.

It does not establish that:
- a central identity registry or policy engine exists;
- FORTRESS authentication or authorisation endpoints are deployed;
- a secrets vault or secret broker is connected;
- approvals are enforced by production services;
- audit storage is tamper-resistant or operational;
- every product domain is integrated;
- any compliance certification or independent security assessment has been achieved.

Before implementation, inspect the repository and deployed systems for existing authentication, authorisation, permissions, credentials, audit and policy mechanisms. Preserve working implementations where they meet the approved contracts. Any migration or replacement must include compatibility, rollback and data-protection planning.

No credentials, permissions, access grants, production policies, infrastructure resources or paid services are changed or created by this specification.

## 22. Acceptance checklist

- [ ] Owner approves the FORTRESS governance boundary and this contract.
- [ ] Existing identity, security, policy and audit implementations have been inventoried.
- [ ] Principal and tenant context schemas are versioned and validated.
- [ ] PDP/PEP responsibilities and fail-closed semantics are tested.
- [ ] RBAC, ABAC and relationship checks have authoritative data sources.
- [ ] Delegation cannot amplify authority and can be promptly revoked.
- [ ] Approval is bound to exact action parameters and protected from replay.
- [ ] Secrets are isolated from ordinary application and audit data.
- [ ] Revocation, expiry, incident containment and audit failure paths are tested.
- [ ] Product-domain integrations pass conformance and tenant-isolation tests.
- [ ] Operational ownership, runbooks, monitoring and independent review are established.

---

**End of specification.**
