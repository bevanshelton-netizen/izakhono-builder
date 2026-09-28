#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT="${1:-/tmp/izakhono-media-fabric-broker-report.json}"
APP_DIR="/opt/izakhono-media-fabric"
VENV="$APP_DIR/.venv"
ENV_DIR="/etc/izakhono/apps"
ENV_FILE="$ENV_DIR/izakhono-media-fabric.env"
SERVICE="/etc/systemd/system/izakhono-media-fabric.service"
DATA_DIR="/var/lib/izakhono/media-fabric"

if [ "$(id -u)" -ne 0 ]; then echo "[STOP] Run as root." >&2; exit 1; fi
mkdir -p "$APP_DIR" "$ENV_DIR" "$DATA_DIR/artifacts" "$(dirname "$REPORT")"
install -m 0755 "$ROOT_DIR/app.py" "$APP_DIR/app.py"
install -m 0755 "$ROOT_DIR/worker.py" "$APP_DIR/worker.py"

command -v python3 >/dev/null 2>&1 || { echo "[STOP] python3 missing" >&2; exit 1; }
if ! python3 -m venv --help >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv
fi
if [ ! -d "$VENV" ]; then python3 -m venv "$VENV"; fi
"$VENV/bin/python" -m pip install --upgrade pip wheel >/dev/null
"$VENV/bin/pip" install "cryptography>=43,<47"

if [ ! -f "$ENV_FILE" ]; then
  readarray -t VALUES < <("$VENV/bin/python" - <<'PY'
import base64,secrets
print(secrets.token_urlsafe(48))
print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("ascii"))
PY
)
  INTERNAL_KEY="${VALUES[0]}"
  PAYLOAD_KEY="${VALUES[1]}"
  cat > "$ENV_FILE" <<EOF
IZAKHONO_MEDIA_FABRIC_HOST=127.0.0.1
IZAKHONO_MEDIA_FABRIC_PORT=9751
IZAKHONO_MEDIA_FABRIC_URL=http://127.0.0.1:9751
IZAKHONO_MEDIA_FABRIC_INTERNAL_KEY=$INTERNAL_KEY
IZAKHONO_MEDIA_FABRIC_PAYLOAD_KEY=$PAYLOAD_KEY
IZAKHONO_MEDIA_FABRIC_DB=$DATA_DIR/fabric.db
IZAKHONO_MEDIA_FABRIC_ARTIFACT_ROOT=$DATA_DIR/artifacts
IZAKHONO_MEDIA_FABRIC_ASSET_BASE_URL=http://127.0.0.1:9751
IZAKHONO_MEDIA_FABRIC_REPLICATED_STORAGE=false
IZAKHONO_MEDIA_FABRIC_LEASE_SECONDS=180
IZAKHONO_MEDIA_FABRIC_WORKER_STALE_SECONDS=120
IZAKHONO_MEDIA_FABRIC_RETRY_BASE_SECONDS=15
EOF
  chmod 600 "$ENV_FILE"
fi

cat > "$SERVICE" <<EOF
[Unit]
Description=IZAKHONO Media Runtime Fabric broker
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
systemctl enable izakhono-media-fabric.service >/dev/null
systemctl restart izakhono-media-fabric.service
sleep 2

CODE="$(curl -sS -o /tmp/izakhono-media-fabric-health.json -w '%{http_code}' http://127.0.0.1:9751/healthz || true)"
HEALTH="$(cat /tmp/izakhono-media-fabric-health.json 2>/dev/null || echo '{}')"
BROKER_READY=false
if [ "$CODE" = "200" ]; then BROKER_READY=true; fi

python3 - "$REPORT" "$BROKER_READY" "$CODE" "$HEALTH" "$ENV_FILE" <<'PY'
import datetime,json,sys
path,ready,code,health_raw,env_file=sys.argv[1:]
try: health=json.loads(health_raw)
except Exception: health={}
report={
 "schema":"izakhono.media.fabric.broker.node.v1",
 "generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "broker_ready":ready.lower()=="true",
 "http_code":int(code) if code.isdigit() else None,
 "health":health,
 "environment_file":env_file,
 "production_ready":bool(health.get("production_ready")),
 "live_claim_allowed":bool(health.get("production_ready")),
 "next_action":None if health.get("production_ready") else (
   "Attach at least one healthy media worker and place the broker database/artifact root on an approved replicated storage target "
   "before treating this stateful queue as production-HA."
 )
}
open(path,"w",encoding="utf-8").write(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
PY

if [ "$BROKER_READY" != "true" ]; then
  echo "[FAIL] Media Fabric broker health gate failed."
  exit 1
fi

echo "[PASS] Media Fabric broker software is healthy."
echo "[NOTE] Production-HA remains gated by replicated storage + healthy workers."
