# IZAKHONO Universal Application Provisioner

The Application Fabric Provisioner is the common control path for IZAKHONO applications.

## Contract

`SOURCE → VALIDATE → PACKAGE → REGISTER → PROVISION → DEPLOY → HEALTH → ACCEPTANCE → PROMOTE`

This component owns the repository-side transition through `REGISTER` and `PROVISION`.
It does **not** claim runtime execution, public DNS/TLS, promotion, or LIVE status.

## Commands

```text
provisioner.sh plan <manifest.json>
provisioner.sh register <manifest.json>
provisioner.sh provision <manifest.json>
```

State is written atomically beneath `IZAKHONO_PROVISIONER_STATE` (default: local `state/`).

## Runtime identity — mandatory distinction

**NODE01–NODE04 are logical software/runtime identities. They are software, not physical machines, servers, computers, hostnames, or permanent hardware assignments.**

The execution environment is separate infrastructure. It may be a physical host, virtual host, container platform, or distributed runtime. A runtime binding connects the logical software identity to that separately managed execution environment. The environment can change without changing NODE01's identity.

For backward compatibility, the current `izakhono.runtime-binding/v1` field `runtime_host` refers only to the separate execution-environment locator. It must never be populated with or described as NODE01's identity. `runtime_host_is_separate` must remain true. A placeholder value is not an approved binding and cannot pass runtime verification.

Release and acceptance evidence must bind the immutable artifact to both the logical software identity and the separately identified execution environment.

## Safety rules

- Manifests must use the `izakhono.app/v1` contract validated by `validate-manifests.sh`.
- Production policy must remain `owned-first-externally-reversible`.
- Provisioning rejects manifests marked `live: true`.
- Registration and provisioning are state transitions, not deployment claims.
- Immutable image digest remains the rollback artifact identity.
- External providers remain adapters/fallbacks and are not promoted to runtime authority.
- Runtime acceptance requires independent evidence from the actual approved execution environment.
- Repository CI can validate contracts but cannot manufacture runtime, DNS/TLS, or LIVE evidence.
