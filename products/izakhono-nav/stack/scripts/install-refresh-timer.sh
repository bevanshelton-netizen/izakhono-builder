#!/usr/bin/env bash
set -euo pipefail
if [[ "${EUID}" -ne 0 ]]; then echo "Run as root: sudo $0" >&2; exit 2; fi
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cat >/etc/systemd/system/izakhono-nav-refresh.service <<EOF
[Unit]
Description=Refresh IZAKHONO NAV South Africa OSM data
After=docker.service network-online.target

[Service]
Type=oneshot
WorkingDirectory=$HERE
ExecStart=$HERE/scripts/refresh-data.sh
EOF

cat >/etc/systemd/system/izakhono-nav-refresh.timer <<EOF
[Unit]
Description=Weekly IZAKHONO NAV OSM refresh

[Timer]
OnCalendar=Sun *-*-* 03:17:00
Persistent=true
RandomizedDelaySec=1800

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now izakhono-nav-refresh.timer
echo "Installed weekly IZAKHONO NAV refresh timer."
