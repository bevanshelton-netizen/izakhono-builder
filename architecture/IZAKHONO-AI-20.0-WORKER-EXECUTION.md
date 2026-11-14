# IZAKHONO AI 20.0 — Worker Execution and Verification Baseline

**Status:** Architecture and implementation map for the current mainline worker runtime.  
**Owner:** IZAKHONO AFRICA (Pty) Ltd  
**Release rule:** No production promotion without verified runtime configuration, D1 migration state, security controls and operator acceptance.

## Existing mainline execution path

This document describes the worker runtime already present on the main branch. It does not replace or fork that implementation.

- `registry/supervisor-store.ts` persists supervisor jobs, execution leases, attempts and events. Claims are bound to a worker, idempotency key and expiring lease; heartbeat and finish operations require lease ownership.
- `registry/worker-executor.ts` executes one already-leased job through an explicitly registered handler. A job is only marked verified when the handler returns at least one valid, named, passing check.
- `registry/worker-handlers.ts` constrains build verification inputs to an owner/repository identifier, commit SHA and a small allowlist of checks. It validates that the verifier reports the exact requested revision and every requested check.
- `registry/github-build-verifier.ts` performs read-only GitHub check-run inspection for allowlisted repositories. It does not write source, publish artifacts or deploy.
- `registry/worker-persistent.ts` wires the configured GitHub read-only verifier into the worker runtime only when its required runtime bindings are present. Missing bindings leave the build handler unavailable rather than pretending it is active.

## Safety boundaries

1. Work must be explicitly queued and claimed before handler execution.
2. The lease token, worker identity and idempotency key govern ownership and retry behavior.
3. Handler registration is explicit. Unavailable handlers do not execute.
4. The build verifier is read-only and uses an allowlist of repositories and checks.
5. Verification requires complete, passing checks for the exact requested commit revision.
6. Lease loss, failed checks, incomplete reports and handler exceptions cannot be reported as successful verification.
7. Production deployment, financial actions, external commitments and destructive operations remain separate approval-controlled workflows.

## Division registry

The IZAKHONO AI 20.0 division registry in `registry/divisions.ts` maps the enterprise accountability model to existing worker IDs. It is a governance and portfolio map; it does not activate a worker, grant a capability or imply that every catalogued worker is executable. Registry validation checks unique division identifiers, accountable roles, measurable outcomes, approval boundaries and worker references.

## Validation still required

- Execute the current mainline registry, lease, executor and worker-handler test suites in CI.
- Verify D1 migrations and lease behavior against a real D1-compatible database, including concurrent claim, heartbeat, expiry and recovery cases.
- Confirm runtime bindings and repository allowlists from deployment configuration without exposing secrets.
- Preserve read-only build verification unless a separately reviewed, narrowly scoped write-capability design is approved.
- Keep deployment and release evidence distinct from code-review and CI evidence.
