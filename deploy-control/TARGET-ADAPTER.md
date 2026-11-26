# Read-only NODE01 target adapter

This adapter reuses `autonomy/node-registry.mjs`; it does not create a second registry.

It selects a deployment target only when the existing registry reports a fresh heartbeat, healthy status, every required readiness check, and a separately identified runtime binding. The required checks include reachability, persistent storage, container runtime, monitoring and backup readiness.

The returned selection is explicitly read-only. It cannot instantiate, promote, deploy to, or execute on a target. A healthy registry entry alone is insufficient. NODE01 remains the logical software-runtime identity; the runtime host locator is a separate field and must be explicitly present and marked separate.

Tests use a temporary registry file and do not contact or mutate any owner runtime.

Run with Node.js 20+:

```sh
node --test target-adapter.test.mjs
```
