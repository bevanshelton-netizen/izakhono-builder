# IZAKHONO FORTRESS Entity Isolation and Trust Boundary
## Version 1.0 — Tenant, principal, resource and action binding

- **Status:** Proposed security contract and conformance specification; not a deployed identity or tenant-isolation service.
- **Date:** 26 November 2026
- **Depends on:** IZAKHONO Shared Platform Contracts V1; FORTRESS Governance Interface V1.
- **Related implementation review:** PR #751 (scoped DEPLOY capabilities), PR #724 (DEPLOY enforcement/control plane), PR #778 (egress guard hardening).
- **Authority:** Subject to owner review. This document does not authorise production access grants, migrations, deployments, infrastructure provisioning or expenditure.

---

## 1. Objective

Establish an enforceable boundary between every IZAKHONO company, tenant, product, customer, human, service and AI agent. A caller-provided tenant or entity identifier is a resource selector, never proof of authority.

The target security decision answers all of these questions before access is granted:

1. Who is acting, and how was that principal authenticated?
2. Which tenant is the authenticated principal authorised to act within?
3. Which entity, application, environment and resource are being accessed?
4. Which exact action is requested, and for what controlled purpose?
5. Is the membership, service grant or delegation active and sufficient?
6. Does the resource's authoritative owner agree with the requested tenant and domain?
7. Are any required approvals present, valid, exact-scope and independently authorised?
8. Is the grant still valid at the enforcement point, including revocation and expiry?

If any required answer is missing, ambiguous, stale, contradictory or unverifiable, the decision is deny.

## 2. Current implementation evidence and non-duplication

This contract is additive. It does not replace existing FORTRESS or DEPLOY work.

### 2.1 Existing work to preserve and integrate

- **PR #751 — FORTRESS scoped DEPLOY capabilities:** its described implementation issues five-minute DEPLOY capabilities bound to the current tenant, one application, one environment and explicit scopes; introspection checks signature, audience, expiry, capability registry, parent session, principal, tenant, resource IDs, scopes and revocation. OWNER and SECURITY_ADMIN privilege boundaries are described. This is a DEPLOY-specific capability, not proof of a general-purpose tenant membership registry for every IZAKHONO product.
- **PR #724 — DEPLOY control plane:** its described enforcement path verifies FORTRESS capabilities and enforces tenant/application/environment scope at the deployment boundary. Preserve its transaction and audit coupling.
- **PR #778 — egress guard hardening:** adds robustness to the narrow egress policy decision point. Its `entity_id` remains a required scope marker, not proof of entity membership, resource ownership or identity.
- **PR #776 — FORTRESS governance interface:** specifies the wider principal, policy, delegation, approval, secrets and audit contracts. It is an unmerged proposed specification, not a production identity authority.
- **PR #774 — shared platform contracts:** defines tenant, actor, resource, event and audit context as proposed shared contracts.

These pull requests are separate review branches. Their descriptions and branch content do not prove that their changes are merged, integrated together or deployed. Before implementation, re-fetch their current heads, inspect the actual files and tests, and reconcile the integration graph. Do not create a second token issuer or parallel identity database when the existing FORTRESS capability/session authority can be extended safely.

### 2.2 What this work does not claim

This specification does not claim that a universal tenant registry, resource ownership registry, cross-tenant policy engine, domain-wide PEP rollout or row-level database enforcement already exists. It does not turn an egress check or DEPLOY token into universal application authorisation.

## 3. Canonical trust model

### 3.1 Separate identity, membership, ownership and permission

These are four different facts and must have separate authoritative sources:

- **Identity:** the principal is who the authentication system says it is, based on verified credentials/session.
- **Membership or service grant:** the principal is an active member/service identity for the tenant and has a defined relationship or role.
- **Resource ownership:** the resource-owning domain confirms the resource exists and belongs to the requested tenant/entity.
- **Permission:** FORTRESS policy confirms that this principal may perform this action on this resource for this purpose under the applicable conditions.

No one fact implies the others. A valid user session does not imply tenant membership. Membership does not imply ownership of every resource. Ownership does not grant every action. A role name supplied by a caller grants nothing.

### 3.2 Trusted principal context

A trusted principal context is created only after successful authentication by an approved FORTRESS authentication/session verifier. It is server-side verified context, not a JSON object that a client may author.

Required claims:

- `principal_id`: stable opaque principal identifier.
- `actor_type`: `user`, `service`, `agent` or `system`.
- `actor_id`: stable actor identifier.
- `issuer` and `audience`: expected, registered values.
- `session_id` or `capability_id`: revocable credential/session reference.
- `issued_at`, `not_before`, `expires_at`: validated time bounds.
- `authentication_strength`: controlled assurance level from the authentication authority.
- `credential_status`: active and not revoked at decision time.

Client-supplied `principal_id`, actor type, roles, membership lists, tenant lists, approval booleans, issuer, audience, expiry or authentication strength MUST NOT be trusted. These values must be derived from verified server-side session/capability state.

### 3.3 Tenant membership and service identity

Membership records are authoritative and lifecycle-managed. A membership binds principal to tenant, state, role/relationship and (where needed) an explicit permission set or policy attributes. Suspended, expired, pending, revoked or deleted memberships deny access.

Service and agent identities are first-class principals. A service MUST have an explicit tenant-bound service grant or a separately governed system scope. A background task MUST preserve the initiating tenant and actor context or carry an explicit, limited delegation. A process-wide credential must not silently confer access to every tenant.

### 3.4 Resource ownership

The resource-owning domain is authoritative for resource identity, type, tenant, owning entity and lifecycle state. FORTRESS asks that domain or a trusted ownership index for the authoritative relationship; it does not infer ownership from resource ID prefixes, URLs, database table names or caller-supplied metadata.

A resource reference includes:

- `resource_type`
- `resource_id`
- `owner_domain`
- `tenant_id`
- `entity_id` when the domain models a distinct legal/business entity
- `environment` where the resource is environment-scoped
- `resource_state`

If the authoritative resource lookup is unavailable, the access decision fails closed. The response must not reveal whether a foreign tenant's resource exists.

## 4. Decision request and evaluation order

The machine-readable request schema is in `schemas/security/fortress-entity-access-context-v1.schema.json`. It describes the proposed shape; schema validity alone is not authentication.

The enforcement point constructs the request from verified context plus the operation being attempted. It MUST NOT accept a client-supplied `trusted_principal` object as proof.

Required decision attributes:

- trusted principal reference;
- selected tenant and entity context;
- resource reference;
- exact action (controlled vocabulary);
- controlled purpose;
- environment;
- correlation ID;
- optional delegation and approval references.

Evaluation order:

1. Authenticate the credential and verify issuer, audience, signature/integrity, time bounds and revocation.
2. Resolve the active principal and actor record from the authoritative identity authority.
3. Resolve active tenant membership or service grant for the selected tenant.
4. Resolve the resource through its owning domain and verify tenant/entity ownership.
5. Verify environment and resource lifecycle constraints.
6. Evaluate action and purpose against policy using roles, attributes and relationships.
7. Verify delegation chain, if present: every link active, bounded, non-escalating and within expiry.
8. Verify required approval, if present: exact action/resource/tenant/environment/parameters, independent approver, expiry, one-time use and non-revocation.
9. Produce a decision with policy version, obligations, expiry and correlation reference.
10. Enforce at the product's policy enforcement point immediately before the protected operation. Re-check for long-running or high-impact operations and bind the decision to the exact operation parameters.

Any failure, timeout, missing record, malformed claim or policy conflict returns deny. No stale allow cache may outlive the underlying membership, capability, resource or policy validity.

## 5. Cross-tenant access

Cross-tenant access is denied by default. It is never achieved by changing a request's `tenant_id`.

A legitimate cross-tenant workflow requires a distinct explicit grant that records:

- source and target tenant;
- initiating principal and actor;
- exact resource(s) or resource class;
- exact action(s) and purpose;
- business/legal basis and human-readable reason;
- allowed fields/data classes where applicable;
- start and expiry time;
- approving principal(s), where required;
- revocation state and audit correlation.

The policy engine must distinguish support access, delegated service access, shared-resource access and emergency access. These are not interchangeable. Emergency access is time-limited, separately approved where feasible, fully audited and reviewed after use. It must not become a standing bypass.

## 6. AI agents and delegated authority

An AI agent has its own principal identity and cannot borrow the human's session as unrestricted authority.

- The initiating human remains recorded as the delegator.
- The agent has a distinct principal and actor identity.
- The task grant is restricted to a specific tenant, task, resource set, action set, purpose and expiry.
- The agent's effective authority is the intersection of its own policy, the delegator's permitted authority, the task grant and domain policy.
- Agents cannot approve their own actions, widen their own scope, mint broader credentials or self-assert an approval.
- Tool calls re-check authority at the tool's enforcement point.
- Human approval is required for policy-designated consequential actions and must bind exact parameters.
- Revoking the parent session, task grant, agent identity or tenant membership invalidates dependent delegated capabilities.

A caller-supplied `approved: true`, `is_admin: true`, `tenant_ids: [...]` or equivalent boolean/list is never evidence of authority.

## 7. Data and database isolation

Every tenant-scoped read, write, export, search, cache lookup, object-storage operation, queue message and background job must preserve the verified tenant scope.

Minimum controls:

- Scope database queries by authoritative tenant and resource ownership, not by client filters alone.
- Use database row-level security or equivalent database-enforced isolation where supported; the runtime role must not bypass the policy.
- Prevent cross-tenant joins, aggregate leakage, search-index leakage and cache-key collisions.
- Bind object-storage keys and signed URLs to tenant/resource scope, expiry and operation.
- Include tenant and actor context in queue/job envelopes; consumers revalidate authority rather than trusting the producer's claims.
- Apply tenant scope to backups, exports, analytics, logs and support tooling.
- Do not expose existence, counts, timing distinctions or metadata of another tenant's private resources through denial responses.
- Use transactionally consistent ownership and authorisation checks for writes to avoid time-of-check/time-of-use races.
- A privileged system-wide operation must use a separately named system authority and audited policy, not an empty or wildcard tenant.

## 8. Decision and audit contract

A decision record should include:

- decision ID and correlation ID;
- principal/actor reference (not raw credentials);
- tenant/entity and resource references;
- action and purpose;
- permit/deny outcome and stable reason code;
- policy ID/version;
- membership/grant and ownership evidence references;
- delegation/approval references where applicable;
- evaluated-at and decision expiry;
- enforcement point and service version.

Do not put bearer tokens, passwords, private keys, full session secrets or unnecessary personal data in audit events. Denial messages exposed to callers must be non-enumerating; detailed reasons belong in protected security audit records.

The decision is not itself proof that the operation completed. The domain service records the actual outcome separately and correlates it to the decision.

## 9. Required denial semantics

The public enforcement response should be stable and minimally revealing. Suggested codes:

- `authentication_required`
- `credential_invalid_or_expired`
- `principal_inactive`
- `tenant_context_required`
- `tenant_membership_inactive`
- `service_grant_missing`
- `resource_not_accessible` (avoid confirming foreign resource existence)
- `resource_owner_mismatch` (protected internal reason)
- `action_not_permitted`
- `purpose_not_permitted`
- `delegation_invalid_or_expired`
- `approval_missing_or_invalid`
- `policy_unavailable`
- `ownership_authority_unavailable`
- `scope_mismatch`

No error, exception, missing database or timeout may fall back to allow.

## 10. Conformance and release gates

The companion fixture suite `tests/fixtures/fortress-entity-isolation-conformance-v1.json` provides synthetic positive and negative scenarios. A future implementation must add executable tests against the actual authentication verifier, membership authority, resource-owning domains, policy engine, PEPs and persistence layer.

Mandatory release gates:

1. Positive same-tenant permitted action succeeds.
2. Cross-tenant identifier substitution is denied, including read, write, search, export and background jobs.
3. Membership suspension/revocation/expiry immediately prevents new protected operations.
4. A resource owner/tenant mismatch denies without leaking resource existence.
5. Caller-supplied role, tenant list, approval boolean or trusted context cannot elevate authority.
6. Service and agent principals are independently scoped.
7. Delegation cannot exceed delegator authority and is invalidated on parent revocation.
8. Exact-scope approvals cannot be replayed or reused with altered parameters.
9. Concurrent membership/resource ownership change cannot race a privileged write.
10. Cache, queue, object storage, analytics, backup and export paths preserve isolation.
11. Missing authority service, database, policy or ownership response fails closed.
12. Security audit evidence is correlated and contains no credentials.

Do not certify tenant isolation from unit tests of a pure policy function alone. Require integration and adversarial tests at every real enforcement boundary and evidence that all access paths are mediated.

## 11. Phased implementation plan

### Phase A — Source and authority inventory
- Revalidate the current heads and actual code for PR #751, #724, #778, #776 and #774.
- Identify the authoritative FORTRESS principal/session store, tenant membership data, capability registry, and domain ownership authorities.
- Inventory every API, database, cache, queue, storage, search, export and agent tool access path.
- Map current tenant enforcement and identify gaps. No duplicate identity/token issuer.

### Phase B — Canonical contracts and adapters
- Translate the schema into versioned API types and validated contracts.
- Add a trusted-context adapter around the existing FORTRESS session/capability verifier.
- Add a membership lookup adapter against the existing authoritative identity source.
- Add resource ownership resolvers per domain; do not centralise domain records in FORTRESS.
- Add explicit policy decision and enforcement adapters with stable deny semantics.

### Phase C — Enforcement rollout
- Begin with one controlled internal product and read-only actions.
- Add write actions only after transactional ownership checks and audit correlation pass.
- Add service and agent grants after human/session paths pass.
- Expand domain-by-domain with cross-tenant adversarial suites and rollback controls.
- Keep legacy paths denied or disabled until they can prove the same contract.

### Phase D — Assurance
- Independent security review, tenant isolation penetration tests and evidence review.
- Test revocation propagation, cache invalidation, replay, TOCTOU, race conditions, queue replay and backup/export boundaries.
- Obtain owner approval before any production migration, secret operation, deployment or activation.

## 12. Explicit architecture invariants

- NODE01 IS SOFTWARE: a logical runtime identity, not a machine.
- Runtime Fabric coordinates execution substrates; it does not become a tenant identity authority.
- FORTRESS governs identity, membership/grants, policy, delegation, approvals and security audit.
- Domain products remain authoritative for their own resources and business rules.
- The DATABASE persists state but does not infer user authority from a connection alone.
- No vendor identity provider, cloud host or external AI service becomes IZAKHONO's permanent identity authority by default.
- No production activation, credential installation, paid service or infrastructure cost is authorised by this specification.

---

**Acceptance statement:** IZAKHONO is not tenant-isolated merely because every request carries a tenant or entity ID. Isolation is established only when verified principal identity, active membership, authoritative resource ownership, exact action policy and enforcement are bound together at every access path.
