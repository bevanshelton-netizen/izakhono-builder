#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
REPORT="${1:-/tmp/izakhono-video-runtime-report.json}"
APP_DIR="/opt/izakhono-video-runtime"
COMFY_VENV="/opt/izakhono-comfyui/.venv"
ENV_DIR="/etc/izakhono/apps"
ENV_FILE="$ENV_DIR/izakhono-video-runtime.env"
SERVICE="/etc/systemd/system/izakhono-video-runtime.service"
MODEL_DIR="/var/lib/izakhono/models/wan2.1-i2v-480p-diffusers"
OUTPUT_DIR="/var/lib/izakhono/video"

if [ "$(id -u)" -ne 0 ]; then echo "[STOP] Run as root." >&2; exit 1; fi
mkdir -p "$APP_DIR" "$ENV_DIR" "$MODEL_DIR" "$OUTPUT_DIR" "$(dirname "$REPORT")"
install -m 0755 "$ROOT_DIR/app.py" "$APP_DIR/app.py"

if [ ! -x "$COMFY_VENV/bin/python" ]; then
  echo "[1/5] Preparing the existing IZAKHONO GPU Python stack..."
  set +e
  bash "$REPO_ROOT/products/izakhono-media-runtime/install-node01.sh" /tmp/izakhono-video-media-prep.json
  RC=$?
  set -e
  if [ "$RC" -ne 0 ] && [ "$RC" -ne 2 ]; then exit "$RC"; fi
fi
if [ ! -x "$COMFY_VENV/bin/python" ]; then echo "[STOP] GPU Python environment unavailable." >&2; exit 1; fi

echo "[2/5] Installing local video inference libraries into the owner GPU environment..."
"$COMFY_VENV/bin/python" -m pip install --upgrade   "diffusers>=0.34,<1.0" "transformers>=4.50,<5.0" "accelerate>=1.0,<2.0"   "safetensors>=0.4,<1.0" "pillow>=10,<13" "imageio>=2.34,<3" "imageio-ffmpeg>=0.5,<1"

if [ ! -f "$ENV_FILE" ]; then
  KEY="$("$COMFY_VENV/bin/python" - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"
  cat > "$ENV_FILE" <<EOF
IZAKHONO_VIDEO_HOST=127.0.0.1
IZAKHONO_VIDEO_PORT=9741
IZAKHONO_VIDEO_INTERNAL_KEY=$KEY
IZAKHONO_VIDEO_MODEL_DIR=$MODEL_DIR
IZAKHONO_VIDEO_OUTPUT_DIR=$OUTPUT_DIR
IZAKHONO_VIDEO_ASSET_BASE_URL=http://127.0.0.1:9741
IZAKHONO_VIDEO_MAX_AREA=399360
IZAKHONO_VIDEO_FPS=16
IZAKHONO_VIDEO_NUM_FRAMES=81
IZAKHONO_VIDEO_GUIDANCE=5.0
HF_HUB_OFFLINE=1
TRANSFORMERS_OFFLINE=1
HF_DATASETS_OFFLINE=1
EOF
  chmod 600 "$ENV_FILE"
fi

echo "[3/5] Installing owner-host service..."
cat > "$SERVICE" <<EOF
[Unit]
Description=IZAKHONO generative video runtime
After=network.target

[Service]
Type=simple
EnvironmentFile=$ENV_FILE
WorkingDirectory=$APP_DIR
ExecStart=$COMFY_VENV/bin/python $APP_DIR/app.py
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$OUTPUT_DIR $MODEL_DIR

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable izakhono-video-runtime.service >/dev/null
systemctl restart izakhono-video-runtime.service
sleep 3

echo "[4/5] Checking local generative-video readiness..."
CODE="$(curl -sS -o /tmp/izakhono-video-health.json -w '%{http_code}' http://127.0.0.1:9741/healthz || true)"
HEALTH="$(cat /tmp/izakhono-video-health.json 2>/dev/null || echo '{}')"
READY=false
if [ "$CODE" = "200" ]; then READY=true; fi

echo "[5/5] Writing evidence report..."
python3 - "$REPORT" "$READY" "$CODE" "$HEALTH" <<'PY'
import datetime,json,sys
path,ready,code,health_raw=sys.argv[1:]
try: health=json.loads(health_raw)
except Exception: health={}
report={
 "schema":"izakhono.video.node01.v1",
 "generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "ready":ready.lower()=="true",
 "http_code":int(code) if code.isdigit() else None,
 "health":health,
 "live_claim_allowed":ready.lower()=="true",
 "next_action":None if ready.lower()=="true" else (
   "Stage an owner-approved Wan2.1 I2V Diffusers snapshot in the configured model directory using stage-model-node01.sh with an exact revision, "
   "and confirm the NODE01 NVIDIA GPU has sufficient memory. The service remains offline and does not silently download weights."
 )
}
open(path,"w",encoding="utf-8").write(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
PY

if [ "$READY" != "true" ]; then
  echo "[SAFE STOP] Video service installed, but local Wan model/GPU readiness is not proven."
  exit 2
fi
echo "[PASS] IZAKHONO generative video runtime is healthy."
