#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="/opt/izakhono-media-fabric"
VENV="$APP_DIR/.venv"
ENV_DIR="/etc/izakhono/apps"
BROKER_ENV="$ENV_DIR/izakhono-media-fabric.env"
FABRIC_ENV="$ENV_DIR/izakhono-media-worker-fabric.env"
WORKER_ENV="$ENV_DIR/izakhono-media-worker.env"
SPEECH_ENV="$ENV_DIR/izakhono-speech-runtime.env"
VIDEO_ENV="$ENV_DIR/izakhono-video-runtime.env"
SERVICE="/etc/systemd/system/izakhono-media-worker.service"

if [ "$(id -u)" -ne 0 ]; then echo "[STOP] Run as root." >&2; exit 1; fi
mkdir -p "$APP_DIR" "$ENV_DIR"
install -m 0755 "$ROOT_DIR/worker.py" "$APP_DIR/worker.py"
command -v python3 >/dev/null 2>&1 || { echo "[STOP] python3 missing" >&2; exit 1; }
if ! python3 -m venv --help >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv
fi
if [ ! -d "$VENV" ]; then python3 -m venv "$VENV"; fi

if [ ! -f "$WORKER_ENV" ]; then
  NODE_ID="$(hostname -s | tr '[:upper:]' '[:lower:]')"
  cat > "$WORKER_ENV" <<EOF
IZAKHONO_MEDIA_NODE_ID=$NODE_ID
IZAKHONO_MEDIA_WORKER_ID=$NODE_ID-media
IZAKHONO_MEDIA_WORKER_CLASS=owned-runtime
IZAKHONO_MEDIA_WORKER_MAX_JOBS=1
IZAKHONO_MEDIA_WORKER_POLL_SECONDS=3
IZAKHONO_MEDIA_WORKER_LEASE_SECONDS=300
IZAKHONO_MEDIA_WORKER_LEASE_RENEW_SECONDS=60
EOF
  chmod 600 "$WORKER_ENV"
fi

if [ ! -f "$FABRIC_ENV" ] && [ -f "$BROKER_ENV" ]; then
  FABRIC_URL="$(sed -n 's/^IZAKHONO_MEDIA_FABRIC_URL=//p' "$BROKER_ENV" | tail -1)"
  FABRIC_KEY="$(sed -n 's/^IZAKHONO_MEDIA_FABRIC_INTERNAL_KEY=//p' "$BROKER_ENV" | tail -1)"
  if [ -n "$FABRIC_URL" ] && [ -n "$FABRIC_KEY" ]; then
    cat > "$FABRIC_ENV" <<EOF
IZAKHONO_MEDIA_FABRIC_URL=$FABRIC_URL
IZAKHONO_MEDIA_FABRIC_INTERNAL_KEY=$FABRIC_KEY
EOF
    chmod 600 "$FABRIC_ENV"
  fi
fi

if [ ! -f "$FABRIC_ENV" ]; then
  echo "[STOP] $FABRIC_ENV is missing."
  echo "For a remote worker, create a root-only env file containing only IZAKHONO_MEDIA_FABRIC_URL and IZAKHONO_MEDIA_FABRIC_INTERNAL_KEY."
  exit 2
fi

cat > "$SERVICE" <<EOF
[Unit]
Description=IZAKHONO Media Runtime Fabric worker
After=network.target
Wants=network.target

[Service]
Type=simple
EnvironmentFile=$FABRIC_ENV
EnvironmentFile=$WORKER_ENV
EnvironmentFile=-$SPEECH_ENV
EnvironmentFile=-$VIDEO_ENV
WorkingDirectory=$APP_DIR
ExecStart=$VENV/bin/python $APP_DIR/worker.py
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable izakhono-media-worker.service >/dev/null
systemctl restart izakhono-media-worker.service
sleep 2

if ! systemctl is-active --quiet izakhono-media-worker.service; then
  echo "[FAIL] Media worker service did not remain active."
  journalctl -u izakhono-media-worker.service -n 20 --no-pager || true
  exit 1
fi

echo "[PASS] Media worker service is running."
echo "[NOTE] It advertises only local media runtimes whose own health gates pass."
