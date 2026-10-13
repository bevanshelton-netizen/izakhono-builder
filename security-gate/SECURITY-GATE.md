# IZAKHONO PRE-DEPLOY SECURITY GATE v1

**Purpose:** stop AI/vibe-coded applications from reaching production on the strength of an AI claim alone.

## Gate order

1. **Inventory** — enumerate API routes, auth boundaries, database operations, payment flows, webhooks, paid APIs, secrets and admin actions.
2. **Ownership** — server/session identity decides resource ownership; client-supplied identity is never authoritative.
3. **Payments** — server resolves prices; checkout amounts are not trusted from the browser; webhook signatures are verified against raw payloads.
4. **Rate limits** — auth, recovery, paid APIs and expensive operations have explicit limits and return `429` when exceeded.
5. **Secrets** — private credentials stay server-side and are absent from browser bundles and public responses.
6. **Abuse controls** — payload size, timeouts, idempotency and expensive-operation controls are checked where relevant.
7. **Adversarial proof** — tests attempt the attack, demonstrate the failure, apply the fix, and pass after the fix.
8. **Static gate** — `node security-gate/audit.mjs <target>` blocks high-confidence dangerous patterns.
9. **Deployment** — only a PASS or an explicitly documented human waiver can proceed.

## Required evidence

A security review must contain:

- route inventory;
- ownership proof for protected resources;
- checkout/payment proof;
- webhook verification proof;
- rate-limit configuration and `429` proof;
- secret-exposure check;
- adversarial test results;
- deployment commit SHA;
- gate result and timestamp.

## Rule

**No claim without evidence. No production deployment after a blocking finding.**

The gate is deliberately framework-agnostic so it can protect Next.js, Vite, Cloudflare Workers, Node, Python and other IZAKHONO applications.
