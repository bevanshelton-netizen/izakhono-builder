# Portfolio-wide GitHub and Vercel completion audit
**Audit date:** 2026-11-10  
**Owner:** IZAKHONO AFRICA  
**Purpose:** Establish an evidence-led completion programme for all accessible software projects. This is an audit and work plan, not a claim that the projects are complete.

## Executive findings

- GitHub account inventory returned **8 accessible repositories**:
  - `bevanshelton-netizen/Downloads`
  - `bevanshelton-netizen/the-chancellor`
  - `bevanshelton-netizen/allegro-vibez`
  - `bevanshelton-netizen/edubuild-ecd360`
  - `bevanshelton-netizen/SHELTON-FORTRESS`
  - `bevanshelton-netizen/bevanshelton-netizen-legacymart`
  - `bevanshelton-netizen/nextradefinx`
  - `bevanshelton-netizen/izakhono-builder`
- Vercel inventory returned **159 projects** across two pages (100 + 59). The projects include production candidates, preview/staging builds, experiments and apparent product variants. They must be classified before any bulk deployment, deletion, rename or consolidation.
- Supabase inventory returned four projects: I-CONNECT and IZAKHONO WebStart were `ACTIVE_HEALTHY`; FAISReady and Edu-Build Institute 360 were `INACTIVE` at audit time. Inactive must be investigated before assuming data loss or restoring/pausing anything.
- Several Vercel projects' latest deployments were `READY` but had `target: null`; several project records also reported `live: false`. A READY preview is not proof of a production release.
- Allegro-Vibez had a latest deployment with target `production` and custom domains `allegrovibez.com` and `www.allegrovibez.com`; it still needs end-to-end smoke, content rights, account, payment and operational verification.
- Deployment history shows multiple named Vercel projects receiving deployments from the same `izakhono-builder` GitHub repository and shared commits. This may be an intentional multi-project/monorepo arrangement, but root directories, build commands, output paths, environment variables and domain mappings must be verified per project.
- Several projects have SSO protection enabled on the Vercel project. This can make preview URLs inaccessible to public customers even when a deployment is READY. Confirm intended protection and custom-domain behaviour before changing it.

## Repository findings from README/package inspection

### IZAKHONO Builder
- Positioned as the owned-first, credits-free application factory and infrastructure control plane.
- README explicitly states that full arbitrary application/code generation is not complete until model-backed code generation, broader templates, deployment execution and end-to-end customer acceptance pass.
- Existing CI includes extensive repository-contract and generated-worker checks, but must be run against the current main commit and reviewed for actual results.
- Core acceptance target: idea → plan → scaffold → build → test → evidence → release candidate → verified deployment. Never label a release candidate as deployed.

### Allegro-Vibez
- README describes a responsive public foundation, Creator OS catalogue, publishing review and ALLEGRO Live.
- README explicitly says publishing review is not proof of DSP distribution, royalty payment, live event inventory, bookings, ticketing or settlements. Those integrations and rights gates remain separate.
- Complete launch validation: route smoke tests, Supabase/auth integration, creator ownership and rights, audio/media storage, moderation, payments, payout controls, backups and production HTTPS checks.

### Edu-Build ECD360
- README describes a broad multi-centre ECD operating platform and a privacy-conscious architecture.
- Repository itself says it remains pre-production until container, health, rehearsal and owned-infrastructure gates pass.
- Child/family access, safeguarding, guardian consent, payment verification, payroll and partner integrations require explicit security and privacy verification. Do not use live child data in test environments.

### SHELTON FORTRESS
- README describes a privacy-first digital trust/business technology health platform with a Windows agent, API and signed heartbeat.
- Validate enrollment, token protection, replay resistance, tenant isolation, device lifecycle, bank-edition boundaries, monitoring, backup and incident response before any external security claims.

### The Chancellor
- README describes a business growth desk with adviser, paid audit, client portal, uploads and PayFast flows.
- README warns that PayFast must remain sandbox until return/cancel/ITN flows pass, and that JSON storage is single-server only. Production scale requires shared database/object storage, malware scanning and source validation.

### LegacyMart
- README describes a marketplace foundation, but the current repository still contains the original Faith Personified checkout/PayFast handoff and demo listings.
- Remaining stated work includes production database/auth wiring, seller image storage, shipping, storefront URLs, moderation, messaging, VAT/tax, and verified payout orchestration. Seller payouts must remain disabled until gateway, KYC/KYB, refunds, disputes, settlement and accounting are verified.

### NexTradeFinX
- README places repository setup on security hold until repository visibility is Private. The Vercel project has a READY deployment, but that does not override the GitHub security hold or establish a production launch.
- Confirm repo privacy and data/credential handling before proceeding. Do not put secrets in source control.

### Downloads
- Root README was not found. Treat as a source/asset repository until its contents and Vercel links are classified. Do not delete or repurpose it based on its name.

## Vercel project clusters requiring classification

Key named projects observed include:
- Product factory and infrastructure: `izakhono-website-factory`, `izakhono-builder-demo`, `izakhono-webstart`, `izakhono-webstart-sites`, `izakhono-cloud`, `izakhono-host`, `izakhono-forge-x20`, `izakhono-app-factory`, `izakhono-engineering-studio`.
- Payments, customer operations and automation: `izakhono-pay`, `izakhono-pay-recurring`, `izakhono-sales-engine`, `izakhono-sales-engine-v3`, `izakhono-crm-factory`, `izakhono-business-engine`, `izakhono-business-command`, `izakhono-execution-os`, `izakhono-agentflow-prod`, `izakhono-mail-engine`, `izakhono-mail-provisioner`.
- Core platforms: `kora-network`, `kora-global-command`, `allegro-vibez`, `allegro-studios`, `yhvh-gospel-tv`, `izakhono-nav`, `shelton-fortress`, `izakhono-fortress-intelligence`, `izakhono-connect`, `izakhono-connect-control`, `shelton-freight-group`, `sheltonair`.
- Education and specialist products: `edu-build-institute`, `edu-build-360`, `edubuild-online-classroom`, `edubuild-online-university`, `faisready-site`, `faisready-revenue`, `nextradefinx`, `the-business-of-music`, `the-business-of-music-market`, `the-business-of-music-store`, `the-business-of-music-delivery`, `the-business-of-music-fulfillment`.
- Additional experiments and campaigns include `videonomy`, `videonomy-beta`, `auto-ai`, `worknow-sa`, `yenzanow`, `soundlab-ai`, `proofforge-ai`, `revenueforge-ai`, `learner-driver-sa`, `matric-rewrite-prep-academy`, and many others.

This is a representative cluster list, not the complete 159-name export. The Vercel dashboard remains the authoritative source for the full project list.

## Completion standard

A project is **not complete** merely because code exists, GitHub contains a repository, or Vercel reports READY.

For each product, record evidence for:
1. Product owner, purpose, customer and supported scope.
2. Canonical repository, branch, commit, licence and source/IP ownership.
3. Build, lint, typecheck, unit, integration and end-to-end test results.
4. Dependency and secret scans; no credentials committed.
5. Environment-variable names and configuration ownership (never export secret values into this audit).
6. Database schema/migrations, row-level security, tenant boundaries and backup/restore evidence.
7. Payment provider configuration, signed webhook verification, idempotency, reconciliation, refunds and subscription lifecycle.
8. Domain mapping, DNS, TLS, redirects and public access/protection behaviour.
9. Deployment target, commit SHA, build logs, health endpoint and smoke-test evidence.
10. Monitoring, alerting, error handling, support route, incident response and recovery runbook.
11. Customer data/privacy, legal terms, accessibility and any sector-specific safety/compliance gates.
12. Handover: admin guide, customer guide, known limitations and rollback procedure.

## Work sequence

### Phase A — Inventory and protect (first)
- Export the full GitHub repository list and full Vercel project list.
- Map each Vercel project to its actual repository, branch, root directory, framework, build command, output directory, domains and environment configuration.
- Mark each project: canonical product, shared service, staging, preview, experiment, duplicate, archived candidate or unknown.
- Snapshot current deployments, domains and project settings before changes.
- Confirm GitHub backups and owned-infrastructure backups. Keep GitHub as a rollback/source mirror until IZAKHONO-owned runtime and restore evidence is proven.

### Phase B — Complete shared commercial foundation
- Prioritise IZAKHONO Builder/Website Factory, WebStart/Provisioner, product catalogue/marketplace and the subscription/payment/entitlement layer.
- Establish one canonical identity, tenant model, audit log, customer support flow and product provisioning contract.
- Use iKhokha as the preferred payment gateway where supported and approved; test actual merchant/webhook behaviour before enabling live transactions.
- Keep flat-rate plans with transparent fair-use and cost controls.

### Phase C — Product completion waves
1. Website Factory / Builder / WebStart / Provisioner.
2. Payment, subscription, customer identity, CRM and support foundations.
3. KORA, Allegro-Vibez and YHVH Gospel.
4. FORTRESS and I-CONNECT.
5. Edu-Build ECD360 and FAISReady.
6. NAV, freight, SheltonAir, The Chancellor, LegacyMart, NexTradeFinX and remaining products/experiments.

Each wave must pass the same completion standard. High-risk products receive domain-specific privacy, legal and safety review.

### Phase D — Controlled release
- Release to preview first.
- Run build and end-to-end tests on the exact commit.
- Promote only the tested production build after verifying domains, access controls, environment configuration, payment state and rollback.
- Do not bulk-promote all 159 projects.
- Do not change visibility, SSO, security, billing or ownership settings without confirming the intended customer access and impact.
- Do not delete or archive duplicates until the canonical replacement, data retention and rollback path are verified.

## Current blockers and cautions
- The GitHub connector exposes repository metadata and file operations, but a full build/test environment is needed to execute every repository's full test suite reliably.
- A deployment can be READY while its target is Preview, while SSO blocks public visitors, or while backend/payment integrations are incomplete.
- Supabase projects marked INACTIVE need diagnosis; do not assume they can be restored without checking project state, backups and billing implications.
- Any provider quota, credit or account restriction must be solved through legitimate account/infrastructure planning, not by bypassing provider security or billing controls.

## Immediate next actions
1. Complete the full 159-project mapping, including project-to-repository relationships and deployment targets.
2. Run current CI for each canonical repository and collect failing tests/build logs.
3. Fix blockers in the shared Builder/Website Factory foundation first.
4. Complete one end-to-end customer purchase and provisioning journey in a controlled test environment.
5. Repeat product-by-product with evidence, then promote only validated production releases.
