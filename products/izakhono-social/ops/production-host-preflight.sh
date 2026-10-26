#!/usr/bin/env bash
set -euo pipefail

# CONNECTA production host preflight.
# This script deliberately does NOT assume NODE01 exists.
# It validates a machine supplied by the operator before deployment.

REPORT_DIR="${CONNECTA_PREFLIGHT_REPORT_DIR:-./connecta-preflight-evidence}"
mkdir -p "$REPORT_DIR"
REPORT="$REPORT_DIR/production-host-preflight.json"

failures=()
check() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf '[PASS] %s\n' "$name"
  else
    printf '[FAIL] %s\n' "$name"
    failures+=("$name")
  fi
}

check "Docker available" docker --version
check "Docker Compose available" docker compose version
check "Docker daemon reachable" docker info
check "Git available" git --version
check "curl available" curl --version
check "Python available" python3 --version
check "Port 3000 available or owned by CONNECTA" bash -c '! ss -ltn 2>/dev/null | grep -qE ":3000[[:space:]]" || docker ps --format "{{.Ports}}" | grep -q "3000"'

if [[ -n "${CONNECTA_DB_PASSWORD:-}" ]]; then
  printf '[PASS] CONNECTA_DB_PASSWORD supplied through environment\n'
else
  printf '[FAIL] CONNECTA_DB_PASSWORD supplied through environment\n'
  failures+=("CONNECTA_DB_PASSWORD supplied through environment")
fi

if [[ -n "${CONNECTA_OWNER_KEY:-}" ]]; then
  printf '[PASS] CONNECTA_OWNER_KEY supplied through environment\n'
else
  printf '[FAIL] CONNECTA_OWNER_KEY supplied through environment\n'
  failures+=("CONNECTA_OWNER_KEY supplied through environment")
fi

if [[ -f products/izakhono-social/docker-compose.owned.yml ]]; then
  printf '[PASS] CONNECTA owned compose file present\n'
else
  printf '[FAIL] CONNECTA owned compose file present\n'
  failures+=("CONNECTA owned compose file present")
fi

if docker compose -f products/izakhono-social/docker-compose.owned.yml config >/dev/null 2>&1; then
  printf '[PASS] CONNECTA compose configuration valid\n'
else
  printf '[FAIL] CONNECTA compose configuration valid\n'
  failures+=("CONNECTA compose configuration valid")
fi

python3 - "$REPORT" "${failures[*]:-}" <<'PY'
import json, os, platform, socket, sys, time
path=sys.argv[1]
failures=[x for x in sys.argv[2].split('\n') if x] if len(sys.argv)>2 and sys.argv[2] else []
status='PASS' if not failures else 'NOT_READY'
report={
  'schema':'izakhono.connecta.gate.production-host-preflight.v1',
  'status':status,
  'evidence_source':'operator_supplied_production_host',
  'checked_at_epoch':int(time.time()),
  'hostname':socket.gethostname(),
  'platform':platform.platform(),
  'failures':failures,
  'node01_assumption':False,
  'deployment_authority':'operator-controlled-production-host',
  'public_cutover_performed':False,
  'notes':'PASS means this host is suitable for the next controlled deployment rehearsal; it does not prove public production readiness.'
}
with open(path,'w',encoding='utf-8') as f:
    json.dump(report,f,indent=2)
    f.write('\n')
print(json.dumps(report,indent=2))
if status != 'PASS':
    raise SystemExit(2)
PY
