#!/usr/bin/env bash
set -euo pipefail

# Validate readiness evidence without asserting physical state.
# Intended for CI, NODE01, or audit tooling.

EVIDENCE_ROOT="${IZAKHONO_EVIDENCE_ROOT:-/var/lib/izakhono/evidence}"
EXPECTED=(node01 node02 node03 node04)
failures=0

for node in "${EXPECTED[@]}"; do
  file="$EVIDENCE_ROOT/node-readiness-${node}.json"
  if [[ ! -f "$file" ]]; then
    echo "FAIL missing:$file"
    failures=$((failures + 1))
    continue
  fi

  if ! python3 - "$file" "$node" <<'PY'
import json,sys
path,expected=sys.argv[1:]
with open(path,encoding='utf-8') as f:
    d=json.load(f)
required={
    'schema':'izakhono.node-readiness.v2',
    'node_id':expected,
    'status':'PASS',
    'evidence_source':'physical-node-execution',
}
errors=[]
for key,value in required.items():
    if d.get(key) != value:
        errors.append(f'{key}={d.get(key)!r}, expected {value!r}')
if not isinstance(d.get('checked_at_epoch'),int) or d['checked_at_epoch'] <= 0:
    errors.append('checked_at_epoch invalid')
if not isinstance(d.get('failures'),list) or d['failures']:
    errors.append('failures must be an empty list')
if errors:
    print(f"FAIL {path}: " + '; '.join(errors))
    raise SystemExit(1)
print(f"PASS {path}")
PY
  then
    failures=$((failures + 1))
  fi
done

if (( failures > 0 )); then
  echo "IZAKHONO_READINESS_EVIDENCE=FAIL"
  exit 4
fi

echo "IZAKHONO_READINESS_EVIDENCE=PASS"
