#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
REPORT="${1:-/tmp/izakhono-shorts-renderer-report.json}"
APP_DIR="/opt/izakhono-shorts-renderer"
ENV_DIR="/etc/izakhono/apps"
ENV_FILE="$ENV_DIR/izakhono-shorts-renderer.env"
MEDIA_ENV="$ENV_DIR/izakhono-create-media.env"
SPEECH_ENV="$ENV_DIR/izakhono-speech-runtime.env"
VIDEO_ENV="$ENV_DIR/izakhono-video-runtime.env"
SERVICE="/etc/systemd/system/izakhono-shorts-renderer.service"
OUTPUT_DIR="/var/lib/izakhono/shorts"

if [ "$(id -u)" -ne 0 ]; then
  echo "[STOP] Run as root." >&2
  exit 1
fi

mkdir -p "$APP_DIR" "$ENV_DIR" "$OUTPUT_DIR" "$(dirname "$REPORT")"
install -m 0755 "$ROOT_DIR/app.py" "$APP_DIR/app.py"

command -v python3 >/dev/null 2>&1 || { echo "[STOP] python3 missing" >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "[STOP] curl missing" >&2; exit 1; }

echo "[1/6] Ensuring local media prerequisites..."
if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1 || ! command -v espeak-ng >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y ffmpeg espeak-ng fonts-dejavu-core
fi

# Reuse the already-standardised owner-host ComfyUI installation. If it is absent,
# call the existing media installer. Its readiness stop code (2) is safe to continue
# from because this installer will write its own evidence report and will not claim LIVE.
if ! curl -fsS http://127.0.0.1:8188/system_stats >/dev/null 2>&1; then
  echo "[2/6] Preparing shared owner-host ComfyUI..."
  set +e
  bash "$REPO_ROOT/products/izakhono-media-runtime/install-node01.sh" /tmp/izakhono-create-media-for-shorts.json
  MEDIA_RC=$?
  set -e
  if [ "$MEDIA_RC" -ne 0 ] && [ "$MEDIA_RC" -ne 2 ]; then
    echo "[STOP] Shared media runtime preparation failed with $MEDIA_RC." >&2
    exit "$MEDIA_RC"
  fi
else
  echo "[2/6] Shared owner-host ComfyUI already reachable."
fi

CHECKPOINT=""
COMFY_URL="http://127.0.0.1:8188"
if [ -f "$MEDIA_ENV" ]; then
  CHECKPOINT="$(sed -n 's/^IZAKHONO_MEDIA_CHECKPOINT=//p' "$MEDIA_ENV" | tail -1)"
  MEDIA_COMFY="$(sed -n 's/^IZAKHONO_COMFYUI_URL=//p' "$MEDIA_ENV" | tail -1)"
  if [ -n "$MEDIA_COMFY" ]; then COMFY_URL="$MEDIA_COMFY"; fi
fi

if [ ! -f "$ENV_FILE" ]; then
  KEY="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"
  cat > "$ENV_FILE" <<EOF
IZAKHONO_SHORTS_RENDERER_HOST=127.0.0.1
IZAKHONO_SHORTS_RENDERER_PORT=9721
IZAKHONO_SHORTS_RENDER_KEY=$KEY
IZAKHONO_COMFYUI_URL=$COMFY_URL
IZAKHONO_MEDIA_CHECKPOINT=$CHECKPOINT
IZAKHONO_SHORTS_OUTPUT_DIR=$OUTPUT_DIR
IZAKHONO_SHORTS_ASSET_BASE_URL=http://host.docker.internal:9721
IZAKHONO_SHORTS_ALLOW_ESPEAK=true
IZAKHONO_SHORTS_BURN_CAPTIONS=true
IZAKHONO_SHORTS_IMAGE_WIDTH=576
IZAKHONO_SHORTS_IMAGE_HEIGHT=1024
IZAKHONO_SHORTS_IMAGE_STEPS=24
IZAKHONO_SHORTS_IMAGE_CFG=6.0
IZAKHONO_SHORTS_SPEECH_URL=
IZAKHONO_SHORTS_SPEECH_KEY=
IZAKHONO_SHORTS_VIDEO_URL=
IZAKHONO_SHORTS_VIDEO_KEY=
EOF
  chmod 600 "$ENV_FILE"
else
  # Keep an existing secret/settings, but refresh shared backend facts when known.
  sed -i "s|^IZAKHONO_COMFYUI_URL=.*|IZAKHONO_COMFYUI_URL=$COMFY_URL|" "$ENV_FILE" || true
  if [ -n "$CHECKPOINT" ]; then
    sed -i "s|^IZAKHONO_MEDIA_CHECKPOINT=.*|IZAKHONO_MEDIA_CHECKPOINT=$CHECKPOINT|" "$ENV_FILE" || true
  fi
fi

set_env_value() {
  local key="$1"
  local value="$2"
  if grep -q "^$key=" "$ENV_FILE"; then
    sed -i "s|^$key=.*|$key=$value|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

# Attach quality runtimes only when their own local health gates pass.
# A failed/not-yet-staged quality model clears the adapter and preserves
# the deterministic espeak/FFmpeg fallback rather than breaking production.
SPEECH_READY=false
VIDEO_READY=false
if [ -f "$SPEECH_ENV" ] && curl -fsS http://127.0.0.1:9731/healthz >/dev/null 2>&1; then
  SPEECH_KEY="$(sed -n 's/^IZAKHONO_SPEECH_INTERNAL_KEY=//p' "$SPEECH_ENV" | tail -1)"
  if [ -n "$SPEECH_KEY" ]; then
    set_env_value IZAKHONO_SHORTS_SPEECH_URL http://127.0.0.1:9731
    set_env_value IZAKHONO_SHORTS_SPEECH_KEY "$SPEECH_KEY"
    SPEECH_READY=true
  fi
fi
if [ "$SPEECH_READY" != "true" ]; then
  set_env_value IZAKHONO_SHORTS_SPEECH_URL ""
  set_env_value IZAKHONO_SHORTS_SPEECH_KEY ""
fi

if [ -f "$VIDEO_ENV" ] && curl -fsS http://127.0.0.1:9741/healthz >/dev/null 2>&1; then
  VIDEO_KEY="$(sed -n 's/^IZAKHONO_VIDEO_INTERNAL_KEY=//p' "$VIDEO_ENV" | tail -1)"
  if [ -n "$VIDEO_KEY" ]; then
    set_env_value IZAKHONO_SHORTS_VIDEO_URL http://127.0.0.1:9741
    set_env_value IZAKHONO_SHORTS_VIDEO_KEY "$VIDEO_KEY"
    VIDEO_READY=true
  fi
fi
if [ "$VIDEO_READY" != "true" ]; then
  set_env_value IZAKHONO_SHORTS_VIDEO_URL ""
  set_env_value IZAKHONO_SHORTS_VIDEO_KEY ""
fi

echo "[quality] natural_speech=$SPEECH_READY generative_video=$VIDEO_READY"

echo "[3/6] Installing loopback/owner-host renderer service..."
cat > "$SERVICE" <<EOF
[Unit]
Description=IZAKHONO SHORTS owned renderer
After=network.target izakhono-comfyui.service
Wants=izakhono-comfyui.service

[Service]
Type=simple
EnvironmentFile=$ENV_FILE
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/python3 $APP_DIR/app.py
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$OUTPUT_DIR

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable izakhono-shorts-renderer.service >/dev/null
systemctl restart izakhono-shorts-renderer.service
sleep 2

echo "[4/6] Checking owned renderer health..."
HTTP_CODE="$(curl -sS -o /tmp/izakhono-shorts-renderer-health.json -w '%{http_code}' http://127.0.0.1:9721/healthz || true)"
HEALTH="$(cat /tmp/izakhono-shorts-renderer-health.json 2>/dev/null || echo '{}')"

echo "[5/6] Checking GPU evidence..."
GPU_JSON='{"available":false,"name":null,"memory_mb":null}'
GPU_AVAILABLE=false
if command -v nvidia-smi >/dev/null 2>&1; then
  GPU_NAME="$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1 | sed 's/"/\\"/g' || true)"
  GPU_MEM="$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1 | tr -dc '0-9' || true)"
  if [ -n "$GPU_NAME" ]; then
    GPU_AVAILABLE=true
    GPU_JSON="{\"available\":true,\"name\":\"$GPU_NAME\",\"memory_mb\":${GPU_MEM:-null}}"
  fi
fi

READY=false
if [ "$HTTP_CODE" = "200" ] && [ "$GPU_AVAILABLE" = "true" ]; then READY=true; fi

echo "[6/6] Writing evidence report..."
python3 - "$REPORT" "$READY" "$HTTP_CODE" "$GPU_JSON" "$HEALTH" "$ENV_FILE" <<'PY'
import datetime, json, sys
path, ready, code, gpu_raw, health_raw, env_file = sys.argv[1:]
try: gpu=json.loads(gpu_raw)
except Exception: gpu={"available":False}
try: health=json.loads(health_raw)
except Exception: health={}
report={
  "schema":"izakhono.shorts.renderer.node01.v1",
  "generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "ready":ready.lower()=="true",
  "renderer_http_code":int(code) if code.isdigit() else None,
  "gpu":gpu,
  "health":health,
  "environment_file":env_file,
  "live_claim_allowed":ready.lower()=="true",
  "next_action":None if ready.lower()=="true" else (
    "Confirm NVIDIA GPU visibility, ComfyUI health and an owner-approved checkpoint. "
    "The renderer deliberately remains NOT LIVE until /healthz returns 200 and GPU evidence is present."
  )
}
with open(path,"w",encoding="utf-8") as f: json.dump(report,f,indent=2)
print(json.dumps(report,indent=2))
PY

if [ "$READY" != "true" ]; then
  echo "[SAFE STOP] Renderer code is installed, but hardware/model readiness is not yet proven."
  exit 2
fi

echo "[PASS] IZAKHONO SHORTS owned renderer is healthy on NODE01."
