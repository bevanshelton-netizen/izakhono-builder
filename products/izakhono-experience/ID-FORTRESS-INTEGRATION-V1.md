# IZAKHONO EXPERIENCE — ID and FORTRESS Integration Contract v1

**Status:** design and implementation contract; not a production connectivity declaration.
**Scope:** authenticated access to the EXPERIENCE domain through IZAKHONO ID and FORTRESS.

## 1. Security objective

EXPERIENCE must not trust client-supplied subject, entity, role, platform or permission claims. It may construct an entity-scoped store only after an active IZAKHONO ID session has been introspected and FORTRESS has explicitly approved the exact requested permission.

The authority chain is:

1. IZAKHONO ID authenticates the bearer session and resolves its single entity membership.
2. EXPERIENCE validates the active session and expiry, then derives subject, entity ID and role from the ID response.
3. FORTRESS evaluates the exact subject, entity, role, product and permission tuple.
4. EXPERIENCE accepts only an explicit, traceable, versioned allow decision.
5. EXPERIENCE constructs a store scoped to the authenticated entity and fixed product identifier.

Any missing, malformed, expired, unavailable or indeterminate result denies access.

## 2. Service contracts

### IZAKHONO ID

- Internal endpoint: POST /api/v1/internal/introspect.
- Transport requirement: HTTPS over an approved private service path.
- Caller authentication: dedicated internal service credential, held in the approved secret manager.
- Input: the end-user bearer session token, transmitted only in the protected service request body.
- Required response claims consumed by EXPERIENCE: ok=true, active=true, subject, entity_id, role and an explicit timezone-aware expires_at value.
- The ID service documentation also describes entity_slug as a session claim; the EXPERIENCE adapter does not use it as an authorisation substitute.

ID remains the authority for session validity and entity membership. EXPERIENCE must never accept caller-supplied replacements for these claims.

### IZAKHONO FORTRESS

- Decision endpoint: POST /v1/authorize-product.
- Transport requirement: HTTPS over an approved private service path.
- Caller authentication: a dedicated FORTRESS service credential, distinct from the ID internal credential.
- Request fields: subject, entity_id, role, product and permission.
- Product identifier: izakhono-experience.
- Response requirements: allowed must be a literal boolean; decision_id must use the fdc_ prefix; policy_version must be an integer.
- HTTP 403 is a denial. Network, server, malformed-response or policy errors are not grants.

FORTRESS matches subject, entity, role, product and permission exactly. Wildcards, role inheritance and implicit grants are prohibited.

## 3. EXPERIENCE permission namespace

Permissions must be narrow, action-specific and checked at the operation boundary. Initial vocabulary candidates:

- experience:survey:read
- experience:survey:write
- experience:response:read
- experience:response:submit
- experience:case:read
- experience:case:assign
- experience:case:resolve
- experience:analytics:read
- experience:admin:manage

This vocabulary is a design catalogue, not an active grant. The policy currently contains an empty grant list for izakhono-experience. No user, role or entity is authorised until an exact owner-reviewed rule is approved and added.

Anonymous survey submission is not an unauthenticated bypass. If a future anonymous collection flow is approved, it must use a separately designed, narrowly scoped public submission capability with abuse controls, expiry, rate limits, tenant binding and no access to respondent or case-management data.

## 4. Private transport topology

The current FORTRESS listener binds to 127.0.0.1 by default. The EXPERIENCE HTTPS client therefore does not, by itself, establish that two separately hosted services can reach one another. No routable private service path is presently certified by this contract.

Before connecting separate execution environments, the owner must approve and verify:

- the actual independently managed execution environments and their ownership;
- a private service network or authenticated private tunnel;
- TLS certificate issuance, hostname validation, rotation and revocation;
- service-to-service identity and separate credentials for ID and FORTRESS;
- firewall rules restricted to the required service identities and ports;
- secret injection and rotation without placing credentials in source, logs or chat;
- health, timeout, retry, replay and incident behaviour;
- auditable binding between software services and their authorised execution environments.

NODE01 is a logical software/runtime identity. It is not a physical or virtual machine, host, server or network endpoint. Execution environments are separate infrastructure resources and must be identified and authorised independently.

Do not change the FORTRESS bind address to 0.0.0.0, expose port 9999 publicly, create DNS records, open firewall ports, purchase infrastructure or activate a paid tunnel as part of this source-only work.

## 5. Owner-controlled permission administration

Product service credentials may request decisions; they may not create, edit or revoke policy grants.

Until a separately authorised owner administration product exists, permission changes use a reviewed repository change:

1. The request identifies the business purpose, named subject, exact entity, role, product and minimum permissions.
2. The policy change uses exact identities and a constrained permission identifier; no wildcard is accepted.
3. The policy version is incremented and the change includes rationale, owner approval evidence and expiry/review date where appropriate.
4. CI validates policy structure and tests both the intended grant and negative cases for other subjects, entities, roles and permissions.
5. A human reviewer approves the change. The PR remains unmerged until explicitly authorised.
6. Deployment and policy activation are separate controlled operations with a recorded resulting policy version.
7. Revocation is performed through a reviewed policy change and verified after activation.

A future owner console requires its own owner identity, phishing-resistant authentication, step-up approval, dual-control option for high-risk grants, immutable audit retention and separation from product service credentials. The console must not be built as a privileged feature inside EXPERIENCE.

## 6. Audit and privacy

Every request and decision should be correlated using a request ID and FORTRESS decision ID. Audit records should contain actor subject, entity, product, permission, policy version, allow/deny outcome, timestamp and correlation identifiers. They must not contain bearer tokens, internal keys, raw survey answers or unnecessary personal information.

FORTRESS currently emits structured decision logs; durable append-only and tamper-evident central retention is a separate infrastructure requirement and is not claimed to exist.

Survey response access must remain separate from aggregate analytics permissions. Anonymous mode must not persist respondent identity. Any cross-tenant reporting requires an explicit, separately reviewed aggregation policy and privacy assessment.

## 7. Acceptance gates before runtime activation

- Verify the actual IZAKHONO ID introspection implementation and response schema against this adapter.
- Verify FORTRESS policy validation and decision behaviour on the exact release commit.
- Approve an exact, least-privilege permission grant; empty policy remains the correct default until then.
- Provision separate service credentials through an approved secret manager.
- Establish and independently test private authenticated transport with certificate validation.
- Test denied, expired, revoked, malformed, replayed and unavailable identity/policy cases.
- Verify entity isolation at every persistence and API boundary.
- Establish durable audit retention, incident response and credential rotation.
- Complete POPIA/privacy, retention and user-notice review for each deployed survey workflow.
- Obtain explicit owner approval for production activation.

Passing CI is evidence of source-level checks only. It does not establish private connectivity, production deployment, policy grants, infrastructure ownership or operational readiness.

## 8. Current implementation boundary

The current code provides the EXPERIENCE domain library, ID introspection adapter, FORTRESS decision client, fail-closed store factory and FORTRESS product-permission decision point. The default policy denies all EXPERIENCE callers. No public EXPERIENCE API, management UI, public survey URL, outbound email/SMS workflow, remote permission administration endpoint, production migration or production deployment is included.