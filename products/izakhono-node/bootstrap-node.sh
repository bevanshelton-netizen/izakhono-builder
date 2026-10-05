#!/usr/bin/env bash
set -euo pipefail

# Turn any approved Linux host into an IZAKHONO NODE role.
# Usage: sudo NODE_ID=node02 CONTROL_URL=https://control.example ./bootstrap-node.sh
NODE_ID="${NODE_ID:-node01}"
NODE_PORT="${NODE_PORT:-9191}"
NODE_HOST="${NODE_HOST:-127.0.0.1}"
NODE_ROOT="${NODE_ROOT:-/var/lib/izakhono-node}"
CONTROL_URL="${CONTROL_URL:-}"
INSTALL_ROOT="/opt/izakhono-node"
ENV_FILE="/etc/izakhono/node.env"

if [[ "$(id -u)" != "0" ]]; then echo "Run as root." >&2; exit 1; fi
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }
command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }

mkdir -p "${INSTALL_ROOT}" "${NODE_ROOT}/jobs" "${NODE_ROOT}/evidence" /etc/izakhono/apps
cp "$(dirname "$0")/node_agent.py" "${INSTALL_ROOT}/node_agent.py"
cp "$(dirname "$0")/deploy.sh" "${INSTALL_ROOT}/deploy.sh"
chmod 0755 "${INSTALL_ROOT}/node_agent.py" "${INSTALL_ROOT}/deploy.sh"

if [[ ! -f "${ENV_FILE}" ]]; then
  umask 077
  SECRET="$(openssl rand -hex 32)"
  cat >"${ENV_FILE}" <<EOF
IZAKHONO_NODE_ID=${NODE_ID}
IZAKHONO_NODE_HOST=${NODE_HOST}
IZAKHONO_NODE_PORT=${NODE_PORT}
IZAKHONO_NODE_ROOT=${NODE_ROOT}
IZAKHONO_NODE_DEPLOYER=${INSTALL_ROOT}/deploy.sh
IZAKHONO_NODE_SECRET=${SECRET}
IZAKHONO_NODE_CONTROL_URL=${CONTROL_URL}
EOF
  chmod 0600 "${ENV_FILE}"
else
  echo "Preserving existing ${ENV_FILE}; set IZAKHONO_NODE_ID there if changing logical role."
fi

cat >/etc/systemd/system/izakhono-node.service <<EOF
[Unit]
Description=IZAKHONO NODE ${NODE_ID}
After=docker.service
Requires=docker.service

[Service]
Type=simple
EnvironmentFile=${ENV_FILE}
WorkingDirectory=${INSTALL_ROOT}
ExecStart=/usr/bin/python3 ${INSTALL_ROOT}/node_agent.py
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=${NODE_ROOT} /etc/izakhono/apps

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now izakhono-node.service
sleep 1
curl -fsS "http://${NODE_HOST}:${NODE_PORT}/healthz" >/dev/null

PROOF="${NODE_ROOT}/evidence/${NODE_ID}-bootstrap-$(date +%Y%m%d-%H%M%S).txt"
{
  echo "IZAKHONO_NODE_BOOTSTRAP=VERIFIED"
  echo "NODE_ID=${NODE_ID}"
  echo "NODE_PORT=${NODE_PORT}"
  echo "BOOTSTRAPPED_AT=$(date -Iseconds)"
  echo "CONTROL_URL=${CONTROL_URL}"
} >"${PROOF}"
chmod 0600 "${PROOF}"
echo "IZAKHONO NODE ${NODE_ID} is installed and health-verified."
echo "Activation proof: ${PROOF}"
