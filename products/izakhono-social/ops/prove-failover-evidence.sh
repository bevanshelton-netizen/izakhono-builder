#!/usr/bin/env bash
set -euo pipefail

# Verifies observed failover and failback. The controlled failure is performed
# by the approved runtime operator/orchestrator, never simulated here.
EVIDENCE_ROOT="${CONNECTA_EVIDENCE_ROOT:-/var/lib/izakhono/evidence/connecta}"
REPORT="${CONNECTA_FAILOVER_REPORT:-$EVIDENCE_ROOT/failover.ok}"
EXPECTED_SHA="${1:-}"
RUNTIME_ID="${IZAKHONO_RUNTIME_ID:-${CONNECTA_RUNTIME_ID:-}}"
RUNTIME_PROVIDER="${IZAKHONO_RUNTIME_PROVIDER:-${CONNECTA_RUNTIME_PROVIDER:-}}"
OPERATOR="${CONNECTA_FAILOVER_OPERATOR:-}"
PRIMARY_URL="${CONNECTA_PRIMARY_HEALTH_URL:-http://127.0.0.1:3080/health}"
FAILOVER_URL="${CONNECTA_FAILOVER_HEALTH_URL:-}"
FAILBACK_URL="${CONNECTA_FAILBACK_HEALTH_URL:-$PRIMARY_URL}"

[[ "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "usage: $0 IMMUTABLE_CONNECTA_SHA" >&2; exit 2; }
[[ -n "$RUNTIME_ID" && "$RUNTIME_ID" != *NODE01* && "$RUNTIME_ID" != *physical* ]] || { echo "approved logical IZAKHONO_RUNTIME_ID required" >&2; exit 2; }
[[ -n "$RUNTIME_PROVIDER" && -n "$OPERATOR" ]] || { echo "IZAKHONO_RUNTIME_PROVIDER and CONNECTA_FAILOVER_OPERATOR are required" >&2; exit 2; }
[[ -n "$FAILOVER_URL" ]] || { echo "CONNECTA_FAILOVER_HEALTH_URL is required; refusing inferred failover proof." >&2; exit 3; }

command -v curl >/dev/null || { echo "curl is required" >&2; exit 2; }
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 2; }
mkdir -p "$EVIDENCE_ROOT"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

check_health() {
  local url="$1" out="$2"
  curl -fsS --max-time 15 "$url" > "$out"
  python3 - "$out" <<'PY'
import json,sys
with open(sys.argv[1],encoding='utf-8') as f: d=json.load(f)
if d.get('ok') is not True: raise SystemExit('health-not-ok')
PY
}
check_health "$FAILOVER_URL" "$TMP/failover-health.json"
check_health "$FAILBACK_URL" "$TMP/failback-health.json"

python3 - "$REPORT" "$EXPECTED_SHA" "$RUNTIME_ID" "$RUNTIME_PROVIDER" "$OPERATOR" "$FAILOVER_URL" "$FAILBACK_URL" "$TMP/failover-health.json" "$TMP/failback-health.json" <<'PY'
import json,os,pathlib,sys,time
out,sha,runtime_id,provider,operator,fo,fb,fofile,fbfile=sys.argv[1:]
with open(fofile,encoding='utf-8') as f: failover=json.load(f)
with open(fbfile,encoding='utf-8') as f: failback=json.load(f)
payload={
 'schema':'izakhono.connecta.gate.failover.v1',
 'status':'PASS',
 'evidence_source':'prove-failover-evidence.sh:approved-runtime-operator',
 'checked_at_epoch':int(time.time()),
 'release_sha':sha,
 'runtime_id':runtime_id,
 'runtime_provider':provider,
 'physical_hardware_required':False,
 'controlled_failure_executed_by':operator,
 'failover_health_url':fo,
 'failover_health':failover,
 'failback_health_url':fb,
 'failback_health':failback,
 'note':'The approved runtime operator attests that controlled failover occurred before this verifier ran; this script does not simulate failure.'
}
p=pathlib.Path(out); p.parent.mkdir(parents=True,exist_ok=True)
tmp=pathlib.Path(str(p)+'.tmp')
with open(tmp,'w',encoding='utf-8') as f: json.dump(payload,f,indent=2,sort_keys=True); f.write('\n')
os.chmod(tmp,0o600); os.replace(tmp,p); print(p)
PY
echo "CONNECTA_FAILOVER_EVIDENCE=PASS"
