#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo '[FAIL] Run as root on the approved NODE01 runtime host.' >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$SCRIPT_DIR/izakhono-release"
TARGET=/opt/izakhono/bin/izakhono-release

[ -f "$SOURCE" ] || { echo "[FAIL] Missing release authority: $SOURCE" >&2; exit 2; }
mkdir -p /opt/izakhono/bin
install -m 0750 "$SOURCE" "$TARGET"
chown root:root "$TARGET" || true

printf '%s\n' '[PASS] IZAKHONO sovereign release authority installed.'
printf '%s\n' "Target: $TARGET"
printf '%s\n' 'Executor: NODE01 software-runtime'
printf '%s\n' 'LIVE claim: false'
