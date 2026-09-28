#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT="${1:-/tmp/izakhono-speech-runtime-report.json}"
APP_DIR="/opt/izakhono-speech-runtime"
VENV="$APP_DIR/.venv"
ENV_DIR="/etc/izakhono/apps"
ENV_FILE="$ENV_DIR/izakhono-speech-runtime.env"
SERVICE="/etc/systemd/system/izakhono-speech-runtime.service"
DATA_DIR="/var/lib/izakhono/speech"

if [ "$(id -u)" -ne 0 ]; then echo "[STOP] Run as root." >&2; exit 1; fi
mkdir -p "$APP_DIR" "$ENV_DIR" "$DATA_DIR/hf" "$(dirname "$REPORT")"
install -m 0755 "$ROOT_DIR/app.py" "$APP_DIR/app.py"

command -v python3 >/dev/null 2>&1 || { echo "[STOP] python3 missing" >&2; exit 1; }
if ! command -v espeak-ng >/dev/null 2>&1 || ! dpkg -s libsndfile1 >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv espeak-ng libsndfile1
fi
if [ ! -d "$VENV" ]; then python3 -m venv "$VENV"; fi
"$VENV/bin/python" -m pip install --upgrade pip wheel
"$VENV/bin/pip" install "kokoro>=0.9.4,<1.0" "soundfile>=0.13,<1.0"

if [ ! -f "$ENV_FILE" ]; then
  KEY="$("$VENV/bin/python" - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"
  cat > "$ENV_FILE" <<EOF
IZAKHONO_SPEECH_HOST=127.0.0.1
IZAKHONO_SPEECH_PORT=9731
IZAKHONO_SPEECH_INTERNAL_KEY=$KEY
IZAKHONO_SPEECH_MODEL_REPO=hexgrad/Kokoro-82M
IZAKHONO_SPEECH_DEFAULT_VOICE=af_heart
IZAKHONO_SPEECH_MAX_TEXT=5000
HF_HOME=$DATA_DIR/hf
HF_HUB_OFFLINE=1
TRANSFORMERS_OFFLINE=1
HF_DATASETS_OFFLINE=1
EOF
  chmod 600 "$ENV_FILE"
fi

cat > "$SERVICE" <<EOF
[Unit]
Description=IZAKHONO natural speech runtime
After=network.target

[Service]
Type=simple
EnvironmentFile=$ENV_FILE
WorkingDirectory=$APP_DIR
ExecStart=$VENV/bin/python $APP_DIR/app.py
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
systemctl enable izakhono-speech-runtime.service >/dev/null
systemctl restart izakhono-speech-runtime.service
sleep 2

CODE="$(curl -sS -o /tmp/izakhono-speech-health.json -w '%{http_code}' http://127.0.0.1:9731/healthz || true)"
HEALTH="$(cat /tmp/izakhono-speech-health.json 2>/dev/null || echo '{}')"
READY=false
if [ "$CODE" = "200" ]; then READY=true; fi

python3 - "$REPORT" "$READY" "$CODE" "$HEALTH" <<'PY'
import datetime,json,sys
path,ready,code,health_raw=sys.argv[1:]
try: health=json.loads(health_raw)
except Exception: health={}
report={
 "schema":"izakhono.speech.node01.v1",
 "generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "ready":ready.lower()=="true",
 "http_code":int(code) if code.isdigit() else None,
 "health":health,
 "live_claim_allowed":ready.lower()=="true",
 "next_action":None if ready.lower()=="true" else (
   "Stage an owner-approved Kokoro-82M snapshot into the configured HF_HOME using stage-model-node01.sh with an exact revision. "
   "The runtime stays offline and will not silently download model weights."
 )
}
open(path,"w",encoding="utf-8").write(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
PY

if [ "$READY" != "true" ]; then
  echo "[SAFE STOP] Speech service installed, but natural-voice model readiness is not proven."
  exit 2
fi
echo "[PASS] IZAKHONO natural speech runtime is healthy."
