# CONNECT-FOUNDATION-001 — Gate 0 Discovery & Preservation Report

**Status:** Partial, evidence-backed repository discovery  
**Date:** 2026-11-21  
**Repository:** `bevanshelton-netizen/izakhono-builder`  
**Discovery baseline:** `main` (read-only file inspection)  
**Architecture proposal:** PR #721, branch `connect/unified-platform-architecture`  
**Scope:** Identify existing product components and boundaries before any CONNECT consolidation or implementation.

> This report records only paths and behaviours directly inspected. It is not a complete repository tree, database inventory, security audit, test result, or production-readiness certification. Uninspected areas are explicitly marked as open work.

## 1. Executive finding

The repository contains at least three distinct product surfaces relevant to the unified CONNECT direction:

1. **I-CONNECT corporate command and connectivity platform** at `products/i-connect/`. This is the established connectivity, customer operations, provider, order/provisioning, billing and communications control-plane codebase.
2. **IZAKHONO CONNECT communications application** at `products/izakhono-connect/`. This is a separate browser/PWA communications client with messaging, presence, receipts and WebRTC calling foundations.
3. **IZAKHONO HOST and shared security foundations**, including `products/izakhono-host/`, `products/fortress-security/`, and the FORTRESS device identity service documented under I-CONNECT.

These are not interchangeable products and must not be collapsed into a single folder or persistence domain. The immediate design opportunity is to unify the customer-facing product, navigation, entitlement model and integration contracts while retaining ownership of existing domain data and services.

## 2. Verified component map

### 2.1 I-CONNECT — existing infrastructure and operations domain

**Canonical inspected path:** `products/i-connect/`

| Component | Verified location | Evidence / boundary |
|---|---|---|
| Product scope and ownership | `products/i-connect/README.md` | Corporate contact centre, fleet, fibre/broadband, Wi-Fi, mobile data, airtime, SIM/eSIM lifecycle, MVNO/MVNE and owned-network workstream, billing, Provisioner and FORTRESS. |
| Node service entry point | `products/i-connect/server.js` | Express server; serves the product directory and agent assets; mounts health, readiness, runtime, network-route and registered lifecycle APIs. |
| Package/runtime manifest | `products/i-connect/package.json` | Private Node package `i-connect-core`, version 1.0.0; Express 5 and Supabase JS dependencies; test command covers network tests, API tests and the MobiSIM adapter tests. |
| API registration | `products/i-connect/runtime/register-api-routes.js` | Registers public-config, organisation, onboarding, customer-control, provisioning, handover, checkout-intent, checkout-state and provider-attempt handlers. |
| Supabase RPC transport | `products/i-connect/api/_lib/supabase.js` | Uses I-CONNECT Supabase URL and anon key plus caller Bearer token to invoke PostgREST RPCs. No service-role key is used in this helper. |
| Readiness reporting | `products/i-connect/api/readiness.js` | Checks presence of Supabase, carrier bridge and payment-provider configuration. Explicitly hard-codes `productionReady: false`; even complete configuration remains unverified and requires activation. |
| Connectivity provider selection | `products/i-connect/network/provider-router.mjs` | Provider-neutral selection/failover primitive. The source lists seven provider identifiers/capability sets; this registry is not proof of executed contracts, coverage or production approval. |
| Mobile operator lifecycle | `products/i-connect/network/mobile-operator-core.mjs` | Contains order, readiness, dispatch and service transition primitives. Activation requires provider confirmation and an external reference. |
| Emergency communications routing | `products/i-connect/network/emergency-communications-core.mjs` | Pure route selection and delivery-state transitions; requires evidence for sent/delivered and explicit human acknowledgement for acknowledged. |
| Provisioning route | `products/i-connect/api/provisioning.js` | Authenticated Supabase RPC path for connectivity state transitions; provision/retry may use the provisioning orchestrator and carrier bridge. Full RPC implementation and database-side authorisation still need inspection. |
| Checkout intent | `products/i-connect/api/checkout-intent.js` | Calls `ic_prepare_checkout_intent_for_customer` through the Supabase RPC helper. |
| Provider attempt safety | `products/i-connect/api/provider-attempt.js` | Public provider-attempt endpoint intentionally returns HTTP 410 and states that provider attempts are not publicly callable. Preserve this closure unless a reviewed replacement is implemented. |
| MobiSIM adapter | `products/i-connect/supabase/functions/i-connect-mobisim-adapter/index.ts` | Supabase Edge Function authenticates an I-CONNECT worker token before supplier calls. Exposes account check, catalogue and a constrained non-billable TestBuy; explicitly does not expose live Buy, top-up, wallet changes or production provisioning. |
| API contract | `products/i-connect/API-CONTRACT-V1.md` | Proposed API contract; document itself says not every listed endpoint is deployed. Includes identity/org, catalogue, orders, payments, provisioning, connectivity, messaging, incidents, FORTRESS and audit. |
| Control Centre specification | `products/i-connect/CONTROL-CENTRE-AND-GLOBAL-APP-SPEC.md` | Describes product surfaces, roles, organisation tenancy, service boundaries, data controls and phased integration. Supabase is stated as the current application data/auth foundation. |
| Security baseline | `products/i-connect/SECURITY-ARCHITECTURE.md` | Zero-trust, least privilege, default deny, tenant object authorisation, privacy, cryptography, API and emergency workflow security requirements. |
| Mobile operator specification | `products/i-connect/MOBILE-OPERATOR-ARCHITECTURE.md` | Separates MVNO/MVNE partner delivery from a future owned network; regulatory, commercial, provider and technical gates remain mandatory. |
| FORTRESS device identity service | `products/i-connect/FORTRESS-DEVICE-IDENTITY-SERVICE.md` | Documents a deployed Supabase Edge Function foundation, JWT/AAL2 requirements, device enrolment/revocation and outstanding application integration/security testing. |

**Important preservation conclusion:** I-CONNECT already owns meaningful connectivity and lifecycle concepts, API contracts, provider adapters, operational workflows and tests. It is the system of record candidate for its existing domain until a formal data-ownership review says otherwise. Do not duplicate it under `products/connect/infrastructure/`, rewrite its APIs, or migrate its data as a cosmetic reorganisation.

### 2.2 IZAKHONO CONNECT — existing communications client

**Canonical inspected path:** `products/izakhono-connect/`

The inspected `README.md` describes a cross-platform communication foundation with Supabase authentication/profile bootstrap, direct/group-ready conversations, realtime messaging, offline outbox/reconnect flush, delivery/read receipts, browser WebRTC voice/video, realtime call signalling, PWA assets and RLS for the listed communications tables.

The inspected `index.html` is a static browser entry point loading `styles.css`, `app.js`, a Supabase JS CDN script, service worker registration, and a sequence of versioned `connectNNN.js` modules. It is not a Vite/React app based on the inspected entry point; no Vite config or package manifest was found at the specific paths checked. That does not establish that no other build or deployment configuration exists.

The product README explicitly lists production-hardening gaps: TURN for restrictive NATs, verified push notification delivery, media storage/attachment policy and UX, native Android/iOS signing and store credentials, and automated real-device/network integration tests. It also does not claim audited end-to-end encryption.

**Integration conclusion:** This product is a likely reusable communications capability for CONNECT ENGAGEMENT, but its schemas, RLS policies, authenticated APIs, build/deployment path, ownership model and operational readiness must be inventoried before reuse. Do not create duplicate conversation, presence, message or receipt tables until that work is complete.

### 2.3 Shared and adjacent platform foundations

| Foundation | Inspected location | Current conclusion |
|---|---|---|
| HOST runtime | `products/izakhono-host/OWNED-RUNTIME-V1.md` | Describes owned control, edge, runtime, data, mail, provisioner and FORTRESS planes. Software baseline documentation is not evidence that an approved execution host has been activated. |
| FORTRESS security product | `products/fortress-security/README.md` | Defensive asset scanning/remediation/evidence platform. It is not, by itself, proof of a shared identity or tenant-authorisation service. |
| FORTRESS device identity | `products/i-connect/FORTRESS-DEVICE-IDENTITY-SERVICE.md` | Deployed Supabase device-identity foundation is documented; application-wide enforcement and independent security testing remain open. |
| Root Builder | `package.json` | Root scripts include product-specific tests/typechecks for I-NET, Super Engine, Marketing OS, Business Studio and FORTRESS. The inspected root package has no declared pnpm workspace or Turbo configuration; the tested conventional paths `pnpm-workspace.yaml` and `turbo.json` were not found. |
| NODE01 policy | `AGENTS.md` | Mandatory: NODE01 is a logical software/runtime identity, not physical/virtual infrastructure. Runtime binding must remain separate and verified. |

**Shared-service caution:** Current documentation references identity, FORTRESS, billing, audit and tenant controls across products, but this inspection has not established a single reusable shared implementation or canonical service contract for each. Do not create a second control plane, and do not assume a capability is centrally implemented merely because several product specifications name it.

## 3. API, data and provider findings

### Confirmed API surface

The I-CONNECT Express server mounts `/api/health`, `/api/readiness`, `/api/runtime`, `/api/network/route`, and the registered lifecycle routes listed above. The API contract document contains a broader proposed `/api/v1` surface; that contract must not be mistaken for a list of deployed routes.

The shared Supabase helper forwards the caller's Bearer token to PostgREST RPCs and uses the I-CONNECT anon key. The exact RPC definitions, grants, RLS policies, triggers and schema migrations have not yet been enumerated. The FORTRESS device identity document describes a separate service-role-only database boundary for that device registry; it must not be conflated with I-CONNECT's ordinary customer API helper.

### Provider posture

- The source code includes a provider router and a named provider/capability catalogue. Registry presence and simulated telemetry do not establish a commercial agreement, live coverage or successful fulfilment.
- The MobiSIM Edge Function checks an internal worker token before supplier calls and exposes only account/catalogue lookup plus a constrained test purchase.
- I-CONNECT documentation says production carrier purchasing, top-ups and provisioning remain disabled pending commercial approval, credentials, pricebook and certification.
- The I-CONNECT readiness endpoint always reports `productionReady: false`. No production readiness or activation claim is made by this report.

### Data ownership and migrations — open inventory

The inspected code identifies Supabase RPC names including `ic_verify_provisioner_worker_token`, `ic_transition_connectivity_service`, `ic_prepare_checkout_intent_for_customer`, `ic_list_my_organizations`, and provisioning-handover functions. Their SQL definitions and the complete migration history were not inspected. The repository connector exposed individual-file retrieval but not a directory/tree listing in this session; repository code search was not available for this repository. A complete migration inventory therefore remains a hard Gate 0 item.

No table names, row counts, tenant policies, production data volumes, backups, or live database state are inferred here.

## 4. Existing tests and validation status

The I-CONNECT package test command is:

```sh
node --test network/*.test.mjs api/*.test.js supabase/functions/i-connect-mobisim-adapter/*.test.mjs
```

Inspected test files include:
- `network/provider-router.test.mjs`
- `network/mobile-operator-core.test.mjs`
- `network/emergency-communications-core.test.mjs`
- `api/readiness.test.js`
- `supabase/functions/i-connect-mobisim-adapter/index.test.mjs`

These tests demonstrate existing regression coverage for provider selection/failover, mobile readiness and activation evidence, emergency route/receipt semantics, readiness fail-closed behaviour, and MobiSIM adapter restrictions. **They were inspected, not executed in this discovery session.** No test pass is claimed.

The communications client's README describes RLS and realtime functionality, but its full migration/policy/test inventory has not yet been inspected.

## 5. Target boundary map for unified CONNECT

This is the safe logical mapping derived from the verified repository evidence; it is not a proposal to move code immediately.

| Unified CONNECT capability | Existing source of capability | Gate 0 disposition |
|---|---|---|
| CONNECT INFRASTRUCTURE: connectivity catalogue, provider routing, orders, provisioning, subscriber/service lifecycle | `products/i-connect/` | Preserve in place; expose through reviewed contracts. |
| CONNECT INFRASTRUCTURE: billing/checkout and provider reconciliation | I-CONNECT API/RPC references and product specifications | Inspect SQL, payment integrations and ledger ownership before shared billing integration. |
| CONNECT ENGAGEMENT: direct/group messaging, realtime conversations, receipts, calling | `products/izakhono-connect/` plus I-CONNECT communications specifications | Reuse only after schema, RLS, API and deployment review; avoid duplicate messaging primitives. |
| CONNECT ENGAGEMENT: customer support, agent/queue/contact-centre operations | I-CONNECT product scope and specifications | Establish which functions are implemented versus specified; do not assume the full contact-centre product is complete. |
| CONNECT ENGAGEMENT: visual workflows, campaigns, chatbot/AI agent orchestration, CRM | No implementation verified in this discovery sample | New capability area, subject to checking the full repository for existing related modules before design. |
| Shared identity/device/session policy | Supabase Auth and FORTRESS device identity references | Map actual deployed contracts and enforcement before selecting a shared integration boundary. |
| Shared tenant/entity and RBAC | I-CONNECT organisation APIs/specification; other products require inspection | Do not invent a new tenant directory until current ownership and policies are verified. |
| Shared audit, billing, entitlements, secrets, API gateway | Referenced in specifications and root product scripts | Implementation and ownership remain unverified; inventory existing services before reuse or creation. |
| Runtime and deployment | I-CONNECT Node service, Supabase Edge Function, HOST documentation | Separate source/deploy targets; no deployment or NODE01 activation in this gate. |

## 6. Outstanding Gate 0 work — required before implementation

1. **Complete repository tree inventory.** Obtain an authoritative recursive tree or local read-only checkout, then enumerate all I-CONNECT files, tests, scripts, migrations, workflows, manifests and deployment configuration. This session's file-by-file inspection is not a substitute.
2. **Database inventory.** Enumerate every I-CONNECT and communications migration in order; inspect SQL definitions for tables, views, RPCs, triggers, grants, RLS policies, indexes, constraints and storage policies. Identify Supabase project/environment boundaries without exposing secrets.
3. **Tenant/security review.** Trace authentication and trusted organisation context through each API and RPC. Verify RLS and object-level authorization, especially provisioning, checkout, handover, provider calls, messaging and device revocation.
4. **Provider inventory.** Map adapter interfaces, real/sandbox/manual modes, credentials references, commercial evidence, capability limits, retries, webhooks, reconciliation and disabled actions. Confirm no simulator is represented as a live provider.
5. **Communications inventory.** Enumerate the `connectNNN.js` modules, schema, RPCs, RLS, storage, push, TURN and release configuration. Map overlapping I-CONNECT communications code before choosing a canonical implementation.
6. **Shared-service map.** Verify the actual code and data owners for IZAKHONO ID, FORTRESS, entity/tenant directory, RBAC, billing ledger, audit, entitlements, secrets and notifications. Distinguish implemented, deployed, documented-only and proposed capabilities.
7. **Baseline validation.** Run existing I-CONNECT and communications tests only in an approved safe development/CI environment, without production credentials or external provider side effects. Record exact commands, commit SHA and results.
8. **Deployment map.** Inspect CI workflows, Supabase deployment config, static/PWA hosting config, HOST runtime binding and current environment evidence. CI or repository state is not proof of a live runtime.
9. **Review and approve** a component map, data ownership matrix, API/event boundary plan, risk register and non-destructive implementation sequence before any code/schema work.

## 7. Non-negotiable safety controls

- No destructive consolidation, file moves, table renames, schema changes, data migrations or cross-domain direct table writes during discovery.
- Preserve all existing I-CONNECT customer, organisation, provider, order, billing and provisioning records.
- Do not activate carrier purchasing, top-ups, live provisioning, PSTN, SMS, eSIM or other provider functions without the relevant approvals and evidence.
- Keep secrets server-side; do not retrieve, print or copy secret values into discovery artefacts.
- Keep NODE01 as a logical software identity. Do not run NODE01 activation/bootstrap scripts or attempt deployment.
- No production release until approved HOST runtime access, complete acceptance evidence and explicit authorisation exist.
- Keep PR #721 in draft and unmerged while Gate 0 remains incomplete.

## 8. Current Gate 0 disposition

**Partially complete — component discovery has established the primary I-CONNECT and communications product locations and several critical implementation boundaries.**

**Not yet complete — recursive repository inventory, SQL/migration inventory, full RLS and tenant-security trace, communications module/schema inventory, shared-service ownership verification, deployment evidence and executed test baseline remain outstanding.**

The next safe action is to complete the full read-only tree and database migration inventory, then produce the final verified component/data-ownership map. No application implementation or runtime activation is authorised by this report.


## 9. Live I-CONNECT database inspection addendum — 2026-11-21

This addendum supersedes the earlier statement that the live database and applied migration history had not yet been inspected. Inspection was read-only through the connected Supabase project tools; no SQL writes, DDL, migrations, Edge Function deployments or data mutations were performed.

### Project and schema inventory

- Supabase project name: **I-CONNECT**; status reported **ACTIVE_HEALTHY**; region `eu-west-1`; PostgreSQL 17.11.
- Applied migration history: **371 migrations total**, of which **138** have I-CONNECT/`i_connect` names.
- Inspected schemas: `public` has **196 tables** and `iptv_private` has **24 tables**.
- All 196 public tables reported RLS enabled. None reported FORCE ROW LEVEL SECURITY.
- The `public` schema contains **72 `ic_*` tables**, all with RLS enabled.
- Those 72 tables have **107 RLS policies**. Twenty-one tables currently have no policy; the catalog query returned no `anon` or `authenticated` table grants for those 21 tables. They therefore appear intended for privileged/server-side access, but the service-role call paths and grants still require review before any client exposure.
- Four non-internal triggers were found on I-CONNECT tables: two onboarding payment/KYC triggers and two supplier-evidence activity/qualification-sync triggers.
- The inspected `public`/`ic_private` function set contains **111 I-CONNECT-named functions**; **99** are SECURITY DEFINER. The catalog check found no such SECURITY DEFINER function missing an explicit configured search_path. This is a configuration observation, not a complete function-security audit.

### Confirmed existing engagement and automation foundations

The live database already contains these I-CONNECT tables:

- Channel accounts/connections: `ic_channel_connections`.
- Contacts and channel identities: `ic_contacts`, `ic_contact_channel_identities`.
- Consent: `ic_contact_consents`.
- Unified inbox: `ic_inbox_threads`, `ic_inbox_messages`.
- Outbound communications governance: `ic_outbound_message_drafts`.
- Workflow automation: `ic_workflows`, `ic_workflow_versions`, `ic_workflow_runs`.
- Webhook ingestion: `ic_webhook_events`.

The applied migration history includes the following engagement/automation migrations (among others):

- `i_connect_ai_automation_foundation_v1`
- `i_connect_ai_workflow_save_rpc_v1`
- `i_connect_ai_workflow_test_execution_v1`
- `i_connect_ai_workflow_test_idempotency_fix_v1`
- `i_connect_ai_workflow_test_queue_limits_v1`
- `i_connect_ai_workflow_test_worker_recovery_v1`
- `i_connect_unified_inbox_foundation_v1`
- `i_connect_communications_retention_scheduler_v1`
- `i_connect_consent_history_append_only_v1`
- `i_connect_whatsapp_inbox_event_processor_v1`
- `i_connect_whatsapp_inbox_worker_api_v1`
- `i_connect_inbox_agent_handover_v1`
- `i_connect_inbox_internal_notes_v1`
- `i_connect_communication_permission_gate_v1`
- `i_connect_outbound_draft_human_approval_v1`

The Supabase table inventory reported zero rows for the inspected channel connections, contacts, contact-channel identities, contact consents, inbox threads/messages, outbound drafts, webhook events, workflows, workflow versions and workflow runs at inspection time. This is a schema/foundation finding, not proof of external channel readiness or a functioning customer-facing engagement service.

### Workflow and outbound-delivery maturity

Read-only inspection of the live RPC definitions establishes the following:

- `ic_save_workflow` saves organisation-scoped, versioned workflow graphs after owner/admin/manager authorisation.
- `ic_enqueue_workflow_test_run` explicitly queues only saved draft workflows as `manual_test`, marks the input as `mode: simulation`, applies an idempotency key and a per-organisation test-queue limit.
- `ic_claim_workflow_test_run` claims only `manual_test` runs and requires service-role worker credentials. `ic_finish_workflow_test_run` likewise requires worker credentials.
- Therefore, the inspected workflow engine is currently evidenced as a **workflow authoring and simulation/test-execution foundation**. A production trigger/action runtime, general-purpose automation worker, schedule/event execution path and retry/dead-letter operations have not been established by the inspected RPCs or deployed function inventory.
- `ic_create_outbound_message_draft` validates organisation membership, active contact, active channel connection, channel/purpose/type and assigned-thread rules. Its currently accepted channel values are WhatsApp, Instagram, Facebook Messenger, Telegram, website chat, email and SMS. TikTok is not in this inspected allow-list.
- `ic_review_outbound_message_draft` enforces manager review, maker-checker separation and a communication-permission check before approval; its response explicitly sets `delivery_enabled: false`. An approved draft is not evidence of a sent message or a live outbound channel.
- Inbox RPCs support role-checked assignment, claiming/releasing, queue, priority and status management, plus internal notes with audit events.
- The inspected engagement tables have RLS enabled. Authenticated access is selectively policy-controlled (for example, organisation-member reads and manager-controlled channel/workflow writes); webhook and outbound-draft storage are not directly granted to ordinary authenticated/anon clients in the inspected grant result.

### Deployed Edge Functions

The I-CONNECT Supabase project reports **25 active Edge Functions** in total. Ten are named `i-connect-*`, including provisioning, carrier control, MobiSIM adapter/webhook/event processing, staging checkout, admin overview and bootstrap-owner functions. `fortress-device-identity` is also active with JWT verification enabled. The separately named `connecta-engine` is active too, but its own session/account model means it must not be assumed to be the I-CONNECT automation worker or a shared IZAKHONO identity service without a separate review.

Several I-CONNECT worker/webhook functions report `verify_jwt=false` because they use their own application-level worker-token or provider-signature checks in the inspected source. Their exact endpoint-by-endpoint authentication, replay protection and deployment configuration remain a dedicated review item; the flag alone is not proof of a vulnerability or proof of safety.

No separately named I-CONNECT workflow-execution Edge Function appeared in the 25-function inventory. The `i-connect-provisioner` function is for connectivity provisioning and claims only the `ic-simulator` provider in the inspected source; it is not the CONNECT ENGAGEMENT workflow worker.

### Updated architectural conclusion

The correct path is **not** to create a second CONNECT ENGAGEMENT schema, contact store, inbox, consent ledger, channel registry or workflow authoring model. The existing I-CONNECT database already owns those foundations. CONNECT ENGAGEMENT should be treated as a bounded product division that progressively productises and completes the existing I-CONNECT engagement domain, subject to a reviewed service boundary and a distinct operational/tenant contract where needed.

The remaining gap is primarily verified production-grade orchestration and channel delivery, not an absence of all underlying data structures. The next technical discovery task is to inspect every engagement migration in order, review all related RPC definitions and Edge Function callers, map consent and retention semantics, and prove whether the workflow test runner can be safely evolved into a separately controlled production execution service. No implementation or schema change is authorised by this finding.


## 10. Supabase advisor snapshot — 2026-11-21

Read-only Supabase security and performance advisors were run against the I-CONNECT project. Findings are observations for review; no automatic remediation was applied.

### Security advisor

- The project-wide advisor reports **88** `rls_enabled_no_policy` INFO findings across multiple product schemas. This includes the 21 I-CONNECT tables listed above, as well as tables belonging to other products. RLS is enabled on these tables; the advisor reports the absence of policies, not public exposure. The I-CONNECT tables in this group had no `anon` or `authenticated` table grants in the inspected role-grant query.
- The advisor reports **10 WARN** findings for SECURITY DEFINER functions executable by `authenticated`. The I-CONNECT functions named are:
  - `ic_add_inbox_internal_note`
  - `ic_checkout_state_for_customer`
  - `ic_create_outbound_message_draft`
  - `ic_create_owner_organization`
  - `ic_create_staging_checkout_intent`
  - `ic_enqueue_workflow_test_run`
  - `ic_list_my_organizations`
  - `ic_manage_inbox_thread`
  - `ic_prepare_checkout_intent_for_customer`
  - `ic_review_outbound_message_draft`

The warning means the functions are callable by authenticated clients and execute with definer privileges; it does not by itself prove an exploitable flaw. Several inspected functions explicitly check `auth.uid()`, active organisation membership, role, assigned-thread ownership, maker-checker separation and/or communication consent. All 99 I-CONNECT SECURITY DEFINER functions in the earlier catalog query had a configured search_path. A full function-by-function review must still verify execute grants, caller identity, organisation scoping, input validation, side effects and negative cross-tenant tests before these RPCs are accepted as the CONNECT shared engagement API.

### Performance advisor

The project-wide advisor also reports 87 unindexed foreign keys, 190 unused indexes and 7 duplicate-index groups. Some findings touch I-CONNECT tables (including carrier health checks, service provisioning jobs, worker dispatch outbox, inbox and workflow tables). Unused-index findings on empty engagement tables are not a basis for dropping indexes. Do not remove or alter indexes during CONNECT discovery; any eventual performance remediation needs workload evidence, migration review and regression testing.

### Gate 0 disposition update

The live schema, applied migration list, deployed Edge Function inventory, engagement RPC foundations, RLS policy metadata and advisor snapshots are now recorded. Remaining discovery is narrower but still material: review the source of each relevant migration and SECURITY DEFINER function, inspect all I-CONNECT and communications Edge Function call paths, establish the full repository/deployment tree, and run the existing safe test baseline. The advisor findings are review gates, not authorisation to change the database.


## 11. RPC authorisation review and verified inbox role-boundary defect

The ten I-CONNECT SECURITY DEFINER functions flagged by Supabase were inspected at definition level, including their argument signatures and ACLs. The review distinguishes a concrete role-boundary defect from functions whose current source shows caller/tenant checks.

### Confirmed issue requiring a corrective migration

**Finding IC-SEC-001 — inbox claim is not role-restricted (medium severity; remediation required before broad agent rollout).**

- Function: `public.ic_manage_inbox_thread(uuid, uuid, text, uuid, text, text, uuid)`.
- Execute ACL includes `authenticated`.
- The function checks `auth.uid()` and an active membership in the supplied organisation, then locks a thread constrained by both thread ID and organisation ID.
- In the `p_action = 'claim'` branch, it rejects a thread already assigned to a different user and assigns the caller, but does not check `v_role`.
- The live `ic_memberships_role_check` constraint permits `owner`, `admin`, `manager`, `agent`, `dispatcher`, `finance`, and `viewer`.
- Therefore, any active member in one of those roles can reach the claim branch, including finance/viewer roles, subject to the organisation/thread match. This is a confirmed missing role check in the function definition; no exploit attempt or data mutation was performed.
- The intended role matrix must be agreed (likely operational roles such as owner/admin/manager/agent and possibly dispatcher), then enforced in SQL before changing the live function. Negative tests must prove viewer/finance and cross-organisation callers are rejected, and valid agent/manager claim/release behaviour remains intact.

**No live fix was applied.** Do not patch the function ad hoc in the dashboard. Prepare a versioned, reviewed migration with regression tests and a controlled release/rollback plan after Gate 0.

### Other reviewed I-CONNECT RPCs

| Function | Verified source-level control | Review result |
|---|---|---|
| `ic_add_inbox_internal_note` | Active organisation membership; manager roles or the assigned agent only; thread scoped to organisation; bounded body; audit event. | No immediate role-boundary defect identified in inspected body. |
| `ic_checkout_state_for_customer` | Requires authenticated user; compares checkout intent's `metadata.created_by` with caller; removes external reference from returned state. | Ownership check present; inspect downstream customer-state helper separately. |
| `ic_create_outbound_message_draft` | Active role allow-list; active organisation contact/channel; thread/contact/connection match; agent must own assigned thread when thread supplied. | Controls present; validate channel-specific consent and service-window semantics in full lifecycle review. |
| `ic_create_owner_organization` | Requires authenticated user; validates name/slug; prevents another active owner organisation for same user; creates caller's owner membership and audit event. | Self-service owner onboarding path; confirm global one-owner rule is intentional. |
| `ic_create_staging_checkout_intent` | Requires authentication; validates customer fields and active connectivity product; records staging environment and created_by. | Staging-only intent; no live payment execution evidenced. |
| `ic_enqueue_workflow_test_run` | Uses `ic_private.has_role` for owner/admin/manager; organisation-scoped draft workflow; idempotency key; per-org queue cap; hard-coded simulation mode. | Test/simulation path only; no production trigger/action worker evidenced. |
| `ic_list_my_organizations` | Requires authentication and filters memberships by `auth.uid()` and active status. | Caller-scoped listing. |
| `ic_manage_inbox_thread` | Active membership and organisation-scoped thread; branch-specific checks for release/status/priority/queue/assign. Claim branch has no role allow-list. | **IC-SEC-001 confirmed.** |
| `ic_prepare_checkout_intent_for_customer` | Requires authentication; validates details; creates intent with caller in metadata; returns `payment_ready: false`. | No live payment path evidenced. |
| `ic_review_outbound_message_draft` | Manager allow-list; organisation-scoped pending draft; maker-checker separation; consent check; audit event; `delivery_enabled: false`. | Human review gate exists; approved draft is not delivery. |

This is a source-level review, not a complete adversarial audit. It does not replace cross-tenant tests, role-matrix tests, PostgREST execution tests or review of every downstream helper.

## 12. Separate IZAKHONO CONNECT communications/workspace platform — live project review

The browser/PWA product at `products/izakhono-connect/` points to a **different Supabase project** from I-CONNECT:

- Project: **IZAKHONO WebStart**, ref `yfawrenhudjomhnglfhq`, status `ACTIVE_HEALTHY`, region `eu-west-1`, PostgreSQL 17.6.
- Project inventory: **798 public tables** and **673 applied migrations**.
- The inspected `connect_*` domain contains **25 tables**, all with RLS enabled, covered by **48 RLS policies**; none of those 25 tables lacked a policy in the catalog snapshot.
- This database also contains a separate `connecta_*` social/community domain. Do not conflate `connecta-engine` or `connecta_*` accounts/sessions with IZAKHONO ID or the CONNECT communications client.

### Communications and workspace capabilities already present

The static browser application `products/izakhono-connect/index.html` loads `app.js` and versioned modules `connect004.js` through `connect031.js` (with numbering gaps). The modules and live schema show multiple distinct capability groups:

- Core direct/group conversation messaging, receipts, presence, devices and WebRTC call signalling.
- Workspace/channel membership and task/workspace collaboration.
- Task activity, prioritisation, workload and executive views.
- Command queue, role access, governance, approvals and execution-link tables.
- Browser-side client access uses a Supabase publishable key; no service-role key is embedded in the inspected entry point. The project README explicitly does not claim audited end-to-end encryption.

The live `connect_*` tables are separate from I-CONNECT's `ic_inbox_*` and `ic_contacts` engagement domain. They live in another Supabase project with a different schema and migration history. Integration must therefore be through authenticated, versioned APIs/events and explicit ownership mapping; no direct cross-project SQL joins or silent record migration.

### Verified communications readiness limitations

- README and infrastructure docs state that owned TURN, verified push delivery, media storage/attachment policy and UX, native Android/iOS signing, and real-device/network integration testing remain incomplete.
- TURN documentation says the platform remains STUN-first until the owned TURN activation gate is completed and tested.
- Push documentation says no delivery should be claimed until an owned sender/adapter and server-side credential flow are provisioned and tested.
- The mobile package is a Capacitor 7 shell with push plugin configuration; no store-signing or native release evidence was established in this inspection.
- The CI workflow `.github/workflows/izakhono-connect-ci.yml` checks `app.js` syntax, mobile package JSON, Capacitor config, manifest, secret-pattern guardrails and infrastructure docs. It does **not** syntax-check the versioned `connectNNN.js` modules or run communications/RLS/realtime/real-device integration tests.
- Several task/workspace modules call `connect_mark_overdue_tasks` and `connect_record_task_activity` from the browser. In the live database snapshot, both functions are SECURITY DEFINER and executable only by `service_role`. The browser-authenticated calls therefore do not have execute permission under the observed ACL. The UI call sites need to be reconciled with the intended service-worker/direct-RLS write path; do not simply grant authenticated execution. In particular, `connect_mark_overdue_tasks` updates all overdue tasks and has no caller/tenant filter in its body, so it must remain privileged and be invoked only by a trusted scheduled worker.
- The live `connect_execute_command` RPC is not SECURITY DEFINER and updates a task through ordinary table privileges/RLS; the inspected task RLS policies scope it to workspace members. The governance and approval RPCs include explicit role checks in the inspected definitions.

### Repository-to-database migration source gap

The recursive Git tree for `bevanshelton-netizen/izakhono-builder` was inspected (4,178 paths; GitHub reported the tree was not truncated). It contains seven root `supabase/migrations/*.sql` files and seven I-CONNECT `products/i-connect/deploy/migrations/*.sql` files. The live I-CONNECT database reports 371 applied migrations and IZAKHONO WebStart reports 673. The November 12 I-CONNECT engagement migrations and many of the CONNECT workspace/governance migrations appear in the live ledgers but are not present as corresponding SQL source files in this repository tree.

This is a material source-of-truth/reproducibility gap. The migration files may be held in another controlled repository or deployment system; their location has not been established. Before any schema change, identify the authoritative migration source, recover and checksum the complete history, map each live migration to its source/commit, and prove a clean replay path in an isolated non-production project. Do not reconstruct and apply missing historical migrations from live catalog definitions as a substitute for provenance.

## 13. Updated Gate 0 decisions and priority order

1. **Contain and remediate IC-SEC-001** through a reviewed migration and role-matrix regression tests before enabling broad inbox use. No live change in this discovery step.
2. Establish the authoritative migration source for both Supabase projects and reconcile live migration ledgers with version-controlled SQL.
3. Define which data remains owned by I-CONNECT engagement (`ic_*`) and which remains owned by CONNECT communications/workspaces (`connect_*`); define customer/contact/conversation linking via opaque stable IDs and authenticated events.
4. Repair the browser/service-role RPC call mismatch safely. Keep global scheduled mutations privileged; add narrow authenticated operations only when they are tenant-scoped and positively tested.
5. Add syntax/unit/integration checks for every `connectNNN.js` module and test RLS, realtime, receipts, call signalling, push and workspace governance.
6. Complete channel adapters, consent/template/service-window policies, production workflow workers, human handover and delivery receipts in I-CONNECT without creating duplicate foundations.
7. Keep both existing Supabase projects separate until an approved data ownership and migration decision proves otherwise.

**Updated Gate 0 status: materially advanced, still open.** We have verified the principal product and database boundaries, identified a concrete inbox role-boundary defect and client/service-role mismatch, and identified migration-source provenance as a release blocker. No production SQL, data, application code or provider state has been changed.


## 14. Migration-source search follow-up — 2026-11-21

The linked GitHub account's accessible repository inventory was rechecked. Eight repositories are currently visible: `Downloads`, `the-chancellor`, `allegro-vibez`, `edubuild-ecd360`, `SHELTON-FORTRESS`, `bevanshelton-netizen-legacymart`, `nextradefinx`, and `izakhono-builder`. No additional dedicated migration-source repository is visible in that inventory.

The GitHub connector reports code-search indexing unavailable (`is_code_search_indexed: false`) for the listed repositories. Exact searches for the known live migration/function identifiers returned no matches, but those empty search results are **not proof that the source does not exist** because repository code-search indexing is unavailable. The scan is limited to repositories visible to the linked account and the search capabilities available in this session.

**Current conclusion:** the authoritative migration source remains unidentified. The next required input is the exact repository, deployment artifact store, or controlled backup location that owns the complete SQL histories for I-CONNECT and IZAKHONO WebStart, together with read access. Once located, recover the full histories, checksum them, map migration versions to commits, reconcile both live ledgers, and establish clean replay in isolated non-production projects.

No migration files were reconstructed, no database writes/DDL or data changes were performed, and no deployment or production changes were made as part of this follow-up.


## 15. Communications CI syntax-coverage improvement — 2026-11-22

The existing `.github/workflows/izakhono-connect-ci.yml` was inspected. Its browser JavaScript syntax step checked only `products/izakhono-connect/app.js`, despite the product loading separately numbered `connectNNN.js` modules.

The workflow now includes a fail-closed Bash step that:
- discovers all files matching `products/izakhono-connect/connect[0-9][0-9][0-9].js`;
- fails if no versioned modules are found; and
- runs `node --check` on every discovered module.

This is a CI configuration change only. The workflow has been committed but **has not yet been observed passing in GitHub Actions**; no test pass is claimed. It adds syntax coverage, not runtime, browser, RLS, realtime, WebRTC, push-delivery or security integration coverage. Those remain separate validation gates.
