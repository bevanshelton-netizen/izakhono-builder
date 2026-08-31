#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then echo 'Run as root (sudo).'; exit 1; fi
REPO="${1:-}"
DOMAIN="${2:-}"
OPTION="${3:-}"
[ -d "$REPO" ] || { echo 'Usage: launch-project.sh <repo-path> <domain> [--with-db]'; exit 2; }
[ -f "$REPO/.izakhono.json" ] || { echo 'Repository has no .izakhono.json contract.'; exit 1; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SLUG="$(jq -r '.slug // empty' "$REPO/.izakhono.json")"
[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$ ]] || { echo 'Unsafe project slug.'; exit 1; }

if [ "$OPTION" = '--with-db' ] && [ ! -f "/opt/izakhono/secrets/${SLUG}.db.env" ]; then
  bash "$ROOT_DIR/scripts/launch-stack/provision-project-db.sh" "$SLUG"
fi

bash "$ROOT_DIR/scripts/launch-stack/deploy-app.sh" "$REPO" "$DOMAIN" --require-public

echo "[PASS] Commercial publication gate completed for $SLUG."
echo 'This proves host/runtime HTTPS health only; product-specific payment, legal and acceptance gates remain separate.'
