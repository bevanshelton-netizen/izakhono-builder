#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/izakhono-node01"
mkdir -p "$ROOT"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
install -m 0750 "$SCRIPT_DIR/node01-watchdog.sh" "$ROOT/node01-watchdog.sh"
install -m 0644 "$SCRIPT_DIR/node01-watchdog.service" /etc/systemd/system/izakhono-node01-watchdog.service
install -m 0644 "$SCRIPT_DIR/node01-watchdog.timer" /etc/systemd/system/izakhono-node01-watchdog.timer
install -m 0750 "$SCRIPT_DIR/backup-verify.sh" "$ROOT/backup-verify.sh"

systemctl daemon-reload
systemctl enable --now izakhono-node01-watchdog.timer

systemctl --no-pager status izakhono-node01-watchdog.timer
printf '\n[PASS] NODE01 operations stack installed.\n'
