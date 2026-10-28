#!/usr/bin/env bash
set -euo pipefail

fail(){ echo "[FAIL] $1" >&2; exit 1; }
pass(){ echo "[PASS] $1"; }

: "${IZAKHONO_RUNTIME_ID:?IZAKHONO_RUNTIME_ID is required}"
: "${IZAKHONO_RUNTIME_PROVIDER:?IZAKHONO_RUNTIME_PROVIDER is required}"
: "${IZAKHONO_RELEASE_SHA:?IZAKHONO_RELEASE_SHA is required}"

[[ "$IZAKHONO_RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "release SHA must be an immutable 40-character SHA"
[[ "$IZAKHONO_RUNTIME_ID" != *NODE01* ]] || fail "physical NODE01 identity is not a runtime prerequisite"
[[ "$IZAKHONO_RUNTIME_ID" != *physical* ]] || fail "physical runtime identity is prohibited"

EVIDENCE_DIR="${IZAKHONO_EVIDENCE_DIR:-/var/lib/izakhono/evidence/connecta}"
required=(runtime health persistence backup_restore failover security edge_tls external_https)

for item in "${required[@]}"; do
  file="$EVIDENCE_DIR/$item.ok"
  [[ -s "$file" ]] || fail "missing evidence: $item"
  pass "evidence: $item"
done

python3 - "$EVIDENCE_DIR" "$IZAKHONO_RELEASE_SHA" "$IZAKHONO_RUNTIME_ID" "$IZAKHONO_RUNTIME_PROVIDER" <<'PY'
import json, pathlib, sys
root, expected_sha, expected_runtime, expected_provider = sys.argv[1:]
required = ('runtime', 'health', 'persistence', 'backup_restore', 'failover', 'security', 'edge_tls', 'external_https')
for name in required:
    path = pathlib.Path(root) / f'{name}.ok'
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:
        raise SystemExit(f'invalid-json:{name}:{exc}')
    if data.get('status') != 'PASS':
        raise SystemExit(f'evidence-status-not-pass:{name}')
    if data.get('release_sha') != expected_sha:
        raise SystemExit(f'evidence-sha-mismatch:{name}')
    if data.get('runtime_id') != expected_runtime:
        raise SystemExit(f'evidence-runtime-mismatch:{name}')
    if data.get('runtime_provider') != expected_provider:
        raise SystemExit(f'evidence-provider-mismatch:{name}')
    if data.get('physical_hardware_required') is True:
        raise SystemExit(f'physical-hardware-required:{name}')
print('evidence-schema-validation=PASS')
PY

pass "CONNECTA PRODUCTION GATES PASS"
echo "runtime_id=$IZAKHONO_RUNTIME_ID"
echo "runtime_provider=$IZAKHONO_RUNTIME_PROVIDER"
echo "release_sha=$IZAKHONO_RELEASE_SHA"
echo "physical_hardware_required=false"
echo "public_status=VERIFIED_BY_REQUIRED_EVIDENCE"
