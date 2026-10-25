#!/usr/bin/env bash
set -euo pipefail

# Fail-closed CONNECTA production readiness state machine.
# Run on an authorized production/audit host. Evidence must be produced by
# the actual runtime or an independent verifier; this script never infers it.

EVIDENCE_ROOT="${CONNECTA_EVIDENCE_ROOT:-/var/lib/izakhono/evidence/connecta}"
REPORT="${CONNECTA_READINESS_REPORT:-$EVIDENCE_ROOT/connecta-production-readiness.json}"
mkdir -p "$EVIDENCE_ROOT"
chmod 700 "$EVIDENCE_ROOT"

GATES=(
  cluster-physical
  connecta-local
  failover
  backup-restore
  security
  edge-tls
  external-https
)

FAILURES=()
RESULTS=()

check_gate() {
  local name="$1" file="$2" expected_schema="$3"
  if [[ ! -f "$file" ]]; then
    FAILURES+=("missing:$name")
    RESULTS+=("$(python3 - "$name" <<'PY'
import json,sys
print(json.dumps({'gate':sys.argv[1],'status':'MISSING_EVIDENCE'},separators=(',',':')))
PY
)")
    return
  fi

  if ! python3 - "$file" "$name" "$expected_schema" <<'PY'
import json,sys
path,name,schema=sys.argv[1:]
try:
    with open(path,encoding='utf-8') as f: d=json.load(f)
except Exception as exc:
    print(f'INVALID {name}: {exc}')
    raise SystemExit(1)
if d.get('schema') != schema:
    print(f"INVALID {name}: schema={d.get('schema')!r} expected={schema!r}")
    raise SystemExit(1)
if d.get('status') != 'PASS':
    print(f"NOT_PASS {name}: status={d.get('status')!r}")
    raise SystemExit(1)
if d.get('evidence_source') in (None,'','inferred','topology','ci-only','repository-only'):
    print(f'INVALID {name}: evidence source is not independently identified')
    raise SystemExit(1)
print('PASS')
PY
  then
    FAILURES+=("failed:$name")
    RESULTS+=("$(python3 - "$name" "$file" <<'PY'
import json,sys
with open(sys.argv[2],encoding='utf-8') as f: d=json.load(f)
print(json.dumps({'gate':sys.argv[1],'status':d.get('status','INVALID'),'evidence_source':d.get('evidence_source')},separators=(',',':')))
PY
)")
    return
  fi

  RESULTS+=("$(python3 - "$name" "$file" <<'PY'
import json,sys
with open(sys.argv[2],encoding='utf-8') as f: d=json.load(f)
print(json.dumps({'gate':sys.argv[1],'status':d.get('status'),'evidence_source':d.get('evidence_source'),'checked_at_epoch':d.get('checked_at_epoch')},separators=(',',':')))
PY
)")
}

check_gate cluster-physical "$EVIDENCE_ROOT/cluster-physical.json" izakhono.connecta.gate.cluster-physical.v1
check_gate connecta-local "$EVIDENCE_ROOT/connecta-local.json" izakhono.connecta.gate.local.v1
check_gate failover "$EVIDENCE_ROOT/failover.json" izakhono.connecta.gate.failover.v1
check_gate backup-restore "$EVIDENCE_ROOT/backup-restore.json" izakhono.connecta.gate.backup-restore.v1
check_gate security "$EVIDENCE_ROOT/security.json" izakhono.connecta.gate.security.v1
check_gate edge-tls "$EVIDENCE_ROOT/edge-tls.json" izakhono.connecta.gate.edge-tls.v1
check_gate external-https "$EVIDENCE_ROOT/external-https.json" izakhono.connecta.gate.external-https.v1

STATUS="PRODUCTION_READY"
if (( ${#FAILURES[@]} > 0 )); then
  STATUS="NOT_READY"
fi

python3 - "$REPORT" "$STATUS" "${FAILURES[*]-}" "${RESULTS[@]}" <<'PY'
import json,os,sys,time
report,status,failures=sys.argv[1:4]
results=[json.loads(x) for x in sys.argv[4:]]
record={
  'schema':'izakhono.connecta.production-readiness.v1',
  'checked_at_epoch':int(time.time()),
  'status':status,
  'promotion_allowed':status=='PRODUCTION_READY',
  'failures':failures.split() if failures else [],
  'gates':results,
  'evidence_source':'fail-closed-gate-state-machine',
  'public_cutover_action':'NONE',
  'note':'This report never changes DNS, EDGE/TLS, routing, or product metadata. A PRODUCTION_READY result only means every required evidence artifact passed validation.'
}
tmp=report+'.tmp'
with open(tmp,'w',encoding='utf-8') as f:
    json.dump(record,f,indent=2,sort_keys=True)
    f.write('\n')
os.chmod(tmp,0o600)
os.replace(tmp,report)
print(json.dumps(record,indent=2,sort_keys=True))
PY

if [[ "$STATUS" != "PRODUCTION_READY" ]]; then
  echo "CONNECTA_PRODUCTION_READINESS=NOT_READY"
  echo "EVIDENCE=$REPORT"
  exit 4
fi

echo "CONNECTA_PRODUCTION_READINESS=PRODUCTION_READY"
echo "EVIDENCE=$REPORT"
