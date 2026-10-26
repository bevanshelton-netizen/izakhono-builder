#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROFILE="$ROOT/products/izakhono-node/profiles/connecta.production.json"
REPORT="${CONNECTA_REPORT:-$HOME/CONNECTA-NODE01-REPORT.txt}"
EVIDENCE_ROOT="${CONNECTA_EVIDENCE_ROOT:-/var/lib/izakhono/evidence/connecta}"

log(){ printf '%s\n' "$*" | tee -a "$REPORT"; }
stop(){ log "[STOP] $*"; exit 1; }

: > "$REPORT"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
log "============================================================"
log "CONNECTA - IZAKHONO NODE01"
log "NATIVE LINUX OWNED DEPLOYMENT + FULL STACK HEALTH PROOF"
log "NO DNS OR PUBLIC CUTOVER IS PERFORMED BY THIS LAUNCHER"
log "============================================================"

command -v git >/dev/null || stop "Git is not available."
command -v docker >/dev/null || stop "Docker is not available."
command -v curl >/dev/null || stop "curl is not available."
command -v python3 >/dev/null || stop "Python 3 is not available."

REF="$(git -C "$ROOT" rev-parse HEAD)"
[[ "$REF" =~ ^[0-9a-f]{40}$ ]] || stop "Could not determine immutable repository commit."

log "[1/7] Checking NODE01 guardian..."
curl -fsS http://127.0.0.1:9191/readyz | tee -a "$REPORT" >/dev/null || stop "NODE01 guardian is not ready. No public route was changed."

log "[2/7] Checking CONNECTA secret environment..."
[[ -f /etc/izakhono/apps/connecta.env ]] || stop "Missing /etc/izakhono/apps/connecta.env"

log "[3/7] Deploying immutable CONNECTA stack at $REF..."
JOB="$(python3 - "$PROFILE" "$REF" <<'PY'
import json, sys
profile, ref = sys.argv[1:]
with open(profile, encoding='utf-8') as f:
    data = json.load(f)
data['ref'] = ref
print(json.dumps(data, separators=(',', ':')))
PY
)"

bash "$ROOT/products/izakhono-node/deploy.sh" "$JOB" 2>&1 | tee -a "$REPORT" || stop "CONNECTA did not pass local owned deployment proof. Public DNS and external fallback remain untouched."

log "[4/7] Verifying full web + engine + database health and persistence smoke..."
curl -fsS http://127.0.0.1:3080/health | tee "$TMP_DIR/health.json" | tee -a "$REPORT" >/dev/null || stop "CONNECTA full-stack health failed after deployment."
CONNECTA_WEB_URL=http://127.0.0.1:3080 node "$ROOT/products/izakhono-social/scripts/smoke-web-runtime.mjs" 2>&1 | tee -a "$REPORT" || stop "CONNECTA registration/login/persistence smoke failed."

log "[5/7] Creating target-machine recovery backup..."
export CONNECTA_COMPOSE_PROJECT=izakhono-connecta
export CONNECTA_COMPOSE_FILE="$ROOT/products/izakhono-social/docker-compose.owned.yml"
mkdir -p /var/backups/connecta
bash "$ROOT/products/izakhono-social/ops/backup.sh" /var/backups/connecta 2>&1 | tee -a "$REPORT" || stop "CONNECTA backup proof failed. Public cutover remains blocked."

log "[6/7] Proving non-destructive restore on NODE01..."
BACKUP="$(find /var/backups/connecta -maxdepth 1 -type d -name 'connecta-*' -print | sort | tail -n 1)"
[[ -n "$BACKUP" ]] || stop "No CONNECTA backup directory was produced."
bash "$ROOT/products/izakhono-social/ops/restore-test.sh" "$BACKUP" 2>&1 | tee "$TMP_DIR/restore.log" | tee -a "$REPORT"
RESTORE_JSON="$TMP_DIR/restore.json"
tail -n 1 "$TMP_DIR/restore.log" > "$RESTORE_JSON"
python3 - "$RESTORE_JSON" <<'PY' || stop "Restore proof did not produce valid machine-readable evidence."
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    data=json.load(f)
assert data.get('ok') is True and data.get('destructive') is False
PY

log "[7/7] Writing fail-closed CONNECTA readiness evidence..."
CONNECTA_EVIDENCE_ROOT="$EVIDENCE_ROOT" CONNECTA_EVIDENCE_COMMIT="$REF" \
  bash "$ROOT/products/izakhono-social/ops/write-readiness-evidence.sh" \
  "$TMP_DIR/health.json" "$RESTORE_JSON" "$BACKUP" 2>&1 | tee -a "$REPORT" \
  || stop "CONNECTA readiness evidence generation failed. Public cutover remains blocked."

log "============================================================"
log "[PASS] CONNECTA BUILT / VERIFIED LOCALLY on NODE01."
log "Registration/login/persistence smoke + backup + non-destructive restore proof passed."
log "Local and backup/restore evidence was written to: $EVIDENCE_ROOT"
log "Public status is NOT claimed by this result."
log "Next gates: cluster/failover + security + EDGE/TLS + DNS + independent HTTPS verification."
log "Report: $REPORT"
log "============================================================"
