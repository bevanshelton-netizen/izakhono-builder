# IZAKHONO Adversarial Security Prompt Pack

These prompts are mandatory evidence requests for AI-built applications. The agent must inspect the actual code, create or run tests, show the failing case where applicable, fix the issue, and re-run the test. A verbal claim of security is not evidence.

## 01 — Threat-model the application

> Map the trust boundaries in this application. Identify browser-controlled input, authenticated identity, privileged server actions, database writes, payment providers, paid APIs, webhooks, secrets, and admin operations. For each boundary, state what must be trusted and what must never be trusted. Do not give me a generic security checklist; point to the actual files, routes and functions.

## 02 — Ownership on every route

> List every API route and show where it verifies that the authenticated caller owns the resource being read, changed or deleted. Flag every route that trusts `userId`, `ownerId`, `accountId` or equivalent identity from request body, query string or client parameters. Write an adversarial test where User A creates a resource and User B attempts to read, update and delete it. The test must prove the server returns 403 or 404 and that User A's resource remains unchanged.

## 03 — Checkout trusts the server

> Trace every price and amount used by checkout, invoices, subscriptions or charges. Prices must be resolved server-side from a trusted product/price identifier; never trust an amount supplied by the browser. Show the exact source of truth. For Stripe webhooks, verify the signature against the raw request body before acting on the event. Write tests for a forged amount and an invalid webhook signature and show the rejection response.

## 04 — Rate limits on auth and paid routes

> Identify login, signup, password reset, account recovery, AI/paid API and payment routes. Add rate limiting appropriate to the threat and cost of each route. Show the configured limit and keying strategy. Write a test that exceeds the limit and prove the server returns HTTP 429. Ensure legitimate users are not blocked by a global anonymous counter when per-user/per-IP controls are more appropriate.

## 05 — No secrets in the browser

> Trace all environment variables and credentials used by the application. Identify anything that could reach a browser bundle, client component, HTML response or public API. Secrets must remain server-side. Flag public variables that contain secret/private keys, tokens or passwords. Prove that production secrets are not emitted into client bundles or logs.

## 06 — Abuse and cost controls

> Find every route that can trigger paid APIs, large database queries, file processing, email/SMS, AI inference or expensive background work. For each one, identify authentication, authorization, rate limiting, payload limits, timeout controls and idempotency. Create at least one abuse test for the highest-cost route and show that repeated or oversized requests are controlled.

## 07 — Prove it with failing tests

> Do not tell me the application is secure. Prove the important claims with tests. Create adversarial tests for cross-user access, forged payment amounts, invalid webhooks, rate-limit exhaustion, unauthenticated privileged actions and secret exposure where applicable. Run the tests. If a test fails, fix the application and run it again. Production deployment is permitted only when the required security tests pass.

## Deployment decision

The agent must return exactly one of:

- **SECURITY GATE: PASS** — static audit has no blocking findings and required adversarial tests pass.
- **SECURITY GATE: BLOCKED** — one or more critical/high findings or required tests fail.
- **SECURITY GATE: WAIVED** — a human-approved exception exists with scope, reason, owner and expiry. Waivers do not silently convert a failure into a pass.
