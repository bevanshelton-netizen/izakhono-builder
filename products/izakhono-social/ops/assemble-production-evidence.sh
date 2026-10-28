#!/usr/bin/env bash
set -euo pipefail

fail(){ echo "[FAIL] $1" >&2; exit 1; }
pass(){ echo "[PASS] $1"; }

EVIDENCE_DIR="${IZAKHONO_EVIDENCE_DIR:-/var/lib/izakhono/evidence/connecta}"
RUNTIME_ID="${IZAKHONO_RUNTIME_ID:?IZAKHONO_RUNTIME_ID is required}"
RUNTIME_PROVIDER="${IZAKHONO_RUNTIME_PROVIDER:?IZAKHONO_RUNTIME_PROVIDER is required}"
RELEASE_SHA="${IZAKHONO_RELEASE_SHA:?IZAKHONO_RELEASE_SHA is required}"

[[ "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "release SHA must be an immutable 40-character SHA"
[[ "$RUNTIME_ID" != *NODE01* ]] || fail "physical NODE01 identity is prohibited"
[[ "$RUNTIME_ID" != *physical* ]] || fail "physical runtime identity is prohibited"
[[ -d "$EVIDENCE_DIR" ]] || fail "evidence directory does not exist: $EVIDENCE_DIR"

python3 - "$EVIDENCE_DIR" "$RELEASE_SHA" "$RUNTIME_ID" "$RUNTIME_PROVIDER" <<'PY'
import json, pathlib, sys
root, sha, runtime_id, provider = sys.argv[1:]
required = ('runtime','health','persistence','backup_restore','failover','security','edge_tls','external_https')

for name in required:
    path = pathlib.Path(root) / f'{name}.ok'
    if not path.is_file():
        raise SystemExit(f'missing evidence: {name}')
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:
        raise SystemExit(f'invalid JSON: {name}: {exc}')
    if data.get('status') != 'PASS':
        raise SystemExit(f'evidence is not PASS: {name}')
    if data.get('release_sha') != sha:
        raise SystemExit(f'release SHA mismatch: {name}')
    if data.get('runtime_id') != runtime_id:
        raise SystemExit(f'runtime identity mismatch: {name}')
    if data.get('runtime_provider') != provider:
        raise SystemExit(f'runtime provider mismatch: {name}')
    if data.get('physical_hardware_required') is True:
        raise SystemExit(f'physical hardware dependency detected: {name}')

print('production-evidence-assembly=PASS')
PY

pass "all required production evidence is present and internally consistent"
echo "runtime_id=$RUNTIME_ID"
echo "runtime_provider=$RUNTIME_PROVIDER"
echo "release_sha=$RELEASE_SHA"
echo "physical_hardware_required=false"
