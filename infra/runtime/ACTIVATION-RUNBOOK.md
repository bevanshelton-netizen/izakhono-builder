# IZAKHONO Runtime Activation Runbook

This runbook is for an **actual approved runtime host**. It does not treat NODE01 as a machine: NODE01-NODE04 are portable logical software/runtime identities.

## Host execution

```bash
sudo -i
export IZAKHONO_NODE_ID=NODE01
export IZAKHONO_RUNTIME_HOST_NAME="$(hostname -s)"
export IZAKHONO_STATE_ROOT=/opt/izakhono
/opt/izakhono/bin/activate-runtime-host.sh
```

Before execution, install the approved `host-preflight.sh` and canonical release adapter under `/opt/izakhono/bin/`, and provide an immutable release descriptor through `IZAKHONO_ARTIFACT_FILE`.

## Gate order

1. Host preflight
2. Immutable artifact deployment
3. Application health
4. Public HTTPS/DNS where required
5. Independent acceptance
6. Backup/restore verification
7. Promotion
8. LIVE only after independent evidence

The orchestrator stops before promotion. It must not be used to manufacture health, HTTPS, acceptance, backup, or LIVE evidence.

## Security

Never place Contabo credentials, SSH private keys, API secrets, or production tokens in Git. Supply secrets through the approved host/runtime secret mechanism.
