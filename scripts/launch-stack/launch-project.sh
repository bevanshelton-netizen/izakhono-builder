#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then echo 'Run as root (sudo).'; exit 1; fi
REPO="${1:-}"
DOMAIN="${2:-}"
OPTION="${3:-}"
[ -d "$REPO" ] || { echo 'Usage: launch-project.sh <repo-path> <domain> [--with-db]'; exit 2; }
MANIFEST="$REPO/.izakhono.json"
[ -f "$MANIFEST" ] || { echo 'Repository has no .izakhono.json contract.'; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SLUG="$(jq -r '.slug // empty' "$MANIFEST")"
[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$ ]] || { echo 'Unsafe project slug.'; exit 1; }
COMMIT="$(git -C "$REPO" rev-parse HEAD 2>/dev/null || echo local-source)"
STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
PREFLIGHT=not-requested
REHEARSAL=not-requested
APP_READINESS=not-requested
if jq -e '.commercial.readiness_required == true' "$MANIFEST" >/dev/null 2>&1; then APP_READINESS=required; fi

if jq -e '.alpha.preflight == true' "$MANIFEST" >/dev/null 2>&1; then
  GATE="$REPO/scripts/izakhono/alpha-preflight.sh"
  [ -f "$GATE" ] || { echo 'Manifest requires the fixed preflight but the reviewed script is missing.'; exit 1; }
  echo 'Running repository-reviewed local preflight...'
  bash "$GATE"
  PREFLIGHT=pass
fi

if jq -e '.alpha.rehearsal == true' "$MANIFEST" >/dev/null 2>&1; then
  GATE="$REPO/scripts/izakhono/alpha-rehearsal.sh"
  [ -f "$GATE" ] || { echo 'Manifest requires the fixed rehearsal but the reviewed script is missing.'; exit 1; }
  echo 'Running repository-reviewed local rehearsal...'
  bash "$GATE"
  REHEARSAL=pass
fi

if [ "$OPTION" = '--with-db' ] && [ ! -f "/opt/izakhono/secrets/${SLUG}.db.env" ]; then
  bash "$SCRIPT_DIR/provision-project-db.sh" "$SLUG"
fi

bash "$SCRIPT_DIR/deploy-app.sh" "$REPO" "$DOMAIN" --require-public
[ "$APP_READINESS" = required ] && APP_READINESS=pass

FINISHED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
EVIDENCE_DIR=/opt/izakhono/evidence
mkdir -p "$EVIDENCE_DIR"
EVIDENCE="$EVIDENCE_DIR/${SLUG}-${FINISHED//[:]/}.txt"
umask 077
cat > "$EVIDENCE" <<EOF
IZAKHONO_LAUNCH_EVIDENCE_VERSION=2
PROJECT_SLUG=$SLUG
GIT_COMMIT=$COMMIT
DOMAIN=$DOMAIN
STARTED_UTC=$STARTED
FINISHED_UTC=$FINISHED
LOCAL_FIXED_PREFLIGHT=$PREFLIGHT
LOCAL_FIXED_REHEARSAL=$REHEARSAL
CONTAINER_HEALTH_GATE=pass
PUBLIC_HTTPS_HEALTH_GATE=pass
APP_DECLARED_COMMERCIAL_READINESS=$APP_READINESS
COMMERCIAL_RUNTIME_PUBLICATION=pass
PRODUCT_SPECIFIC_BUSINESS_GATES=separate
EOF
sha256sum "$EVIDENCE" > "$EVIDENCE.sha256"
chmod 600 "$EVIDENCE" "$EVIDENCE.sha256"

echo "[PASS] Commercial runtime publication gate completed for $SLUG."
echo "Launch evidence: $EVIDENCE"
echo 'Product-specific payment, legal, privacy, code-signing and customer-acceptance gates remain separate unless the application readiness endpoint explicitly covers them.'
