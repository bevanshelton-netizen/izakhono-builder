# IZAKHONO Universal Application Provisioner

The Application Fabric Provisioner is the common control path for IZAKHONO applications.

## Contract

`SOURCE → VALIDATE → PACKAGE → REGISTER → PROVISION → DEPLOY → HEALTH → ACCEPTANCE → PROMOTE`

This component owns the repository-side transition through `REGISTER` and `PROVISION`.
It does **not** claim runtime-host deployment, public DNS/TLS, promotion, or LIVE status.

## Commands

```text
provisioner.sh plan <manifest.json>
provisioner.sh register <manifest.json>
provisioner.sh provision <manifest.json>
```

State is written atomically beneath `IZAKHONO_PROVISIONER_STATE` (default: local `state/`).

## Runtime identity

`NODE01`–`NODE04` are logical software/runtime identities. They are not physical machines and must never be treated as hostnames, servers, or permanent hardware assignments. A logical node is bound at runtime to an approved host through `izakhono.runtime-binding/v1`.

The host may be physical or virtual and may move without changing the logical node identity. The release and acceptance contracts bind artifacts to the runtime host and logical identity, not to a machine name.

## Safety rules

- Manifests must use the `izakhono.app/v1` contract validated by `validate-manifests.sh`.
- Production policy must remain `owned-first-externally-reversible`.
- Provisioning rejects manifests marked `live: true`.
- Registration and provisioning are state transitions, not deployment claims.
- Immutable image digest remains the rollback artifact identity.
- External providers remain adapters/fallbacks and are not promoted to runtime authority.
- Runtime acceptance requires independent evidence from the actual approved runtime host.
- Repository CI can validate contracts but cannot manufacture runtime-host, DNS/TLS, or LIVE evidence.
