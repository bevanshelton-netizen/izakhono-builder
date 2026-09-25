#!/usr/bin/env bash
set -euo pipefail
ENV_FILE="/etc/izakhono/apps/izakhono-create-media.env"
echo "=== IZAKHONO CREATE MEDIA / NODE01 ==="
echo
echo "[GPU]"
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
else
  echo "nvidia-smi unavailable"
fi
echo
echo "[COMFYUI]"
curl -fsS http://127.0.0.1:8188/system_stats
echo
echo
echo "[MEDIA RUNTIME]"
curl -fsS http://127.0.0.1:9696/healthz
echo
echo
echo "[SERVICES]"
systemctl --no-pager --full status izakhono-comfyui.service izakhono-media-runtime.service | sed -n '1,80p'
echo
echo "[CONFIG]"
if [ -f "$ENV_FILE" ]; then
  grep -E '^(IZAKHONO_MEDIA_HOST|IZAKHONO_MEDIA_PORT|IZAKHONO_COMFYUI_URL|IZAKHONO_MEDIA_CHECKPOINT|IZAKHONO_MEDIA_JOB_TIMEOUT)=' "$ENV_FILE" || true
else
  echo "environment file missing"
fi
