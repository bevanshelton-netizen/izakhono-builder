# CONNECTA Runtime Fabric Deployment Contract

## Purpose

Define the provider-neutral deployment contract for CONNECTA by IZAKHONO.

## Runtime identity

- Runtime identity: logical software runtime instance
- Physical hardware required: false
- Provider-specific application coupling: prohibited
- Preferred placement: IZAKHONO-owned compute/runtime
- Fallback placement: approved external compute/runtime
- Release identity: immutable 40-character Git SHA

## Required runtime capabilities

An approved runtime MUST provide:

1. Application execution for the immutable release.
2. Persistent application data where required.
3. Local health verification.
4. Controlled restart and rollback.
5. Backup and non-destructive restore verification.
6. Runtime failover and failback capability.
7. Security controls appropriate to the application.
8. A controlled path to EDGE/TLS/DNS.
9. Evidence that can identify runtime, provider, release SHA and verification time.

## Separation of concerns

```text
APPLICATION RELEASE
        |
        v
SOFTWARE RUNTIME CONTRACT
        |
        +--> owned runtime
        +--> approved fallback runtime
        |
        v
EDGE / TLS / DNS
        |
        v
PUBLIC HTTPS
```

Compute placement MUST NOT be encoded as a product dependency. EDGE/TLS/DNS MUST remain independently replaceable from the compute provider.

## Failover contract

Failover is valid only when the same immutable release can be promoted to an approved alternate runtime and independently pass health verification. Failback must return service to the preferred runtime without rebuilding the application.

## Evidence contract

Runtime evidence MUST identify:

- `runtime_id`
- `runtime_provider`
- `release_sha`
- `environment`
- health result
- persistence result
- backup/restore result
- failover/failback result
- security result
- edge/TLS result
- external HTTPS result, when public promotion is requested

Missing evidence is a gate failure. Repository declarations or CI success are not substitutes for runtime evidence.
