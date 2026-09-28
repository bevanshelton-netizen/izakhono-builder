#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/etc/izakhono/apps/izakhono-video-runtime.env"
: "${IZAKHONO_MODEL_DOWNLOAD_APPROVED:=false}"
: "${IZAKHONO_WAN_REVISION:=}"
: "${IZAKHONO_WAN_REPO:=Wan-AI/Wan2.1-I2V-14B-480P-Diffusers}"

if [ "$IZAKHONO_MODEL_DOWNLOAD_APPROVED" != "true" ]; then
  echo "[STOP] Set IZAKHONO_MODEL_DOWNLOAD_APPROVED=true only after source/licence/hardware approval." >&2
  exit 2
fi
if [ -z "$IZAKHONO_WAN_REVISION" ]; then
  echo "[STOP] IZAKHONO_WAN_REVISION must be an exact upstream commit/revision." >&2
  exit 2
fi
if [ ! -f "$ENV_FILE" ]; then echo "[STOP] Install the video runtime first." >&2; exit 1; fi
set -a
. "$ENV_FILE"
set +a
PY="/opt/izakhono-comfyui/.venv/bin/python"
"$PY" -m pip install "huggingface_hub>=0.28,<1.0"
HF_HUB_OFFLINE=0 TRANSFORMERS_OFFLINE=0 "$PY" - "$IZAKHONO_WAN_REPO" "$IZAKHONO_WAN_REVISION" "$IZAKHONO_VIDEO_MODEL_DIR" <<'PY'
import datetime,json,sys
from pathlib import Path
from huggingface_hub import snapshot_download
repo,revision,target=sys.argv[1:]
path=snapshot_download(repo_id=repo,revision=revision,local_dir=target,local_files_only=False)
manifest={
 "schema":"izakhono.model.asset.v1",
 "product":"izakhono-video-runtime",
 "model_repo":repo,
 "revision":revision,
 "resolved_path":path,
 "recorded_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "license_review_required":True,
 "hardware_benchmark_required":True,
 "commercial_activation_requires_owner_approval":True
}
out=Path(target)/"IZAKHONO-MODEL-MANIFEST.json"
out.write_text(json.dumps(manifest,indent=2),encoding="utf-8")
print(json.dumps(manifest,indent=2))
PY
systemctl restart izakhono-video-runtime.service
curl -fsS http://127.0.0.1:9741/healthz
