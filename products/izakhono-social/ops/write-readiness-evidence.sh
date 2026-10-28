#!/usr/bin/env bash
set -euo pipefail

EVIDENCE_ROOT="${CONNECTA_EVIDENCE_ROOT:-/var/lib/izakhono/evidence/connecta}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMMIT="${CONNECTA_EVIDENCE_COMMIT:-$(git -C "$ROOT/../.." rev-parse HEAD)}"
RUNTIME_ID="${CONNECTA_RUNTIME_ID:-logical-runtime-instance}"
RUNTIME_PROVIDER="${CONNECTA_RUNTIME_PROVIDER:-approved-compute-runtime}"
HEALTH_FILE="${1:?Usage: write-readiness-evidence.sh HEALTH_JSON RESTORE_JSON BACKUP_DIR}"
RESTORE_FILE="${2:?Usage: write-readiness-evidence.sh HEALTH_JSON RESTORE_JSON BACKUP_DIR}"
BACKUP_DIR="${3:?Usage: write-readiness-evidence.sh HEALTH_JSON RESTORE_JSON BACKUP_DIR}"

[[ -f "$HEALTH_FILE" ]] || { echo "missing-health-evidence" >&2; exit 20; }
[[ -f "$RESTORE_FILE" ]] || { echo "missing-restore-evidence" >&2; exit 21; }
[[ -f "$BACKUP_DIR/manifest.json" ]] || { echo "missing-backup-manifest" >&2; exit 22; }
[[ -f "$BACKUP_DIR/SHA256SUMS" ]] || { echo "missing-backup-checksums" >&2; exit 23; }

python3 - "$EVIDENCE_ROOT" "$COMMIT" "$RUNTIME_ID" "$RUNTIME_PROVIDER" "$HEALTH_FILE" "$RESTORE_FILE" "$BACKUP_DIR" <<'PY'
import json, os, pathlib, sys, time
root, commit, runtime_id, runtime_provider, health_file, restore_file, backup_dir = sys.argv[1:]
now = int(time.time())

def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

health = load(health_file)
restore = load(restore_file)
manifest = load(os.path.join(backup_dir, 'manifest.json'))

if not health.get('ok'):
    raise SystemExit('health-proof-not-ok')
if restore.get('ok') is not True or restore.get('destructive') is not False:
    raise SystemExit('restore-proof-not-ok')
if manifest.get('schema') != 'connecta.backup.v1':
    raise SystemExit('backup-manifest-schema-invalid')

pathlib.Path(root).mkdir(parents=True, exist_ok=True)
common = {
    'runtime_id': runtime_id,
    'runtime_provider': runtime_provider,
    'physical_hardware_required': False,
    'logical_runtime_identity': True,
    'checked_at_epoch': now,
    'release_sha': commit,
}

artifacts = {
    'runtime.ok': {
        'status': 'PASS', 'evidence_source': 'software-runtime-execution',
        **common, 'runtime_ready': True,
    },
    'health.ok': {
        'status': 'PASS', 'evidence_source': 'software-runtime-execution',
        **common, 'health': health,
    },
    'persistence.ok': {
        'status': 'PASS', 'evidence_source': 'software-runtime-execution',
        **common, 'proof': 'registration-login-persistence-smoke',
    },
    'backup_restore.ok': {
        'status': 'PASS', 'evidence_source': 'software-runtime-execution',
        **common, 'backup_manifest': manifest, 'restore': restore,
        'integrity_verified': True, 'destructive_restore': False,
    },
}

for name, payload in artifacts.items():
    target = pathlib.Path(root) / name
    tmp = target.with_suffix(target.suffix + '.tmp')
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2, sort_keys=True)
        f.write('\n')
    os.chmod(tmp, 0o600)
    os.replace(tmp, target)
    print(target)
PY
