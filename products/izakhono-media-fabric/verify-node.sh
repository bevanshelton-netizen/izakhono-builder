#!/usr/bin/env bash
set -euo pipefail

FABRIC_ENV="${1:-/etc/izakhono/apps/izakhono-media-fabric.env}"
REPORT="${2:-/tmp/izakhono-media-fabric-verify.json}"
[[ -f "$FABRIC_ENV" ]] || { echo "Missing $FABRIC_ENV"; exit 2; }

set -a
# shellcheck disable=SC1090
source "$FABRIC_ENV"
set +a

URL="${IZAKHONO_MEDIA_FABRIC_URL:-http://127.0.0.1:9751}"
HEALTH="$(curl -fsS --max-time 5 "$URL/healthz")"
WORKER_ACTIVE=false
if systemctl is-active --quiet izakhono-media-worker.service; then WORKER_ACTIVE=true; fi

python3 - "$REPORT" "$HEALTH" "$WORKER_ACTIVE" <<'PY'
import datetime,json,sys
path,raw,worker=sys.argv[1:]
health=json.loads(raw)
report={
 "schema":"izakhono.media.fabric.verify.v1",
 "generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "broker_ok":bool(health.get("ok")),
 "healthy_workers":int(health.get("healthy_workers") or 0),
 "replicated_storage":bool(health.get("replicated_storage")),
 "production_ready":bool(health.get("production_ready")),
 "worker_service_active":worker.lower()=="true",
 "live_claim_allowed":bool(health.get("production_ready")),
}
open(path,"w",encoding="utf-8").write(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
if not health.get("ok"):
    raise SystemExit(1)
PY
