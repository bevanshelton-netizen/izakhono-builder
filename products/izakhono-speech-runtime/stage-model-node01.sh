#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/etc/izakhono/apps/izakhono-speech-runtime.env"
: "${IZAKHONO_MODEL_DOWNLOAD_APPROVED:=false}"
: "${IZAKHONO_KOKORO_REVISION:=}"

if [ "$IZAKHONO_MODEL_DOWNLOAD_APPROVED" != "true" ]; then
  echo "[STOP] Set IZAKHONO_MODEL_DOWNLOAD_APPROVED=true only after model source/licence approval." >&2
  exit 2
fi
if [ -z "$IZAKHONO_KOKORO_REVISION" ]; then
  echo "[STOP] IZAKHONO_KOKORO_REVISION must be an exact upstream commit/revision." >&2
  exit 2
fi
if [ ! -f "$ENV_FILE" ]; then echo "[STOP] Install the speech runtime first." >&2; exit 1; fi

set -a
. "$ENV_FILE"
set +a
APP_DIR="/opt/izakhono-speech-runtime"
"$APP_DIR/.venv/bin/pip" install "huggingface_hub>=0.28,<1.0"
HF_HUB_OFFLINE=0 TRANSFORMERS_OFFLINE=0 "$APP_DIR/.venv/bin/python" - "$IZAKHONO_KOKORO_REVISION" <<'PY'
import json,os,sys,datetime
from pathlib import Path
from huggingface_hub import snapshot_download
revision=sys.argv[1]
repo=os.environ.get("IZAKHONO_SPEECH_MODEL_REPO","hexgrad/Kokoro-82M")
cache=str(Path(os.environ["HF_HOME"]) / "hub")
Path(cache).mkdir(parents=True, exist_ok=True)
path=snapshot_download(repo_id=repo,revision=revision,cache_dir=cache,local_files_only=False)
manifest={
 "schema":"izakhono.model.asset.v1",
 "product":"izakhono-speech-runtime",
 "model_repo":repo,
 "revision":revision,
 "resolved_path":path,
 "recorded_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "license_review_required":True,
 "commercial_activation_requires_owner_approval":True
}
out=Path("/var/lib/izakhono/speech/model-manifest.json")
out.write_text(json.dumps(manifest,indent=2),encoding="utf-8")
print(json.dumps(manifest,indent=2))
PY
systemctl restart izakhono-speech-runtime.service
curl -fsS http://127.0.0.1:9731/healthz
