# THOR Control Plane — orchestration MVP

This package is the provider-neutral task control plane for the IZAKHONO build system. It separates task state and worker authorization from repository-code execution.

## Current capability

- Submit project-scoped tasks with dependencies, bounded retries and priority.
- Persist tasks through the D1 adapter or exercise the orchestration core with the test-only memory store.
- Claim only runnable tasks; recheck leases and dependency predicates in the conditional update.
- Require explicit per-project repository, base-branch, work-branch, path, command and resource policies.
- Authenticate API clients and individual workers using SHA-256 token hashes; raw tokens are never stored in task records.
- Support worker claim, heartbeat, completion, failure and task cancellation endpoints.
- Require completion evidence: commit SHA, scoped branch, reviewable GitHub PR, changed-file list, artifact digest and passing evidence for every approved command.
- Expose health, readiness and an authenticated portfolio snapshot.
- Persist validated worker envelopes with tasks; tasks without an envelope are not claimable by the coding-worker API.

## Run tests

Requires Node.js 20 or newer:

```bash
node --test products/thor-control-plane/src/*.test.mjs
```

## Production boundary

The HTTP Worker is a control-plane API only. It never executes repository code. The worker contract and completion evidence checks are policy gates, **not an operating-system sandbox**.

Still outstanding before live production use:

- provision and migrate a real D1 database, then run concurrency and crash-recovery tests against it;
- configure API-token hash, per-worker token hashes and project-policy map in the Cloudflare secret store;
- implement and independently verify the ephemeral container/VM coding sandbox;
- implement the repository-token broker and model adapter;
- deploy the Worker and verify its live health/readiness endpoints;
- connect an independently owned execution node and prove end-to-end task execution.

No model API, external builder credits, production credential, database, DNS change or production deployment is included in this code change.
