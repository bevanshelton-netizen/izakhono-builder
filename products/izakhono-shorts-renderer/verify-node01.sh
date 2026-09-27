#!/usr/bin/env bash
set -euo pipefail
ENV_FILE="/etc/izakhono/apps/izakhono-shorts-renderer.env"

echo "=== IZAKHONO SHORTS RENDERER / NODE01 ==="
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
echo "[SHORTS RENDERER]"
curl -fsS http://127.0.0.1:9721/healthz

echo
echo
echo "[TOOLS]"
command -v ffmpeg
command -v ffprobe
command -v espeak-ng

echo
echo "[SERVICE]"
systemctl --no-pager --full status izakhono-shorts-renderer.service | sed -n '1,100p'

echo
echo "[CONFIG - secrets omitted]"
if [ -f "$ENV_FILE" ]; then
  grep -E '^(IZAKHONO_SHORTS_RENDERER_HOST|IZAKHONO_SHORTS_RENDERER_PORT|IZAKHONO_COMFYUI_URL|IZAKHONO_MEDIA_CHECKPOINT|IZAKHONO_SHORTS_OUTPUT_DIR|IZAKHONO_SHORTS_ASSET_BASE_URL|IZAKHONO_SHORTS_ALLOW_ESPEAK|IZAKHONO_SHORTS_BURN_CAPTIONS|IZAKHONO_SHORTS_SPEECH_URL|IZAKHONO_SHORTS_VIDEO_URL)=' "$ENV_FILE" || true
else
  echo "environment file missing"
fi
