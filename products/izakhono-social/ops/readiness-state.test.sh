#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE="$ROOT/CONNECTA-READINESS-STATE.sh"
PROMOTION="$ROOT/ops/production-deployment-gate.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

export CONNECTA_EVIDENCE_ROOT="$TMP/evidence"
export CONNECTA_READINESS_REPORT="$TMP/readiness.json"
export CONNECTA_PROMOTION_REPORT="$TMP/promotion.json"
export CONNECTA_READINESS_MAX_AGE_SECONDS=3600
mkdir -p "$CONNECTA_EVIDENCE_ROOT"

python3 - "$CONNECTA_EVIDENCE_ROOT" <<'PY'
import json,pathlib,sys,time
root=pathlib.Path(sys.argv[1]); now=int(time.time())
sha='0123456789abcdef0123456789abcdef01234567'
sources={
 'runtime':'software-runtime-execution',
 'health':'software-runtime-execution',
 'persistence':'software-runtime-execution',
 'backup_restore':'software-runtime-execution',
 'failover':'prove-failover-evidence.sh:approved-runtime-operator',
 'security':'prove-security-evidence.sh:approved-runtime-execution',
 'edge_tls':'prove-edge-tls-evidence.sh:approved-runtime-edge-verification',
 'external_https':'prove-external-https-evidence.sh:independent-external-execution',
}
for name,source in sources.items():
 data={
  'status':'PASS','evidence_source':source,'checked_at_epoch':now,
  'release_sha':sha,'runtime_id':'NODE01','runtime_provider':'test-runtime',
  'physical_hardware_required':False,
 }
 (root/f'{name}.ok').write_text(json.dumps(data),encoding='utf-8')
PY

bash "$EVIDENCE"
bash "$PROMOTION"
python3 - "$CONNECTA_READINESS_REPORT" "$CONNECTA_PROMOTION_REPORT" <<'PY'
import json,sys
for path in sys.argv[1:]:
 d=json.load(open(path,encoding='utf-8'))
 assert d['promotion_allowed'] is True, path
 assert d['physical_hardware_required'] is False, path
print('[PASS] provider-neutral readiness accepts a logical NODE01 runtime identity')
PY

python3 - "$CONNECTA_EVIDENCE_ROOT/external_https.ok" <<'PY'
import json,sys
p=sys.argv[1]; d=json.load(open(p,encoding='utf-8')); d['runtime_id']='different-runtime'
open(p,'w',encoding='utf-8').write(json.dumps(d))
PY
set +e
bash "$EVIDENCE" >/dev/null 2>&1
state_code=$?
bash "$PROMOTION" >/dev/null 2>&1
promotion_code=$?
set -e
[[ "$state_code" -eq 4 && "$promotion_code" -eq 2 ]] || { echo "mismatched runtime evidence was not rejected" >&2; exit 1; }

echo '[PASS] readiness gates reject cross-runtime evidence'
