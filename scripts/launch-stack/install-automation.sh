#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then echo 'Run as root (sudo).'; exit 1; fi
SOURCE=/opt/izakhono/systemd
[ -d "$SOURCE" ] || { echo 'Installed IZAKHONO systemd units not found.'; exit 1; }

for unit in "$SOURCE"/*.service "$SOURCE"/*.timer; do
  [ -f "$unit" ] || continue
  install -m 0644 "$unit" "/etc/systemd/system/$(basename "$unit")"
done
systemctl daemon-reload
systemctl enable --now izakhono-health.timer izakhono-backup.timer izakhono-restore-rehearsal.timer

echo '[PASS] Host-local health checks, daily backups and weekly restore rehearsals are scheduled.'
systemctl list-timers --all --no-pager 'izakhono-*' || true
