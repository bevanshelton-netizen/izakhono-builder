#!/usr/bin/env bash
set -euo pipefail

EVIDENCE_ROOT="${IZAKHONO_EVIDENCE_ROOT:-/opt/izakhono/evidence}"
STATE_ROOT="${IZAKHONO_STATE_ROOT:-/opt/izakhono/state}"
STATE_DIR="${STATE_ROOT}/runner-keepalive"
EVIDENCE_DIR="${EVIDENCE_ROOT}/runner-keepalive"

install -d -m 0750 "${STATE_DIR}" "${EVIDENCE_DIR}"

mapfile -t services < <(
  find /etc/systemd/system -maxdepth 1 \
    \( -type f -o -type l \) \
    -name 'actions.runner.*.service' \
    -printf '%f\n' 2>/dev/null | sort -u
)

if [ "${#services[@]}" -eq 0 ]; then
  printf '%s\n' '{"schema":"izakhono.runner.keepalive.v1","status":"NO_REGISTERED_RUNNERS"}' > "${STATE_DIR}/status.json"
  exit 0
fi

started=()
active=()
failed=()

for unit in "${services[@]}"; do
  if systemctl is-active --quiet "$unit"; then
    active+=("$unit")
    continue
  fi

  if systemctl start "$unit"; then
    started+=("$unit")
    if systemctl is-active --quiet "$unit"; then
      active+=("$unit")
    else
      failed+=("$unit")
    fi
  else
    failed+=("$unit")
  fi
done

python3 - "${STATE_DIR}/status.json" "${EVIDENCE_DIR}" "${#services[@]}" \
  "$(IFS=,; echo "${active[*]}")" \
  "$(IFS=,; echo "${started[*]}")" \
  "$(IFS=,; echo "${failed[*]}")" <<'PY'
import json
import os
import sys
import tempfile
from datetime import datetime, timezone

state_file, evidence_dir, total, active_csv, started_csv, failed_csv = sys.argv[1:]
now = datetime.now(timezone.utc).isoformat()

def items(raw):
    return [x for x in raw.split(",") if x]

payload = {
    "schema": "izakhono.runner.keepalive.v1",
    "checked_at": now,
    "registered_services": int(total),
    "active_services": items(active_csv),
    "restarted_services": items(started_csv),
    "failed_services": items(failed_csv),
    "status": "PASS" if not items(failed_csv) else "DEGRADED",
    "execution_authority": "IZAKHONO NODE01",
}

directory = os.path.dirname(state_file)
os.makedirs(directory, exist_ok=True)
fd, tmp = tempfile.mkstemp(prefix=".runner-keepalive-", dir=directory, text=True)
try:
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, sort_keys=True)
        fh.write("\n")
    os.chmod(tmp, 0o640)
    os.replace(tmp, state_file)
finally:
    if os.path.exists(tmp):
        os.unlink(tmp)

if payload["restarted_services"] or payload["failed_services"]:
    safe_stamp = now.replace(":", "").replace("+", "_")
    evidence = os.path.join(evidence_dir, f"runner-keepalive-{safe_stamp}.json")
    with open(evidence, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, sort_keys=True)
        fh.write("\n")
    os.chmod(evidence, 0o640)

print(json.dumps(payload, separators=(",", ":")))
raise SystemExit(0 if payload["status"] == "PASS" else 1)
PY
