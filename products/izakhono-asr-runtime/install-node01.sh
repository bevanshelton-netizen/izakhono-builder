#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "$(id -u)" -ne 0 ]; then echo "[STOP] Run as root." >&2; exit 1; fi
APP_DIR="/opt/izakhono-asr-runtime"
DATA_DIR="/var/lib/izakhono/asr"
ENV_DIR="/etc/izakhono/apps"
ENV_FILE="$ENV_DIR/izakhono-asr-runtime.env"
SERVICE="/etc/systemd/system/izakhono-asr-runtime.service"
mkdir -p "$APP_DIR" "$DATA_DIR" "$ENV_DIR"
install -m 0755 "$ROOT_DIR/app.py" "$APP_DIR/app.py"
command -v python3 >/dev/null 2>&1 || { echo "[STOP] python3 missing" >&2; exit 1; }
if [ ! -d "$APP_DIR/.venv" ]; then python3 -m venv "$APP_DIR/.venv"; fi
"$APP_DIR/.venv/bin/pip" install --upgrade pip wheel
"$APP_DIR/.venv/bin/pip" install "faster-whisper>=1.1,<2"
if [ ! -f "$ENV_FILE" ]; then
  KEY="$("$APP_DIR/.venv/bin/python" -c 'import secrets; print(secrets.token_urlsafe(48))')"
  cat > "$ENV_FILE" <<EOF
IZAKHONO_ASR_HOST=127.0.0.1
IZAKHONO_ASR_PORT=9732
IZAKHONO_ASR_INTERNAL_KEY=$KEY
IZAKHONO_ASR_MODEL_PATH=$DATA_DIR/model
EOF
  chmod 600 "$ENV_FILE"
fi
cat > "$SERVICE" <<EOF
[Unit]
Description=IZAKHONO local speech recognition runtime
After=network.target
[Service]
Type=simple
EnvironmentFile=$ENV_FILE
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/.venv/bin/python $APP_DIR/app.py
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable izakhono-asr-runtime.service >/dev/null
systemctl restart izakhono-asr-runtime.service
sleep 2
curl -fsS http://127.0.0.1:9732/healthz || {
 echo "[SAFE STOP] ASR service installed but model is not staged or service is not ready." >&2
 exit 2
}
