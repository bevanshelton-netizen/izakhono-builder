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

This directory is the first source foundation: typed module contracts, automation definition validation and deterministic execution planning. It is not yet an Android app, deployed API, production identity integration, or live automation executor.

## Local checks

Use the repository's pinned TypeScript/tsx toolchain. The product's pure logic tests are designed to run without credentials or external services.

## Release gates

1. Identity adapter verifies real server-side sessions.
2. Tenant authorization enforced on every data operation.
3. Durable distributed rate limiting and payload limits.
4. Database migrations and row-level/tenant isolation tests.
5. Android runtime permission and lifecycle tests on physical devices.
6. Provider OAuth and webhook verification tests.
7. Security review, backup/restore and customer acceptance.
