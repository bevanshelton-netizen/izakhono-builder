# IZAKHONO MASTER PORTFOLIO — PARALLEL BUILD CONTROL BOARD

**Execution mode:** MASTER PARALLEL BUILD
**Operating principle:** OWNED-FIRST → MODULAR → REPLACEABLE → EXTERNALLY REVERSIBLE
**Commercial principle:** FLAT-RATE CUSTOMER PRICING
**Quality gate:** BUILD → TEST → FIX → TEST AGAIN → INTEGRATE

> This board records verified repository/deployment evidence only. Unknown states are not marked live or complete.

## Portfolio Control Board

| Workstream | Status | Current focus | Next highest-value task | Blocker | Done gate |
|---|---|---|---|---|---|
| IZAKHONO Platform / Builder | BUILDING | Existing builder repository | Complete runtime/provisioner integration audit and close highest-value acceptance gaps | Full repo/runtime audit | Core builder, auth, provisioning, admin, tests and deployment verified |
| IZAKHONO Provisioner | TESTING | Existing Supabase-backed durable provisioning engine + HTTP runtime | Run CI/runtime tests and verify payment→job→steps→handover acceptance | External provider/DNS authority for real activation | End-to-end onboarding test passes |
| IZAKHONO Cloud / Hosting | BUILDING | Native HOST runtime baseline exists | Validate native Docker runtime, DNS, edge, persistence and restore path | Physical/virtual node + public reachability | Deployable internal hosting stack verified |
| IZAKHONO Code | BUILDING | Shared builder/control-plane repository | Consolidate reusable service/API conventions from existing runtime | Repository inventory | Reusable runtime/services documented and tested |
| FORTRESS | BUILDING | Security/owner-gated runtime already represented in deployments | Verify policy, audit, secrets and owner-gated operations end-to-end | Security acceptance evidence | Core security controls tested |
| KORA NETWORK | DEPLOYED | Vercel deployment is READY; product still needs operational acceptance | Verify public flows and connect monetisation/admin/content lifecycle | End-to-end production acceptance | Public product flows + monetisation + operations verified |
| KORA Learner Driver | BUILDING | Existing product/campaign | Complete acquisition→payment→service handoff | Payment/deployment credentials if needed | Lead→payment→service flow verified |
| IZAKHONO NAV | DEPLOYED | Vercel deployment is READY; safety architecture already committed | Verify core UX and next executable service boundary | Maps/routing/emergency/vehicle-data dependencies | Navigation + safety core tested |
| I-CONNECT | PLANNING | Connectivity business architecture | Build packages, provisioning, billing and partner interfaces | Network partner/wholesale dependencies | Customer order→activation flow verified |
| Izakhono Africa | BUILDING | Manufacturing/commercial systems | Product catalogue + quotation/order workflow | Production data/inventory integration | Customer order lifecycle tested |
| BEVAN SHELTON | BUILDING | Brand commerce | Product catalogue + checkout/customer flow | Product/stock data | Purchase flow verified |
| CLASSIQUE FURNITURE | BUILDING | Furniture commerce | Catalogue + quotation/order flow | Product/production data | Quote→order workflow verified |
| Edu-Build Institute | BUILDING | Training business systems | Registration→payment→student administration | Accreditation/external funding dependencies | Student lifecycle operationally tested |
| Free Bird Agri-Quip | PLANNING | Poultry/egg-layer business | Operating model + procurement/sales system | Farm operational data | Commercial operating workflow documented and usable |
| KG Industrial | PLANNING | Ship-repair opportunity pipeline | Procurement/capability and lead pipeline | Customer/contract opportunities | Lead→quotation→contract workflow ready |
| THE BUSINESS OF MUSIC | DEPLOYED | Vercel buy/market deployments are READY | Verify purchase→delivery and sales evidence | Payment/distribution dependencies | Purchase and delivery verified |
| FAITH PERSONIFIED — MY JOURNEY | BUILDING | Manuscript production | Complete manuscript + production pipeline | Editorial completion | Final manuscript + production assets ready |
| LET US GO BACK TO CHURCH | BUILDING | Manuscript production | Complete manuscript to locked prose standard | Editorial completion | Final manuscript + production assets ready |
| Business Development | BUILDING | Funding, DFI, procurement, partnerships | Central opportunity pipeline + follow-up system | External responses/approvals | Repeatable opportunity→follow-up workflow |

## Verified Infrastructure / Deployment Evidence — 2026-11-02

The connected Vercel deployment inventory currently shows READY deployments for `kora-network`, `izakhono-nav`, `izakhono-execution-os`, `izakhono-fortress-intelligence`, `izakhono-social-command`, `izakhono-community-connect`, `izakhono-callback-live`, `izakhono-content-command`, `izakhono-business-command`, `izakhono-advertising-command`, `allegro-studios`, and the Business of Music buy/market applications. These are deployment-state observations, not proof that every production workflow is fully operational.

The connected I-CONNECT Supabase project is ACTIVE_HEALTHY. Its existing database contains durable provisioning jobs, ordered job steps, provider attempts, verification records, audit events and handover packages. The payment bridge creates a provisioning job from a confirmed payment using an idempotency key based on the payment transaction, and the handover function only builds a package when the job reaches `handover_ready`.

The `izakhono-builder` README establishes an existing owned-first architecture: CODE → BUILDER → VISUAL ENGINE → PROVISIONER → IZAKHONO CLOUD/NODES → DNS/EDGE/TLS → FORTRESS → runtime; it also identifies a native HOST baseline using Caddy, CoreDNS, PostgreSQL, MinIO and Valkey. Public-live status remains evidence-gated by node reachability, DNS/TLS, backups/restore and end-to-end acceptance.

## Execution Rules

1. Never rebuild an existing component without inspecting it first.
2. Never claim LIVE, DEPLOYED, OPERATIONAL or DONE without verification.
3. A blocked workstream does not block the portfolio.
4. Revenue-enabling work takes priority over cosmetic work.
5. Shared services must be reusable across KORA, commerce, education and provisioning.
6. External providers are adapters, not the business foundation.
7. Every completed component must leave a testable artifact, integration point or documented dependency.

## Parallel Cycle

**Cycle A — Foundation:** platform runtime, provisioning, auth, data, security.

**Cycle B — Revenue:** payment, customer onboarding, commerce, publishing and education registrations.

**Cycle C — Distribution:** KORA content/media, marketing, catalogues and acquisition flows.

**Cycle D — Infrastructure:** hosting, DNS, SSL, email, monitoring and fallback capability.

**Cycle E — Product expansion:** NAV, I-CONNECT, FORTRESS, industrial/agriculture systems.

After each cycle, reassess every workstream and select the highest-value unfinished task. Continue until each applicable DONE gate is satisfied.

## Current Execution Record

**Completed this cycle:**
- Created the master portfolio control board in the canonical `izakhono-builder` repository.
- Inspected the repository architecture before proposing replacement infrastructure.
- Inspected current Vercel deployment state and recorded verified READY deployments.
- Inspected the live I-CONNECT Supabase schema and existing provisioning RPC boundary.
- Confirmed durable uniqueness for provisioning jobs, job steps, provider attempts, verifications and handover packages.
- Replaced the Provisioner HTTP layer's non-existent legacy RPC calls with the actual Supabase provisioning functions.
- Aligned the JavaScript acceptance contract with the real 11-step database state machine.
- Added deterministic job-step idempotency semantics and terminal handover acceptance tests.
- Updated the Provisioner documentation to match the executable runtime.

**Current acceptance boundary:** repository changes are committed, but CI/runtime execution has not yet been directly verified in this turn. Therefore the Provisioner remains TESTING rather than DONE.

**Next cycle priority:** execute the Provisioner test/CI path, fix any failures, then exercise the confirmed-payment→job→step→handover path in a safe staging/sandbox environment before moving the portfolio to the next highest-value workstream.

## Current Evidence Boundary

This board is an execution control artifact, not a claim that every listed system is currently deployed. Deployment and operational status must be established from direct repository, deployment, infrastructure or production verification before being promoted to DEPLOYED/OPERATIONAL/DONE.
