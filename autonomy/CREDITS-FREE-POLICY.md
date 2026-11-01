# IZAKHONO Credits-Free Execution Policy

## Decision

IZAKHONO BUILDER, the IZAKHONO AI Agent runtime, the native Builder adapter, Software NODE scheduler, and native execution control plane do **not** use an artificial credits system.

There is no IZAKHONO AI-credit balance, action-credit meter, pay-per-action counter, token-credit wallet, or internal quota that stops native work because a user has exhausted credits.

## What this means

- Native Builder execution is capability-and-evidence based.
- AI Agent progression is governed by dependencies, safety gates, credentials, security, infrastructure capacity, and verification evidence — not credits.
- Software NODE scheduling is governed by node health, readiness, capacity, and policy — not credits.
- Failed work may retry according to the autonomy policy; retries do not consume an IZAKHONO credit balance.
- External providers remain optional adapters. If an external provider imposes its own billing, quota, rate limit, or usage restriction, that restriction belongs to that provider and is never adopted as an IZAKHONO-native credits model.
- Legitimate physical or service limits such as CPU, memory, storage, network capacity, API rate limits, security controls, and owner authorization remain valid operational constraints.

## Hard rule

> Native IZAKHONO execution must never check, decrement, reserve, purchase, or require credits before performing an otherwise-authorized action.

## Guarding the policy

CI should fail if a native execution component introduces a credits/quota/balance meter or a credit-gated execution path. Terms referring to legitimate provider APIs, rate limits, capacity, or documentation are not by themselves a violation; the prohibited pattern is using an IZAKHONO-owned credit balance or artificial usage meter to gate native execution.

## External builder relationship

Hercules and other external builders are optional adapters. IZAKHONO does not reproduce or inherit their commercial credit model. When an external adapter is selected explicitly, any external provider limitation is reported as an external dependency rather than an IZAKHONO credit requirement.
