# IZAKHONO Autonomous Control Plane

The Autonomous Control Plane is the orchestration layer for end-to-end IZAKHONO platform provisioning.

## Operating rule

**Owned-first, externally reversible.**

Every capability is planned against an IZAKHONO-owned service first. A verified external provider is retained as a reversible failover where appropriate. A project is never declared live from intention alone: it reaches `LIVE` only after capability-level evidence passes.

## Flow

`REQUEST → PLAN → PROVISION → VERIFY → LIVE`

Failure paths are explicit:

`PROVISION → DEGRADED → FAILOVER → VERIFY`

or

`VERIFY → ROLLBACK → PLAN`

## Capability fabric

- Identity → IZAKHONO ID
- Data → IZAKHONO DATA, with Supabase failover
- Storage → IZAKHONO STORAGE, with R2 failover
- API → IZAKHONO CORE, with Vercel/serverless failover
- Security → FORTRESS
- Jobs → IZAKHONO TASKS
- Deployment → IZAKHONO PROVISIONER, with Vercel failover
- Domain/DNS/TLS → IZAKHONO provisioning adapters, with Cloudflare/domain provider failover
- Payments → approved payment adapters
- AI → provider-neutral AI adapters
- Observability → IZAKHONO OBSERVE, with external observability failover

## Safety rules

1. Never store production secrets in source control.
2. Never mark a capability passed without evidence.
3. Never claim `LIVE` unless all requested capabilities have passed.
4. Prefer the owned provider when healthy.
5. Fail over only when the primary is unavailable or objectively unsuitable.
6. Preserve the previous verified route until the replacement passes acceptance checks.
7. Roll back automatically when verification fails and rollback is safe.
8. Keep infrastructure adapters replaceable so a vendor can be removed without rewriting business logic.

## Intended outcome

A new IZAKHONO platform should become a provisioning request, not a bespoke infrastructure exercise. The control plane is designed to make domain, DNS, TLS, hosting, data, security, payments, AI, communications, analytics, deployment and verification flow through one orchestration contract.
