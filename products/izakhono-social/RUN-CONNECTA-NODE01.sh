#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROFILE="$ROOT/products/izakhono-node/profiles/connecta.production.json"
REPORT="${CONNECTA_REPORT:-$HOME/CONNECTA-RUNTIME-REPORT.txt}"
EVIDENCE_ROOT="${CONNECTA_EVIDENCE_ROOT:-/var/lib/izakhono/evidence/connecta}"

log(){ printf '%s\n' "$*" | tee -a "$REPORT"; }
stop(){ log "[STOP] $*"; exit 1; }

: > "$REPORT"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
log "============================================================"
log "CONNECTA - IZAKHONO SOFTWARE RUNTIME"
log "PROVIDER-NEUTRAL IMMUTABLE DEPLOYMENT + FULL STACK PROOF"
log "NO PHYSICAL NODE IS REQUIRED BY THIS LAUNCHER"
log "NO DNS OR PUBLIC CUTOVER IS PERFORMED BY THIS LAUNCHER"
log "============================================================"

command -v git >/dev/null || stop "Git is not available."
command -v docker >/dev/null || stop "Docker is not available."
command -v curl >/dev/null || stop "curl is not available."
command -v python3 >/dev/null || stop "Python 3 is not available."

REF="$(git -C "$ROOT" rev-parse HEAD)"
[[ "$REF" =~ ^[0-9a-f]{40}$ ]] || stop "Could not determine immutable repository commit."

log "[1/7] Selecting software runtime..."
RUNTIME_ID="${IZAKHONO_RUNTIME_ID:-${CONNECTA_RUNTIME_ID:-logical-runtime-instance}}"
RUNTIME_PROVIDER="${IZAKHONO_RUNTIME_PROVIDER:-${CONNECTA_RUNTIME_PROVIDER:-approved-compute-runtime}}"
log "runtime_id=$RUNTIME_ID"
log "runtime_provider=$RUNTIME_PROVIDER"

log "[2/7] Checking runtime readiness..."
if [[ -n "${IZAKHONO_RUNTIME_READY_URL:-}" ]]; then
  curl -fsS "$IZAKHONO_RUNTIME_READY_URL" | tee -a "$REPORT" >/dev/null || stop "Software runtime readiness check failed."
else
  log "No remote runtime readiness URL supplied; local container runtime checks will provide execution proof."
fi

log "[3/7] Checking CONNECTA secret environment..."
[[ -f "${CONNECTA_ENV_FILE:-/etc/izakhono/apps/connecta.env}" ]] || stop "Missing CONNECTA runtime secret environment."

log "[4/7] Deploying immutable CONNECTA release at $REF..."
JOB="$(python3 - "$PROFILE" "$REF" <<'PY'
import json, sys
profile, ref = sys.argv[1:]
with open(profile, encoding='utf-8') as f:
    data = json.load(f)
data['ref'] = ref
print(json.dumps(data, separators=(',', ':')))
PY
)"

bash "$ROOT/products/izakhono-node/deploy.sh" "$JOB" 2>&1 | tee -a "$REPORT" || stop "CONNECTA did not pass software-runtime deployment proof. Public DNS and external fallback remain untouched."

log "[5/7] Verifying full web + engine + database health and persistence smoke..."
curl -fsS http://127.0.0.1:3080/health | tee "$TMP_DIR/health.json" | tee -a "$REPORT" >/dev/null || stop "CONNECTA full-stack health failed after deployment."
CONNECTA_WEB_URL=http://127.0.0.1:3080 node "$ROOT/products/izakhono-social/scripts/smoke-web-runtime.mjs" 2>&1 | tee -a "$REPORT" || stop "CONNECTA registration/login/persistence smoke failed."

log "[6/7] Creating recovery backup and proving non-destructive restore..."
export CONNECTA_COMPOSE_PROJECT=izakhono-connecta
export CONNECTA_COMPOSE_FILE="$ROOT/products/izakhono-social/docker-compose.owned.yml"
mkdir -p "${CONNECTA_BACKUP_ROOT:-/var/backups/connecta}"
bash "$ROOT/products/izakhono-social/ops/backup.sh" "${CONNECTA_BACKUP_ROOT:-/var/backups/connecta}" 2>&1 | tee -a "$REPORT" || stop "CONNECTA backup proof failed."
BACKUP="$(find "${CONNECTA_BACKUP_ROOT:-/var/backups/connecta}" -maxdepth 1 -type d -name 'connecta-*' -print | sort | tail -n 1)"
[[ -n "$BACKUP" ]] || stop "No CONNECTA backup directory was produced."
bash "$ROOT/products/izakhono-social/ops/restore-test.sh" "$BACKUP" 2>&1 | tee "$TMP_DIR/restore.log" | tee -a "$REPORT" || stop "CONNECTA restore proof failed."
RESTORE_JSON="$TMP_DIR/restore.json"
tail -n 1 "$TMP_DIR/restore.log" > "$RESTORE_JSON"
python3 - "$RESTORE_JSON" <<'PY' || stop "Restore proof did not produce valid machine-readable evidence."
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    data=json.load(f)
assert data.get('ok') is True and data.get('destructive') is False
PY

log "[7/7] Writing software-runtime readiness evidence..."
CONNECTA_EVIDENCE_ROOT="$EVIDENCE_ROOT" \
CONNECTA_EVIDENCE_COMMIT="$REF" \
CONNECTA_RUNTIME_ID="$RUNTIME_ID" \
CONNECTA_RUNTIME_PROVIDER="$RUNTIME_PROVIDER" \
bash "$ROOT/products/izakhono-social/ops/write-readiness-evidence.sh" \
  "$TMP_DIR/health.json" "$RESTORE_JSON" "$BACKUP" 2>&1 | tee -a "$REPORT" \
  || stop "CONNECTA readiness evidence generation failed. Public cutover remains blocked."

log "============================================================"
log "[PASS] CONNECTA BUILT / VERIFIED in IZAKHONO SOFTWARE RUNTIME."
log "runtime_id=$RUNTIME_ID"
log "runtime_provider=$RUNTIME_PROVIDER"
log "Physical hardware dependency: NONE"
log "Public status is NOT claimed by this result."
log "Remaining gates: controlled runtime failover/failback + EDGE/TLS + DNS + independent HTTPS verification."
log "Report: $REPORT"
log "============================================================"
