# THOR Control Plane — orchestration MVP

This package is the first executable THOR orchestration slice. It is deliberately provider-neutral and uses an injected store so the scheduler can be tested independently of D1, another database, or a future IZAKHONO-owned runtime.

## Current capability

- Submit validated tasks against a project.
- Declare dependencies between tasks.
- Claim independent runnable tasks for separate workers.
- Keep tasks blocked until all dependencies have succeeded.
- Use worker leases and recover abandoned work after lease expiry.
- Enforce lease ownership before completion or failure.
- Retry failed work up to a configured attempt limit.
- Expose an evidence-friendly portfolio snapshot.

## Run tests

Requires Node.js 20 or newer:

```bash
node --test products/thor-control-plane/src/index.test.mjs
```

## Important production boundary

`MemoryThorStore` is test-only. The SQL schema is a starting migration, not a production adapter. Before connecting live workers, implement a durable adapter with an atomic claim transaction, dependency validation, lease expiry, event writes, idempotency and crash-recovery tests.

The executor passed to `runOne` is an interface boundary, not yet a sandbox. Do not pass untrusted repository code to an unrestricted process. Production workers must run in isolated workspaces with scoped credentials, resource limits and network allow-lists.

No model API, external builder credits, deployment provider or production credential is required by this orchestration core.
