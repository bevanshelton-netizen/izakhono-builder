# IZAKHONO Runtime Host Preflight

This gate runs **on the approved runtime host**, not on a GitHub-hosted CI runner.

## Identity boundary

`NODE01`–`NODE04` are portable logical software/runtime identities. `IZAKHONO_RUNTIME_HOST_NAME` identifies the current infrastructure host separately. A host can be rebuilt, replaced, moved between providers, or moved to IZAKHONO-owned hardware without changing the logical identity.

## Run

```bash
sudo env IZAKHONO_NODE_ID=NODE01 \
  IZAKHONO_RUNTIME_HOST_NAME=izakhono-runtime-01 \
  ./infra/runtime/host-preflight.sh
```

The gate verifies root access, Docker Engine, Docker Compose, the IZAKHONO state root, the `izakhono-edge` network, and the installed release adapter. TCP 80/443 listeners are reported as warnings because edge ingress may be configured in a later activation stage.

Evidence is written atomically to `/opt/izakhono/state/runtime-host/preflight.json` using `izakhono.runtime-host-evidence/v1`.

## Fail-closed rules

- Invalid logical node identities fail.
- Missing Docker/Compose/state root/edge network/release adapter fails.
- Evidence records `runtimeHostIsSeparate: true`.
- The gate never asserts health, HTTPS, acceptance, promotion, or LIVE.
- Repository CI cannot manufacture this evidence; it must originate from the actual approved host.

## Activation sequence

`HOST PREFLIGHT -> EXACT ARTIFACT DEPLOYMENT -> HEALTH -> HTTPS/DNS -> ACCEPTANCE -> BACKUP/RESTORE -> PROMOTION -> LIVE`
