# FORTRESS Authoritative Identity and Membership Integration Inventory

## Version 1.0 — Evidence inventory and implementation boundaries

- **Status:** Engineering inventory; not an identity/membership implementation.
- **Date:** 26 November 2026
- **Repository:** `bevanshelton-netizen/izakhono-builder`
- **Base review branch:** `feat/fortress-entity-isolation-trust-boundary-v1` (PR #779 dependency line)
- **Authority:** No production migration, credential installation, deployment, access grant or expenditure is authorised by this document.

---

## 1. Executive finding

The inspected FORTRESS identity source already provides a persistent principal, credential and refresh-session foundation. It is not yet a general tenant-membership and resource-ownership authority.

The current identity model places a single `tenant_id` and a single role directly on each principal. The inspected schema does not define a separate membership relation, membership lifecycle, tenant-scoped role assignment, service-grant relation or resource-ownership resolver. This is an evidence statement about the files and branches listed below, not a claim that no other repository component has any tenant-aware logic.

The five-minute DEPLOY capability work in PR #751 is a distinct, resource-scoped capability implementation on its own branch. It must not be treated as merged into the PR #779 branch, nor as a universal membership or ownership service. The DEPLOY control plane in PR #724 is likewise separate.

**Decision:** preserve the existing FORTRESS principal/session issuer. Do not create a second identity issuer, duplicate principal database, or speculative universal resource registry. First define and verify a tenant-membership source and domain-owned resource resolvers, then integrate them through explicit adapters and product enforcement points.

## 2. Evidence examined

| Evidence | Ref / file | Verified observation |
|---|---|---|
| Current FORTRESS identity Worker | PR #779 branch, `products/fortress-identity/src/worker.ts`, blob `7aa92359f7766cd59588f7c1907040b842ee58be` | Login, bootstrap, refresh, logout and session introspection routes; principal context contains `id`, `tenant_id`, `email`, `display_name`, `role`, `active`. |
| Identity schema | PR #779 branch, `products/fortress-identity/migrations/0001_identity.sql`, blob `205f0025a201e32f175ea0eaca71247c1226dcb0` | Tables: `principals`, `credentials`, `refresh_sessions`, `login_rate_limits`, `security_audit`. |
| Session JTI migration | PR #779 branch, `products/fortress-identity/migrations/0002_access_session_jti.sql`, blob `9dac26e32f3e3556cca94c5963f703905eebc28b` | Adds `access_jti` to `refresh_sessions` and a unique index. |
| DEPLOY capability implementation | PR #751 branch `feat/fortress-deploy-access-token-v1`; `products/fortress-identity/src/deploy-access.ts`; PR head stated as `8452b6bc20bd27b3925521a5e2a0bed8f4975562` | Separate DEPLOY audience, short TTL, app/environment binding, capability persistence, parent-session checks, introspection and revocation. PR description reports route/migration CI validation. |
| DEPLOY capability schema | PR #751 branch, `products/fortress-identity/migrations/0003_deploy_access_sessions.sql` | Adds DEPLOY capability/session persistence; foreign-key relationship to issuing FORTRESS refresh-session JTI is described in the PR. |
| DEPLOY control plane | PR #724 branch `feat/izakhono-deploy-owned-control-plane`; `deploy-control/authorization.mjs`, `fortress-verifier.mjs`, migration and lifecycle files; PR head stated as `a0f0c70c455f06b1d4fc5a8807accd0be4c03020` | Separate enforcement and persistence implementation. PR description reports tenant/application/environment enforcement and transactional audit coupling. |
| Entity isolation contract | PR #779 branch, `docs/security/IZAKHONO-FORTRESS-ENTITY-ISOLATION-AND-TRUST-BOUNDARY-V1.md` | Proposed system-wide trust contract and phased implementation; explicitly not a deployed universal membership or ownership service. |

### Branch integration warning

At the time of this inventory, PR #779's branch contains the identity Worker and migrations 0001/0002, but the checked paths for `deploy-access.ts` and `deploy-control/*` were not present on that branch. Those implementations remain on separate PR branches. Their PR descriptions and CI results are evidence about those branches only; they are not proof of integration into the PR #779 branch, the default branch, or production.

The PR #751 and #724 heads and branch dependencies must be re-fetched before integration. The head SHAs above are the SHAs recorded in their PR descriptions during this audit, not a claim that they remain the latest heads.

## 3. Existing authoritative identity/session foundation

### 3.1 Principal record

The inspected `principals` table contains:

- opaque principal ID;
- one required `tenant_id`;
- globally unique email;
- display name;
- one role from `OWNER`, `SECURITY_ADMIN`, `ANALYST`, `VIEWER`;
- active flag and timestamps.

The Worker constructs session principal context from this record. The identity issuer signs a short-lived Creator-audience access JWT and persists a refresh-session record with a hashed refresh token, CSRF hash, access JTI, creation time and expiry. Session introspection verifies JWT signature, issuer, audience, time bounds and matching unrevoked persisted session/principal state.

### 3.2 Important schema/cardinality question

Migration 0001 defines a partial unique index on `principals(role)` for `role='OWNER'`. This permits only one OWNER principal in the identity database, irrespective of `tenant_id`. This may reflect an intentional single sovereign owner model, but it is not equivalent to one owner per tenant. Before any multi-tenant role/membership change, the owner must explicitly decide whether OWNER is a global platform authority, a tenant membership role, or both through separate authority types. Do not silently remove or weaken this constraint.

Email is also globally unique in the inspected table. Preserve this behavior unless a separately reviewed identity design establishes a different canonical login model.

### 3.3 Bootstrap boundary

The bootstrap route requires a configured bootstrap secret and accepts a `tenantId` in the bootstrap request before creating the initial OWNER principal. This is an initial provisioning path, not a general membership grant API. No general-purpose endpoint to add, suspend, revoke or change a principal's tenant membership was identified in the inspected Worker.

## 4. What is and is not authoritative today

| Security fact | Existing evidence | Inventory conclusion |
|---|---|---|
| Human principal identity | FORTRESS `principals` + credentials | Implemented in the inspected identity service. |
| Login/session authentication | FORTRESS login, refresh, logout and introspection | Implemented in the inspected identity service; production deployment not established by this inventory. |
| Session revocation | Persisted refresh-session revocation and JTI lookup | Implemented in the inspected identity service. |
| Tenant context on principal | `principals.tenant_id` and JWT `tenant_id` | Present as a single tenant attribute; not a membership relation. |
| Tenant membership lifecycle | No membership table/API in inspected migrations/Worker | Not established by inspected source. |
| Tenant-scoped role assignments | One role on principal | Not established as a separate per-tenant assignment. |
| Service identity/grants | Not identified in inspected identity schema/Worker | Unverified; do not infer absence elsewhere. |
| Agent identity/task delegation | Covered by proposed contracts, not by the inspected identity tables | Not established by inspected identity source. |
| DEPLOY capability | PR #751 separate branch | Implemented in that review branch per source/PR evidence; integration and production status remain separate. |
| DEPLOY enforcement | PR #724 separate branch | Implemented in that review branch per PR evidence; integration and production status remain separate. |
| Domain resource ownership | No domain ownership resolver in the inspected FORTRESS identity files | Must remain authoritative in each owning product; inventory required per domain. |
| Cross-tenant support grant | Proposed in PR #779 contract/fixtures | No live grant authority established by inspected identity source. |
| Database row-level tenant isolation | Not proven by FORTRESS identity schema | Must be verified independently in each data store and access path. |

## 5. Non-duplication and authority boundaries

1. FORTRESS remains the issuer and verifier of human identity/session credentials.
2. Existing DEPLOY capability issuance remains a distinct narrow capability path with its own audience, scope, persistence and revocation checks.
3. DEPLOY remains responsible for deployment-specific tenant/application/environment enforcement and transaction/audit coupling.
4. FORTRESS must not become the owner of product-domain business records or infer resource ownership from IDs, URLs, table names or caller-supplied fields.
5. Each domain product must expose a trusted ownership resolver or enforce ownership within its own transaction boundary.
6. Runtime Fabric coordinates execution substrates; it is not an identity or membership authority.
7. NODE01 is a logical software runtime identity, not a physical machine.

## 6. Required source inventory before implementation

The following are unresolved evidence tasks, not presumed missing implementations:

| Area | Required evidence | Acceptance condition |
|---|---|---|
| Identity lifecycle | Current Worker, migrations, test suites, deployment config and current PR heads | One canonical issuer; stable principal IDs; revocation behavior tested. |
| Membership | Existing tenant/org/company/team tables, APIs, migrations and admin workflows across the repository | Identify the canonical membership authority or explicitly approve a narrowly scoped extension to FORTRESS. |
| Roles and authority | OWNER, SECURITY_ADMIN, product roles, support roles and system authority usage | Distinguish global platform authority from tenant-scoped membership roles; define privilege boundaries. |
| DEPLOY integration | Current PR #751 and #724 heads, tests, workflow steps, branch ancestry | Verify exact token claims, issuer/audience, introspection, revocation, transaction and audit integration. |
| Resource ownership | Product schemas and domain service code for each tenant-scoped resource | Each resource type has one authoritative owner domain and a server-side resolver/check. |
| APIs and PEPs | HTTP routes, RPC handlers, command gateways, worker consumers and agent tools | Every protected path validates trusted context and exact action/resource scope. |
| Data paths | SQL, caches, object storage, queues, search, exports, analytics, logs and backups | Tenant isolation demonstrated at each actual access path, including background work. |
| Audit | Identity events, policy decisions, domain outcomes and DEPLOY audit | Correlated records without credentials or unnecessary personal data; fail-closed audit semantics where required. |
| Operations | CI, secrets references, migrations, runtime config and deployment evidence | Separate repository test evidence from production activation evidence. |

## 7. Implementation sequence

### Phase 1 — Complete evidence collection

- Re-fetch PR #751 and #724 heads and verify branch ancestry and current changed files.
- Inspect repository-wide tenant/org/team schema and domain access code.
- Build a resource ownership matrix by product and resource type.
- Identify actual PEPs and any bypass paths.
- Record source path, commit/ref, tests and observed enforcement for each row.

### Phase 2 — Decide membership model

Before creating tables or APIs, resolve:
- whether one principal may belong to multiple tenants;
- whether membership roles are tenant-scoped and distinct from global platform roles;
- how membership invitations, activation, suspension, expiry and revocation work;
- how service and agent grants bind to tenant, task, purpose and expiry;
- how the existing single-OWNER constraint is intended to behave.

If an existing authoritative membership source is found, integrate with it rather than duplicating it. If none exists, propose the smallest additive migration and API against the existing FORTRESS identity authority, preserving backward compatibility and existing bootstrap/session behavior.

### Phase 3 — Domain ownership adapters

Create adapters only after each owning domain is identified. A resolver must return authoritative ownership and lifecycle facts from the domain, not trust request metadata. Unknown or unavailable ownership must deny protected access. Keep domain-specific business rules in the domain.

### Phase 4 — Enforcement and conformance

Start with one internal, read-only product path. Add executable tests against the actual identity verifier, membership source, owner resolver and PEP. Then add write paths with transactionally consistent ownership checks and correlated audit. Expand to caches, queues, storage, search, exports and agent tools only with evidence for each path.

### Phase 5 — Assurance and activation

Require cross-tenant adversarial tests, revocation propagation, replay and TOCTOU/race tests, non-enumerating denials, audit review and independent security review. Production migrations, secrets, deployments, host activation, DNS/routing changes and paid infrastructure require separate explicit owner approval.

## 8. Explicit non-goals

This inventory does not:
- create a second identity issuer or principal database;
- create a universal resource registry in FORTRESS;
- convert the DEPLOY capability into a universal application token;
- claim all IZAKHONO products are tenant-isolated;
- assert that PR #751, #724 or #779 is merged or production-deployed;
- perform a production migration, install a secret, issue a live capability, deploy a Worker or activate infrastructure.

## 9. Acceptance criteria for the next engineering package

The next package may implement a membership adapter only when:
1. repository-wide evidence establishes whether an existing membership authority exists;
2. the global OWNER versus tenant OWNER model is explicitly resolved;
3. multi-tenant principal behavior is documented without weakening the current authentication boundary;
4. the exact source-of-truth and lifecycle API are identified;
5. backward-compatible migration and rollback are specified;
6. executable tests cover active, suspended, expired, revoked, wrong-tenant and unavailable-authority cases;
7. no domain ownership is centralised without a domain-specific authority decision.

**Final invariant:** authenticated identity, tenant membership, resource ownership and action permission remain separate facts. They are joined only through trusted server-side context and enforced at the protected operation.
