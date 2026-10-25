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

pass(){ printf 'PASS %s\n' "$1"; }
fail(){ printf 'FAIL %s\n' "$1"; failures+=("$1"); status=FAIL; }

if systemctl is-enabled --quiet izakhono-node.service; then pass node-service-enabled; else fail node-service-enabled; fi
if systemctl is-active --quiet izakhono-node.service; then pass node-service-active; else fail node-service-active; fi
if systemctl is-active --quiet docker; then pass docker-active; else fail docker-active; fi
if curl -fsS http://127.0.0.1:9191/readyz >/dev/null; then pass node-readyz; else fail node-readyz; fi
if [[ -d /var/lib/izakhono-code/repos ]]; then pass owner-repository; else fail owner-repository; fi
if [[ -d /var/lib/izakhono ]]; then pass deployment-root; else fail deployment-root; fi

ntp="$(timedatectl show -p NTPSynchronized --value 2>/dev/null || true)"
if [[ "$ntp" == "yes" || "$ntp" == "true" ]]; then pass time-sync; else fail time-sync; fi

free_kb="$(df -Pk /var/lib/izakhono 2>/dev/null | awk 'NR==2 {print $4}')"
if [[ "$free_kb" =~ ^[0-9]+$ ]] && (( free_kb > 1048576 )); then pass storage; else fail storage; fi

if [[ -f /etc/izakhono/node.env ]]; then
  mode="$(stat -c '%a' /etc/izakhono/node.env 2>/dev/null || true)"
  if [[ "$mode" == "600" ]]; then pass node-credentials-file-protected; else fail node-credentials-file-protected; fi
else
  fail node-credentials-file-present
fi

python3 - "$REPORT" "$NODE_ID" "$status" "${failures[*]-}" "$free_kb" "$ntp" <<'PY'
import json, os, socket, sys, time
report, node_id, status, failures, free_kb, ntp = sys.argv[1:]
record = {
    "schema": "izakhono.node-readiness.v2",
    "node_id": node_id,
    "hostname": socket.gethostname(),
    "checked_at_epoch": int(time.time()),
    "status": status,
    "failures": failures.split() if failures else [],
    "evidence_source": "physical-node-execution",
    "ntp_synchronized": ntp,
    "free_storage_kb": int(free_kb) if free_kb.isdigit() else None,
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
