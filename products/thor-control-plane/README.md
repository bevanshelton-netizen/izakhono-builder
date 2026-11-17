# THOR Control Plane — orchestration MVP

This package is the provider-neutral task control plane for the IZAKHONO build system. It separates task state and worker authorization from repository-code execution.

## Current capability

- Submit project-scoped tasks with dependencies, bounded retries and priority.
- Persist tasks through the D1 adapter or exercise the orchestration core with the test-only memory store.
- Claim only runnable tasks; recheck leases and dependency predicates in the conditional update.
- Require explicit per-project repository, base-branch, work-branch, path, command and resource policies.
- Authenticate API clients and individual workers using SHA-256 token hashes; raw tokens are never stored in task records.
- Support worker claim, heartbeat, completion, failure and task cancellation endpoints.
- Require structured completion evidence: commit SHA, scoped branch, GitHub PR URL, changed-file list, artifact digest and passing evidence for every approved command. A configured independent verifier must confirm the actual GitHub commit/PR before a task can be marked successful; the default Worker fails closed without it.
- Run approved commands in a disposable Docker sandbox with network disabled, read-only container root, dropped Linux capabilities, no-new-privileges, bounded CPU/memory/PIDs, bounded output/time, no Git metadata or host secrets, and post-run changed-path enforcement. Docker shares the host kernel, so this is not the final hostile-code boundary; production should use a hardened microVM or equivalent.
- Exercise the sandbox in CI, including a test that verifies public internet access is unavailable from the container.
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
- integrate the Docker sandbox into a continuously running worker and complete an independent sandbox escape/security review;
- implement the repository-token broker and model adapter;
- deploy the Worker and verify its live health/readiness endpoints;
- connect an independently owned execution node and prove end-to-end task execution.

No model API, external builder credits, production credential, database, DNS change or production deployment is included in this code change.
