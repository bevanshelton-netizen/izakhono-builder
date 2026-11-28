# IZAKHONO DEPLOY security boundary

1. Authenticate every API caller. Prefer IZAKHONO ID for human identity and dedicated short-lived service identities for automation.
2. Enforce organization, environment, application, target, and action scopes server-side.
3. Default to read-only. Deny unknown actions and unknown target capabilities.
4. Require explicit human approval for production promotion, rollback, destructive actions, and secret rotation.
5. Never expose secrets to browser clients, build arguments, image layers, logs, telemetry, or audit payloads.
6. Store secret references, not plaintext secret values, in deployment metadata.
7. Use immutable image digests, signed/provenanced build artifacts where available, and verify provenance before release.
8. Apply idempotency keys to every mutating operation. Record actor, scope, requested action, policy decision, result, and correlation ID.
9. Do not offer arbitrary shell, Docker socket, or host command execution through the public management API.
10. Keep audit records append-only and restrict access to sensitive operational logs.
11. Enforce per-application isolation, resource quotas, network policy, and least-privilege runtime identities.
12. Never report BUILT, RELEASED, HEALTHY, or PUBLICLY VERIFIED without evidence for that exact lifecycle stage.

The NODE01 identity policy in `AGENTS.md` is mandatory: NODE01 is a logical software-runtime identity. The execution environment is separately bound and replaceable. Never infer or invent its locator.
