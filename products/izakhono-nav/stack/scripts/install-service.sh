#!/usr/bin/env bash
set -euo pipefail
if [[ "${EUID}" -ne 0 ]]; then echo "Run as root: sudo $0" >&2; exit 2; fi
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cat >/etc/systemd/system/izakhono-nav.service <<EOF
[Unit]
Description=IZAKHONO NAV Owned Stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$HERE
ExecStart=/usr/bin/docker compose --env-file $HERE/.env -f $HERE/compose.yaml up -d
ExecStop=/usr/bin/docker compose --env-file $HERE/.env -f $HERE/compose.yaml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable izakhono-nav.service
echo "Installed izakhono-nav.service"
