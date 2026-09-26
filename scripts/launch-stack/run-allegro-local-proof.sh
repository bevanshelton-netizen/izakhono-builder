#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo '[FAIL] Allegro owned proof bridge must run as root.' >&2
  exit 77
fi
if [ "$#" -ne 0 ]; then
  echo '[FAIL] Allegro owned proof bridge accepts no arguments.' >&2
  exit 64
fi

WAVE1_ROOT=/opt/izakhono/wave1
CONTROL_ENV=/etc/izakhono/control.env
EVIDENCE_DIR=/opt/izakhono/evidence
REPORT="$EVIDENCE_DIR/IZAKHONO-NODE01-ALLEGRO-REPORT.json"
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
python3 "$DEPLOYER" --only allegro-vibez --report "$REPORT"
rc=$?
set -e

unset IZAKHONO_CONTROL_TOKEN
CONTROL_TOKEN=

if [ -f "$REPORT" ]; then
  chown root:root "$REPORT"
  chmod 0600 "$REPORT"
  sha256sum "$REPORT" > "$REPORT.sha256"
  chown root:root "$REPORT.sha256"
  chmod 0600 "$REPORT.sha256"
fi

exit "$rc"
