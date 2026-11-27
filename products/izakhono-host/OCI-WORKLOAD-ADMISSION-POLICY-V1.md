# HOST OCI Workload Admission Policy v1

## Scope

This is the first CI-only implementation step for issue #815. It adds a fail-closed admission policy for a future trusted OCI executor. It does **not** launch containers, call a provider, select a runtime, configure credentials, or activate HOST/NAV workers.

## Admission rules

- Workload classes, immutable SHA-256 image digests and network profiles must be explicitly allow-listed by trusted server-side configuration.
- A trusted provenance-verification callback must positively verify the image digest and its provenance. Missing verifier or any non-true result rejects admission.
- The request schema is closed. Unknown fields—including commands, entrypoints, provider URLs, credentials and arbitrary runtime options—are rejected.
- Rootless execution is mandatory. Privileged mode, host network/PID/IPC namespaces, host paths and Docker socket access are rejected.
- CPU, memory and disk limits are positive integers bounded by configured ceilings.
- Persistent data uses a separate named volume at the fixed workload-data mount path. Retention is explicit; deletion requires the separate owner-approved workflow.
- The result is a frozen, provider-neutral admission record. It is not evidence that an executor or workload has started.

## Integration boundary

The policy must be called by a future trusted server-side executor before provisioning. It must not be exposed as a browser-configurable policy API. The existing HOST fixed-task compute worker remains unchanged. No shell execution, Docker socket, provider credentials, production target, DNS/TLS change or public activation is introduced.

## Verification

The test suite exercises allow-list enforcement, provenance fail-closed behavior, closed request fields, isolation requirements, resource ceilings, network policy and persistent-volume retention. CI is required before any follow-on executor integration.
