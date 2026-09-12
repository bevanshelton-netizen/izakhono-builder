#!/usr/bin/env sh
set -eu

INSTALL_DIR="${IZ_ENGINE_DIR:-/opt/izakhono-engine}"
CONTROL_URL="${IZ_CONTROL_URL:-http://127.0.0.1:8080}"
NODE_NAME="${IZ_NODE_NAME:-$(hostname)}"
NODE_REGION="${IZ_NODE_REGION:-Johannesburg}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Engine or a Docker-compatible CLI is required." >&2
  exit 1
fi
if [ -z "${IZ_NODE_ENROLL_TOKEN:-}" ]; then
  echo "Set IZ_NODE_ENROLL_TOKEN before installation." >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
cp "$(dirname "$0")/agent.js" "$INSTALL_DIR/agent.js"
chmod 750 "$INSTALL_DIR/agent.js"

cat > /etc/systemd/system/izakhono-engine-agent.service <<EOF
[Unit]
Description=IZAKHONO Engine Node Agent
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
Environment=IZ_CONTROL_URL=$CONTROL_URL
Environment=IZ_NODE_NAME=$NODE_NAME
Environment=IZ_NODE_REGION=$NODE_REGION
EnvironmentFile=/etc/izakhono-engine-agent.env
ExecStart=/usr/bin/node $INSTALL_DIR/agent.js
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/run /var/run

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/izakhono-engine-agent.env <<EOF
IZ_NODE_ENROLL_TOKEN=$IZ_NODE_ENROLL_TOKEN
EOF
chmod 600 /etc/izakhono-engine-agent.env

systemctl daemon-reload
systemctl enable --now izakhono-engine-agent.service
systemctl status --no-pager izakhono-engine-agent.service || true
