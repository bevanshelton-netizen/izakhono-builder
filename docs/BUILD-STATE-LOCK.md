# IZAKHONO BUILD STATE LOCK

**Purpose:** durable checkpoint so completed architecture/code is not lost or confused with unverified production activation.

## LOCKED VERIFIED STATE

### 1. IZAKHONO HOST — owned runtime architecture
- Customer web runtime is defined as IZAKHONO-owned and third-party hosting is treated as externally reversible fallback.
- Control, Edge, Runtime, Data, Mail, Provisioner and FORTRESS planes are defined.
- Native Node control-plane runtime exists under `products/izakhono-host/runtime/control-plane`.
- Persistent per-domain site state and public document roots exist.
- Native hostname-based site serving exists.
- Caddy, CoreDNS, PostgreSQL, MinIO and Valkey are defined in the owned Docker composition.
- NODE01 bootstrap/activation, topology/role separation, preflight, CI smoke-test and backup/restore paths are part of the repository architecture.
- Promotion rule: never mark a site LIVE without HTTPS + DNS + intended-content evidence; never mark mail LIVE without the mail acceptance gate.
- Physical node/public-Internet activation remains a separate evidence gate.

### 2. NODE01-SW — portable computer/control plane
- NODE01-SW exposes typed workspaces, files, applications, jobs, capabilities and compute providers.
- Arbitrary remote shell execution is intentionally disabled.
- Jobs use typed provider adapters rather than unrestricted command execution.
- Job lifecycle execution is implemented as QUEUED -> RUNNING -> COMPLETED/FAILED with persisted state.
- Portable compute provider abstraction exists.

### 3. Owned-host deployment adapter
- `NODE01-SW` has an `izakhono-host` provider adapter.
- Provisioning is typed and requires a domain.
- The adapter calls the owned host `/api/sites/provision` endpoint.
- The adapter is not a claim that the physical owned node is publicly reachable; credentials/runtime configuration and physical activation are still required.

### 4. Typed content deployment
- IZAKHONO HOST now exposes `POST /api/sites/:siteId/content`.
- Content deployment is authenticated.
- Deployment paths are traversal-protected.
- File count, individual file-size and total deployment-size limits are enforced.
- Deployment writes are scoped to the tenant public root.
- Deployment records are persisted as machine-readable evidence.
- Site content can become `content_ready`, but public LIVE status still requires HTTPS + DNS + content acceptance.

### 5. Current repository checkpoints
- Latest NODE01-SW deployment execution commit: `a46145699cc6be74aadca583e442e4a21788a537`.
- Latest IZAKHONO HOST typed-content deployment commit: `06019a35ee2b4dcae636aa757863a8385522462f`.
- These commits are source-of-truth checkpoints; future work must preserve their functionality unless deliberately superseded by a verified replacement.

## NOT YET CERTIFIED

The following must NOT be described as complete/live until evidence is produced:

1. Physical NODE01 activation.
2. Public Internet reachability to the owned edge.
3. Production DNS delegation to owned authoritative DNS.
4. Public trusted TLS on the owned edge.
5. Full XQWAXQWAMILÉ end-to-end deployment through owned infrastructure.
6. Production business email/mailbox delivery and acceptance.
7. Full automated domain -> DNS -> site -> SSL -> mail -> handover pipeline.
8. Replacement of Vercel/other external hosting as the active production runtime.

## TEST CUSTOMER

**XQWAXQWAMILÉ HOLDINGS** is the designated end-to-end acceptance customer for proving the commercial website + infrastructure provisioning service.

External/Vercel deployment may remain a fallback during migration/testing. It must not be confused with proof of the owned runtime.

## EXECUTION RULE

Continue automatically through safe, reversible engineering gates. Stop only for genuine authorization/payment/credential/legal/security/physical-network gates or when evidence is unavailable. Never fabricate LIVE, DEPLOYED, VERIFIED or ACCEPTED status.
