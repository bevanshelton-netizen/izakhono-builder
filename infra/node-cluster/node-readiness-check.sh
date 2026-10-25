#!/usr/bin/env bash
set -euo pipefail

# Run this script ON the physical node being evaluated.
# It never infers readiness from GitHub or the topology file alone.

NODE_ID="${IZAKHONO_NODE_ID:-$(hostname -s)}"
EVIDENCE_DIR="${IZAKHONO_EVIDENCE_DIR:-/var/lib/izakhono/evidence}"
REPORT="$EVIDENCE_DIR/node-readiness-${NODE_ID}.json"
mkdir -p "$EVIDENCE_DIR"
chmod 700 "$EVIDENCE_DIR"

status=PASS
failures=()

check(){
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf 'PASS %s\n' "$name"
  else
    printf 'FAIL %s\n' "$name"
    failures+=("$name")
    status=FAIL
  fi
}

check "node-service-enabled" systemctl is-enabled --quiet izakhono-node.service
check "node-service-active" systemctl is-active --quiet izakhono-node.service
check "docker-active" systemctl is-active --quiet docker
check "node-readyz" curl -fsS http://127.0.0.1:9191/readyz
check "owner-repository" test -d /var/lib/izakhono-code/repos
check "deployment-root" test -d /var/lib/izakhono

if [[ "$(timedatectl show -p NTPSynchronized --value 2>/dev/null || true)" == "yes" ]]; then
  printf 'PASS time-sync\n'
else
  printf 'FAIL time-sync\n'
  failures+=("time-sync")
  status=FAIL
fi

if [[ -d /var/lib/izakhono ]] && [[ "$(df -Pk /var/lib/izakhono | awk 'NR==2 {print $4}')" =~ ^[0-9]+$ ]] && (( $(df -Pk /var/lib/izakhono | awk 'NR==2 {print $4}') > 1048576 )); then
  printf 'PASS storage\n'
else
  printf 'FAIL storage\n'
  failures+=("storage")
  status=FAIL
fi

if [[ -f /etc/izakhono/node.env ]] && [[ "$(stat -c '%a' /etc/izakhono/node.env 2>/dev/null || echo 999)" == "600" ]]; then
  printf 'PASS node-credentials-file-present\n'
else
  printf 'FAIL node-credentials-file-present\n'
  failures+=("node-credentials-file-present")
  status=FAIL
fi

python3 - "$REPORT" "$NODE_ID" "$status" "${failures[*]-}" <<'PY'
import json, os, socket, sys, time
report, node_id, status, failures = sys.argv[1:]
record = {
    "schema": "izakhono.node-readiness.v1",
    "node_id": node_id,
    "hostname": socket.gethostname(),
    "checked_at_epoch": int(time.time()),
    "status": status,
    "failures": failures.split() if failures else [],
    "evidence_source": "physical-node-execution",
}
tmp = report + ".tmp"
with open(tmp, "w", encoding="utf-8") as f:
    json.dump(record, f, indent=2, sort_keys=True)
    f.write("\n")
os.chmod(tmp, 0o600)
os.replace(tmp, report)
print(json.dumps(record, indent=2, sort_keys=True))
PY

if [[ "$status" != PASS ]]; then
  exit 4
fi

echo "IZAKHONO_NODE_READINESS=PASS"
echo "EVIDENCE=$REPORT"
