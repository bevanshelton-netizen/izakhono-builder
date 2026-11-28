# Existing Construction Reconciliation — 2026-11-28

This record maps major open work packages discovered during recovery. These are existing assets; avoid creating duplicates. An open PR is not a merged or deployed product.

## FORTRESS open work

- [PR #150 — FORTRESS Compliance Intelligence public portal](https://github.com/bevanshelton-netizen/SHELTON-FORTRESS/pull/150): current build; static portal and architecture boundary. Vercel project created; deployment still blocked by daily API quota. Authenticated operations platform remains future work.
- [PR #149 — FORTRESS African Economic Unity](https://github.com/bevanshelton-netizen/SHELTON-FORTRESS/pull/149): public static initiative is READY at Vercel; source synchronization, repository connection and privacy-reviewed expression-of-interest flow remain.
- [PR #148 — FORTRESS Global Asset Management](https://github.com/bevanshelton-netizen/SHELTON-FORTRESS/pull/148): existing read-only portfolio analytics, Decimal-safe valuation, concentration/exposure, deterministic shocks and reconciliation API. No live market data, execution, custody or advice.
- [PR #147 — FORTRESS financial core reconciliation](https://github.com/bevanshelton-netizen/SHELTON-FORTRESS/pull/147): mandatory migration reconciliation before financial-core implementation. Existing main already has two Alembic heads; historical PRs #68/#69 each introduce colliding 0015 migration histories. Do not merge those branches wholesale. Build one tested linear migration graph based on current main.
- [PR #144 — DOXA-SURE independent persistent engine](https://github.com/bevanshelton-netizen/SHELTON-FORTRESS/pull/144): an existing separate insurance/policy engine with clients, policies, assessment and incident-notice records. It is not evidence of a brokerage brand or a trading platform. It remains private-network-only pending FORTRESS auth, tenant context, rate limiting, audit integration, backup/restore and acceptance. Do not rename it or merge it into NexTradeFinX.
- [PR #143 — FAISReady independent persistent engine](https://github.com/bevanshelton-netizen/SHELTON-FORTRESS/pull/143): existing RE education/examination engine; preserve its separate product boundary and verify its CI/persistence gates.
- Additional open FORTRESS work includes owned MAIL, Creative Suite, KORA, audit attestation, AI key custody/adjudication, CyberGuard and commerce/ledger work. Review dependency order and migration/security implications before merge.

## IZAKHONO platform open work

- [PR #821 — Portfolio recovery and integration control plane](https://github.com/bevanshelton-netizen/izakhono-builder/pull/821): this recovery register.
- [PR #819 — HOST/MAIL control-plane and encrypted restore tests](https://github.com/bevanshelton-netizen/izakhono-builder/pull/819): PR description reports relevant CI workflows passing at the stated head; that is not proof of live hosting/mail delivery.
- [PR #817 — NODE01 Stalwart hosting/provisioning](https://github.com/bevanshelton-netizen/izakhono-builder/pull/817) and [PR #816](https://github.com/bevanshelton-netizen/izakhono-builder/pull/816): review for duplicate/overlapping implementation before merging one canonical path.
- [PR #813 — separate $7 Topic PDF Publishing Programme](https://github.com/bevanshelton-netizen/izakhono-builder/pull/813): substantial existing product branch. Includes international storefront, arbitrary-topic intake, customer auth foundation, editorial/specialist review gates, private PDF renderer, customer library and entitlement-gated download design, evidence ledger and go-to-market materials. Remaining gates: transactional email credentials, research/model adapter credentials, R2/private renderer configuration, migrations 0032–0038, verified checkout/payment/refund webhooks, entitlement grants, account recovery/deletion, legal/tax/consumer review and end-to-end production tests. It remains draft; no public sale or live payment. This is the authoritative known workstream for the $7 topic-PDF programme, distinct from full-length books.
- [PR #774 — Shared Platform Contracts v1](https://github.com/bevanshelton-netizen/izakhono-builder/pull/774): documentation-only contract baseline, stacked on PR #762. Resolve dependency/base before treating it as canonical.
- [PR #766 — Integration Fabric architecture v1](https://github.com/bevanshelton-netizen/izakhono-builder/pull/766): Phase 0 audit found the Super Engine bus is synchronous/in-process and not yet a durable multi-tenant enterprise integration backbone. Reuse existing queue/event-store patterns but do not relabel the current bus as production-ready. Implement persistence, tenant scope, mandatory FORTRESS/audit, idempotency, replay, retry and dead-letter gates before external connectors.
- [PR #762 — Intelligent Operating Ecosystem architecture](https://github.com/bevanshelton-netizen/izakhono-builder/pull/762): dependency for shared platform contract work.
- Further open work covers HOST, MAIL, DNS, EDGE, DEPLOY, ID, PAY, NAV, Commerce, Creator, AI workforce, Business Studio, KORA, I-CONNECT and the Builder's native generation/worker pipeline. These should be reconciled against main and tested as dependency groups, not merged en masse.

## Edu-Build

- [PR #123 — EduGrow capability parity baseline](https://github.com/bevanshelton-netizen/edubuild-ecd360/pull/123): repository and infrastructure audit; dedicated Supabase project is INACTIVE.
- [PR #122 — EDU-BUILD ONE admissions foundation](https://github.com/bevanshelton-netizen/edubuild-ecd360/pull/122).
- [PR #120 — EDU-BUILD Online Campus learner experience](https://github.com/bevanshelton-netizen/edubuild-ecd360/pull/120).
- [PR #111 — EDU-BUILD ECD360 global makeover](https://github.com/bevanshelton-netizen/edubuild-ecd360/pull/111).

## Deployment quota and flood limits

Multiple Vercel bot comments across PRs #813, #766, #144 and #143 show account deployment daily quota/flood-rate errors. Batch deployment work after quota reset and avoid creating redundant previews. This recovery programme does not request a plan upgrade or paid spend.

## Merge and release policy

1. Read full PR diff, reviews, CI and dependency graph.
2. Identify duplicate branches/PRs and choose one canonical implementation.
3. Run tests and migration graph validation from the target base.
4. Merge only small, dependency-ordered work packages.
5. Deploy previews in a controlled batch after quota reset.
6. Verify route, DNS/TLS, auth, tenant isolation, persistence, backup/restore and acceptance.
7. Promote only the specific product version whose release evidence is complete.
