# IZAKHONO Universal Application Provisioner

The Application Fabric Provisioner is the common control path for IZAKHONO applications.

## Contract

`SOURCE → VALIDATE → PACKAGE → REGISTER → PROVISION → DEPLOY → HEALTH → ACCEPTANCE → PROMOTE`

This component owns the repository-side transition through `REGISTER` and `PROVISION`.
It does **not** claim physical deployment, public DNS/TLS, promotion, or LIVE status.

## Commands

```text
provisioner.sh plan <manifest.json>
provisioner.sh register <manifest.json>
provisioner.sh provision <manifest.json>
```

State is written atomically beneath `IZAKHONO_PROVISIONER_STATE` (default: local `state/`).

## Safety rules

- Manifests must use the `izakhono.app/v1` contract validated by `validate-manifests.sh`.
- Production policy must remain `owned-first-externally-reversible`.
- Provisioning rejects manifests marked `live: true`.
- Registration and provisioning are state transitions, not deployment claims.
- Immutable image digest remains the rollback artifact identity.
- External providers remain adapters/fallbacks and are not promoted to runtime authority.
- Physical NODE01–NODE04 activation remains a separate acceptance gate.
