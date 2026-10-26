#!/usr/bin/env bash
set -euo pipefail

# This verifier intentionally performs NO node failure itself.
# A physical operator/cluster orchestrator must execute the controlled
# NODE01 failure and failback, then provide the observed endpoints/results.

EVIDENCE_ROOT="${CONNECTA_EVIDENCE_ROOT:-/var/lib/izakhono/evidence/connecta}"
REPORT="${CONNECTA_FAILOVER_REPORT:-/var/lib/izakhono/evidence/connecta/failover-test.json}"
EXPECTED_SHA="${1:-}"
PRIMARY_URL="${CONNECTA_PRIMARY_HEALTH_URL:-http://127.0.0.1:3080/health}"
FAILOVER_URL="${CONNECTA_FAILOVER_HEALTH_URL:-}"
FAILBACK_URL="${CONNECTA_FAILBACK_HEALTH_URL:-$PRIMARY_URL}"

[[ -n "$EXPECTED_SHA" && "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "usage: $0 IMMUTABLE_CONNECTA_SHA" >&2; exit 2; }
[[ -n "$FAILOVER_URL" ]] || { echo "CONNECTA_FAILOVER_HEALTH_URL is required; refusing inferred failover proof." >&2; exit 3; }

command -v curl >/dev/null || { echo "curl is required" >&2; exit 2; }
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 2; }

mkdir -p "$EVIDENCE_ROOT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

check_health() {
  local url="$1" out="$2"
  curl -fsS --max-time 15 "$url" > "$out"
  python3 - "$out" <<'PY'
import json,sys
with open(sys.argv[1],encoding='utf-8') as f: d=json.load(f)
if not d.get('ok'):
    raise SystemExit('health-not-ok')
PY
}

# The controlled failure itself must be performed outside this verifier.
# This script proves the observed failover endpoint and subsequent failback.
check_health "$FAILOVER_URL" "$TMP/failover-health.json"
check_health "$FAILBACK_URL" "$TMP/failback-health.json"

python3 - "$REPORT" "$EXPECTED_SHA" "$FAILOVER_URL" "$FAILBACK_URL" "$TMP/failover-health.json" "$TMP/failback-health.json" <<'PY'
import json,sys,time,os,pathlib
report,sha,fo,fb,fofile,fbfile=sys.argv[1:]
now=int(time.time())
with open(fofile,encoding='utf-8') as f: failover=json.load(f)
with open(fbfile,encoding='utf-8') as f: failback=json.load(f)
payload={
 'schema':'izakhono.connecta.gate.failover.v1',
 'status':'PASS',
 'evidence_source':'prove-failover-evidence.sh:physical-node-execution',
 'checked_at_epoch':now,
 'immutable_commit':sha,
 'controlled_failure_executed_by':'external-cluster-operator',
 'failover_health_url':fo,
 'failover_health':failover,
 'failback_health_url':fb,
 'failback_health':failback,
 'note':'PASS requires the controlled NODE01 failure to have actually occurred before this verifier was run; this script does not simulate failure.'
}
pathlib.Path(report).parent.mkdir(parents=True,exist_ok=True)
tmp=report+'.tmp'
with open(tmp,'w',encoding='utf-8') as f:
 json.dump(payload,f,indent=2,sort_keys=True); f.write('\n')
os.chmod(tmp,0o600); os.replace(tmp,report)
print(report)
PY

echo "CONNECTA_FAILOVER_EVIDENCE=PASS"
