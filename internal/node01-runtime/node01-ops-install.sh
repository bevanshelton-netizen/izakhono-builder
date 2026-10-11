#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/izakhono/node01-runtime"
SYSTEMD="/etc/systemd/system"

[ "$(id -u)" -eq 0 ] || { echo '[STOP] Run as root.'; exit 1; }
[ -d "$ROOT" ] || { echo "[STOP] $ROOT does not exist. Run node01-install.sh first."; exit 1; }

install -m 0755 "$ROOT/node01-ops-health.sh" "$ROOT/node01-ops-health.sh"
install -m 0644 "$ROOT/node01-ops-health.service" "$SYSTEMD/node01-ops-health.service"
install -m 0644 "$ROOT/node01-ops-health.timer" "$SYSTEMD/node01-ops-health.timer"

systemctl daemon-reload
systemctl enable --now node01-ops-health.timer
systemctl start node01-ops-health.service || true
systemctl --no-pager --full status node01-ops-health.timer || true

echo '[PASS] NODE01 operations guard installed.'
