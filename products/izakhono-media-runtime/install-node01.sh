#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
REPORT="${1:-/tmp/izakhono-create-media-report.json}"
APP_DIR="/opt/izakhono-media-runtime"
CREATE_DIR="/opt/izakhono-create"
COMFY_DIR="/opt/izakhono-comfyui"
ENV_DIR="/etc/izakhono/apps"
ENV_FILE="$ENV_DIR/izakhono-create-media.env"
MEDIA_SERVICE="/etc/systemd/system/izakhono-media-runtime.service"
GATEWAY_SERVICE="/etc/systemd/system/izakhono-create-media-gateway.service"
COMFY_SERVICE="/etc/systemd/system/izakhono-comfyui.service"

if [ "$(id -u)" -ne 0 ]; then
  echo "[STOP] Run as root." >&2
  exit 1
fi

mkdir -p "$APP_DIR" "$CREATE_DIR" "$ENV_DIR" "$(dirname "$REPORT")"
install -m 0755 "$ROOT_DIR/app.py" "$APP_DIR/app.py"
install -m 0755 "$REPO_ROOT/apps/izakhono-create/media-gateway.py" "$CREATE_DIR/media-gateway.py"

command -v python3 >/dev/null 2>&1 || { echo "[STOP] python3 missing" >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "[STOP] git missing" >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "[STOP] curl missing" >&2; exit 1; }

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

if [ ! -d "$COMFY_DIR/.git" ]; then
  echo "[1/6] Installing owner-host ComfyUI source..."
  rm -rf "$COMFY_DIR"
  git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git "$COMFY_DIR"
else
  echo "[1/6] Existing ComfyUI installation found."
fi

echo "[2/6] Preparing isolated Python environment..."
if [ ! -d "$COMFY_DIR/.venv" ]; then
  python3 -m venv "$COMFY_DIR/.venv"
fi
"$COMFY_DIR/.venv/bin/python" -m pip install --upgrade pip wheel
"$COMFY_DIR/.venv/bin/pip" install -r "$COMFY_DIR/requirements.txt"

if [ ! -f "$ENV_FILE" ]; then
  KEY="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"
  cat > "$ENV_FILE" <<EOF
IZAKHONO_MEDIA_HOST=127.0.0.1
IZAKHONO_MEDIA_PORT=9696
IZAKHONO_MEDIA_INTERNAL_KEY=$KEY
IZAKHONO_COMFYUI_URL=http://127.0.0.1:8188
IZAKHONO_MEDIA_RENDER_URL=http://127.0.0.1:9696
IZAKHONO_CREATE_MEDIA_HOST=127.0.0.1
IZAKHONO_CREATE_MEDIA_PORT=9695
IZAKHONO_MEDIA_ALLOW_EXTERNAL_FALLBACK=false
IZAKHONO_MEDIA_ALLOW_CPU=false
IZAKHONO_MEDIA_CHECKPOINT=
IZAKHONO_MEDIA_JOB_TIMEOUT=420
EOF
  chmod 600 "$ENV_FILE"
fi

# Deterministically use an existing checkpoint when no checkpoint is configured.
CURRENT="$(sed -n 's/^IZAKHONO_MEDIA_CHECKPOINT=//p' "$ENV_FILE" | tail -1)"
if [ -z "$CURRENT" ]; then
  FIRST="$(find "$COMFY_DIR/models/checkpoints" -maxdepth 1 -type f \( -iname '*.safetensors' -o -iname '*.ckpt' \) -printf '%f\n' 2>/dev/null | sort | head -1 || true)"
  if [ -n "$FIRST" ]; then
    sed -i "s|^IZAKHONO_MEDIA_CHECKPOINT=.*|IZAKHONO_MEDIA_CHECKPOINT=$FIRST|" "$ENV_FILE"
    CURRENT="$FIRST"
  fi
fi

echo "[3/6] Installing loopback services..."
cat > "$COMFY_SERVICE" <<EOF
[Unit]
Description=IZAKHONO local ComfyUI renderer
After=network.target

[Service]
Type=simple
WorkingDirectory=$COMFY_DIR
ExecStart=$COMFY_DIR/.venv/bin/python $COMFY_DIR/main.py --listen 127.0.0.1 --port 8188 --disable-auto-launch
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat > "$MEDIA_SERVICE" <<EOF
[Unit]
Description=IZAKHONO CREATE Media Runtime
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

[Install]
WantedBy=multi-user.target
EOF


cat > "$GATEWAY_SERVICE" <<EOF
[Unit]
Description=IZAKHONO CREATE Media Gateway
After=network.target izakhono-media-runtime.service
Wants=izakhono-media-runtime.service

[Service]
Type=simple
EnvironmentFile=$ENV_FILE
WorkingDirectory=$CREATE_DIR
ExecStart=/usr/bin/python3 $CREATE_DIR/media-gateway.py
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable izakhono-comfyui.service izakhono-media-runtime.service izakhono-create-media-gateway.service >/dev/null

echo "[4/6] Starting local services..."
systemctl restart izakhono-comfyui.service
for i in $(seq 1 90); do
  if curl -fsS http://127.0.0.1:8188/system_stats >/dev/null 2>&1; then break; fi
  sleep 2
done
systemctl restart izakhono-media-runtime.service
systemctl restart izakhono-create-media-gateway.service
sleep 2

echo "[5/6] Checking runtime health..."
HTTP_CODE="$(curl -sS -o /tmp/izakhono-media-health.json -w '%{http_code}' http://127.0.0.1:9696/healthz || true)"
HEALTH="$(cat /tmp/izakhono-media-health.json 2>/dev/null || echo '{}')"
GATEWAY_CODE="$(curl -sS -o /tmp/izakhono-media-gateway-health.json -w '%{http_code}' http://127.0.0.1:9695/media/healthz || true)"
GATEWAY_HEALTH="$(cat /tmp/izakhono-media-gateway-health.json 2>/dev/null || echo '{}')"

CHECKPOINT="$(sed -n 's/^IZAKHONO_MEDIA_CHECKPOINT=//p' "$ENV_FILE" | tail -1)"
READY=false
ALLOW_CPU="$(sed -n 's/^IZAKHONO_MEDIA_ALLOW_CPU=//p' "$ENV_FILE" | tail -1 | tr '[:upper:]' '[:lower:]')"
if [ "$HTTP_CODE" = "200" ] && [ "$GATEWAY_CODE" = "200" ] && { [ "$GPU_AVAILABLE" = "true" ] || [ "$ALLOW_CPU" = "true" ]; }; then READY=true; fi

echo "[6/6] Writing evidence report..."
python3 - "$REPORT" "$READY" "$HTTP_CODE" "$GATEWAY_CODE" "$CHECKPOINT" "$GPU_JSON" "$HEALTH" "$GATEWAY_HEALTH" <<'PY'
import json,sys,datetime
path, ready, code, gateway_code, checkpoint, gpu_raw, health_raw, gateway_health_raw = sys.argv[1:]
try: gpu=json.loads(gpu_raw)
except Exception: gpu={"available":False}
try: health=json.loads(health_raw)
except Exception: health={}
try: gateway_health=json.loads(gateway_health_raw)
except Exception: gateway_health={}
report={
  "schema":"izakhono.create.media.node01.v1",
  "generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "ready":ready.lower()=="true",
  "runtime_http_code":int(code) if code.isdigit() else None,
  "gateway_http_code":int(gateway_code) if gateway_code.isdigit() else None,
  "checkpoint":checkpoint or None,
  "gpu":gpu,
  "gpu_required_for_ready":True,
  "health":health,
  "gateway_health":gateway_health,
  "next_action":None if ready.lower()=="true" else (
    "Place an owner-approved checkpoint in /opt/izakhono-comfyui/models/checkpoints and set IZAKHONO_MEDIA_CHECKPOINT in /etc/izakhono/apps/izakhono-create-media.env, then rerun."
    if not checkpoint else
    "Confirm NVIDIA GPU visibility with nvidia-smi (or explicitly set IZAKHONO_MEDIA_ALLOW_CPU=true for a slow CPU-only test), then inspect ComfyUI/checkpoint/service health. Do not call generation live until the evidence report is ready=true."
  )
}
with open(path,"w",encoding="utf-8") as f: json.dump(report,f,indent=2)
print(json.dumps(report,indent=2))
PY

if [ "$READY" != "true" ]; then
  echo "[SAFE STOP] Software installed, but renderer readiness is not yet proven."
  exit 2
fi

echo "[PASS] IZAKHONO CREATE owned media runtime is healthy on NODE01."
