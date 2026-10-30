#!/usr/bin/env bash
set -euo pipefail

# IZAKHONO NODE01 bootstrap v1
# Installs the provider-neutral NODE agent and persistent heartbeat service.
# This script deliberately refuses to manufacture backup, security or monitoring evidence.

ROOT_DIR="${IZAKHONO_ROOT_DIR:-/opt/izakhono-builder}"
DATA_DIR="${IZAKHONO_NODE_DATA_DIR:-/var/lib/izakhono}"
NODE_ID="${IZAKHONO_NODE_ID:-NODE01}"
SERVICE_NAME="izakhono-node-heartbeat"

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "ERROR: run as root (for example: sudo $0)" >&2
    exit 1
  fi
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: required command missing: $1" >&2; exit 1; }
}

require_root
require_cmd node
require_cmd systemctl

if [[ ! -f "$ROOT_DIR/autonomy/node-agent.mjs" || ! -f "$ROOT_DIR/autonomy/node-heartbeat.mjs" ]]; then
  echo "ERROR: IZAKHONO NODE agent files were not found under $ROOT_DIR" >&2
  exit 1
fi

mkdir -p "$DATA_DIR"
chmod 0750 "$DATA_DIR"

if [[ -z "${IZAKHONO_NODE_AUTH:-}" ]]; then
  echo "ERROR: IZAKHONO_NODE_AUTH must be supplied as a runtime secret." >&2
  exit 1
fi

export IZAKHONO_NODE_ID="$NODE_ID"
export IZAKHONO_NODE_DATA_DIR="$DATA_DIR"
export IZAKHONO_NODE_STORAGE_PATH="$DATA_DIR"

# Inspect real capabilities before installing the service.
node "$ROOT_DIR/autonomy/node-agent.mjs" '{"operation":"inspect"}'

if ! command -v docker >/dev/null 2>&1 && ! command -v podman >/dev/null 2>&1; then
  echo "ERROR: Docker or Podman is required for NODE01 runtime readiness." >&2
  exit 1
fi

install -d -m 0755 /etc/systemd/system

cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=IZAKHONO NODE heartbeat
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${ROOT_DIR}
Environment=IZAKHONO_NODE_ID=${NODE_ID}
Environment=IZAKHONO_NODE_DATA_DIR=${DATA_DIR}
Environment=IZAKHONO_NODE_STORAGE_PATH=${DATA_DIR}
ExecStart=/usr/bin/env node ${ROOT_DIR}/autonomy/node-heartbeat.mjs heartbeat
Restart=always
RestartSec=15
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${DATA_DIR}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"
systemctl --no-pager --full status "$SERVICE_NAME" || true

echo "NODE01 bootstrap installed."
echo "Next required gates remain genuine backup, FORTRESS/security and monitoring evidence."
echo "Run: node $ROOT_DIR/autonomy/node-agent.mjs '{\"operation\":\"inspect\"}'"
