#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo '[FAIL] This fixed bridge must run as root through its narrow sudoers rule.' >&2
  exit 77
fi
if [ "$#" -ne 0 ]; then
  echo '[FAIL] This bridge accepts no arguments.' >&2
  exit 64
fi

WAVE1_ROOT=/opt/izakhono/wave1
CONTROL_ENV=/etc/izakhono/control.env
EVIDENCE_DIR=/opt/izakhono/evidence
REPORT="$EVIDENCE_DIR/IZAKHONO-NODE01-WAVE1-REPORT.json"
DEPLOYER="$WAVE1_ROOT/products/izakhono-node/wave1_deploy.py"

[ -r "$CONTROL_ENV" ] || { echo '[FAIL] IZAKHONO Control environment is unavailable.' >&2; exit 78; }
[ -x "$DEPLOYER" ] || { echo '[FAIL] Reviewed Wave 1 deployer bundle is not installed.' >&2; exit 78; }

CONTROL_TOKEN="$(sed -n 's/^IZAKHONO_CONTROL_TOKEN=//p' "$CONTROL_ENV" | head -n1)"
[[ "$CONTROL_TOKEN" =~ ^[0-9a-fA-F]{64}$ ]] || {
  echo '[FAIL] IZAKHONO Control token is missing or malformed.' >&2
  exit 78
}

install -d -m 0750 "$EVIDENCE_DIR"
rm -f "$REPORT"

export IZAKHONO_CONTROL_URL=http://127.0.0.1:9292
export IZAKHONO_CONTROL_TOKEN="$CONTROL_TOKEN"
unset IZAKHONO_CONTROL_TOKEN_FILE

set +e
python3 "$DEPLOYER" --report "$REPORT"
rc=$?
set -e

unset IZAKHONO_CONTROL_TOKEN
CONTROL_TOKEN=

if [ -f "$REPORT" ]; then
  if getent group izakhono-runner >/dev/null 2>&1; then
    chown root:izakhono-runner "$REPORT"
    chmod 0640 "$REPORT"
  else
    chown root:root "$REPORT"
    chmod 0600 "$REPORT"
  fi
  sha256sum "$REPORT" > "$REPORT.sha256"
  chown --reference="$REPORT" "$REPORT.sha256"
  chmod --reference="$REPORT" "$REPORT.sha256"
fi

exit "$rc"
