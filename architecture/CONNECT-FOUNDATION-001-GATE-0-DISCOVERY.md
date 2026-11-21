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
