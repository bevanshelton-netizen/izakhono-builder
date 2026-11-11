#!/usr/bin/env bash
set -euo pipefail
: "${IZAKHONO_ASR_MODEL_REVISION:=}"
: "${IZAKHONO_ASR_MODEL_DOWNLOAD_APPROVED:=false}"
if [ "$IZAKHONO_ASR_MODEL_DOWNLOAD_APPROVED" != "true" ]; then
 echo "[STOP] Explicit model download approval is required." >&2; exit 2
fi
if [ -z "$IZAKHONO_ASR_MODEL_REVISION" ]; then
 echo "[STOP] Set an exact approved CTranslate2 model revision." >&2; exit 2
fi
APP_DIR="/opt/izakhono-asr-runtime"
MODEL_REPO="${IZAKHONO_ASR_MODEL_REPO:-Systran/faster-whisper-small}"
MODEL_PATH="/var/lib/izakhono/asr/model"
"$APP_DIR/.venv/bin/pip" install "huggingface_hub>=0.28,<1.0"
"$APP_DIR/.venv/bin/python" - "$MODEL_REPO" "$IZAKHONO_ASR_MODEL_REVISION" "$MODEL_PATH" <<'PY'
import json,sys,datetime
from pathlib import Path
from huggingface_hub import snapshot_download
repo,revision,dest=sys.argv[1:]
path=snapshot_download(repo_id=repo,revision=revision,local_dir=dest)
manifest={"schema":"izakhono.asr.model.v1","repo":repo,"revision":revision,
 "path":path,"staged_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "commercial_use_review_required":True}
Path("/var/lib/izakhono/asr/model-manifest.json").write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
PY
systemctl restart izakhono-asr-runtime.service
curl -fsS http://127.0.0.1:9732/healthz
