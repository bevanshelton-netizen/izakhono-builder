# IZAKHONO MOBILE INTELLIGENCE

A modular, Android-first mobile platform with a shared identity, security foundation and three initial modules: Privacy, Automate and Social Intelligence.

## Release 1 scope

- Shared account and organisation context, integrating with the existing IZAKHONO customer identity/session layer.
- Privacy dashboard based on user-visible Android permission and security information.
- Automation Studio with explicit triggers, conditions, allowlisted actions and execution history.
- Social Intelligence for authorised accounts and permitted public sources only.
- Notification inbox and subscription entitlements.

## Product boundaries

This product does not implement covert recording, hidden surveillance, private-account scraping, bypassing blocks, credential harvesting, or silent permission escalation. Device permissions must be requested through Android's supported user-facing mechanisms. Automation actions must be visible, consented to, auditable and revocable.

## Architecture

- Android: Kotlin + Jetpack Compose (planned client).
- Customer/admin portals: Next.js (planned).
- Shared service contracts: TypeScript in `src/`.
- Identity: integrate with the existing IZAKHONO customer auth/session system; do not invent a second password store.
- Persistence: existing owned-first database/runtime after schema and tenancy review.
- Jobs: durable queue/worker; never rely on in-process timers for production scheduling.
- Security: authentication, organisation-scoped authorization, request size limits, durable rate limits, audit events and idempotency.

## Current implementation status

The directory now contains typed module contracts, automation definition validation and deterministic execution planning, plus an Android Kotlin/Jetpack Compose preview application with Home, Privacy Centre, Automation Studio and Social Intelligence screens. A guarded GET endpoint at `/api/mobile-intelligence/session` resolves an existing customer session and returns account profile data without treating the organisation display label as tenant authorization. The Android source includes an HTTPS-only bearer session API client; the caller supplies a token in memory. An explicit organisation and membership schema plus a fail-closed membership resolver now separate tenant authorization from the legacy organisation display label. Membership access requires an active customer, active organisation and active membership row; no membership is automatically inferred or granted. The Android screens are not connected to a production API, customer account, native permission inventory, social provider or live automation executor. No signed release or production deployment is claimed.

## Local checks

From the repository root, run `npm run mobile-intelligence:typecheck` and `npm run mobile-intelligence:test` (including organisation membership authorization tests). Build the Android debug APK from `products/izakhono-mobile-intelligence/android` with Gradle 8.11.1 and JDK 17 using `gradle assembleDebug`. The dedicated GitHub Actions workflow runs both the TypeScript checks and Android debug build.

## Release gates

1. Identity adapter verifies real server-side sessions.
2. Tenant authorization enforced on every data operation through explicit `builder_organisations` and `builder_organisation_memberships` records; migration `0025_mobile_organisation_memberships.sql` is staged but not applied to a live database.
3. Durable distributed rate limiting and payload limits.
4. Database migrations and row-level/tenant isolation tests.
5. Android runtime permission and lifecycle tests on physical devices.
6. Provider OAuth and webhook verification tests.
7. Security review, backup/restore and customer acceptance.
