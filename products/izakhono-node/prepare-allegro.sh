#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Run as root." >&2
  exit 1
fi

COMMIT="${1:-}"
CORE_URL="${2:-}"
PUBLIC_APP_URL="${3:-}"

[[ "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || {
  echo "Usage: prepare-allegro.sh <40-char-commit-sha> <https-core-url> [https-public-app-url]" >&2
  exit 2
}
[[ "$CORE_URL" == https://* ]] || {
  echo "Production Core URL must use HTTPS." >&2
  exit 2
}
if [[ -n "$PUBLIC_APP_URL" ]]; then
  [[ "$PUBLIC_APP_URL" == https://* ]] || { echo "Public app URL must use HTTPS." >&2; exit 2; }
fi

command -v git >/dev/null
command -v python3 >/dev/null

CODE_ROOT=/srv/izakhono-code/repos
TARGET="$CODE_ROOT/allegro-vibez.git"
STATE=/opt/izakhono/state/core-project-allegro-vibez.json
BUILD_ENV=/etc/izakhono/apps/allegro-vibez.public-build.env
PROFILE=/opt/izakhono-node/profiles/allegro-vibez.production.json
CTL=/opt/izakhono-control/izakhonoctl.py

mkdir -p "$CODE_ROOT" /etc/izakhono/apps
chmod 750 /etc/izakhono/apps

if [ ! -d "$TARGET" ]; then
  echo "Migrating the reviewed ALLEGRO repository into IZAKHONO CODE..."
  git clone --mirror https://github.com/bevanshelton-netizen/allegro-vibez.git "$TARGET"
  echo "[PASS] Initial ALLEGRO source mirror is now under IZAKHONO CODE."
  echo "Future NODE deployments use the local owner-controlled repository."
fi

git --git-dir="$TARGET" cat-file -e "${COMMIT}^{commit}" || {
  echo "Requested ALLEGRO commit is not present in IZAKHONO CODE." >&2
  echo "Import/update the reviewed source before deployment." >&2
  exit 3
}

[ -f "$STATE" ] || {
  echo "IZAKHONO Core project allegro-vibez is not provisioned yet." >&2
  echo "Run: sudo /opt/izakhono/bin/provision-core-project.sh allegro-vibez --allow-signup" >&2
  exit 4
}

PUBLIC_KEY="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("public_key",""))' "$STATE")"
[[ "$PUBLIC_KEY" == ik_pub_* ]] || {
  echo "Core project record did not contain a browser-safe public key." >&2
  exit 5
}

umask 077
cat >"$BUILD_ENV" <<EOF
VITE_IZAKHONO_CORE_URL=$CORE_URL
VITE_IZAKHONO_PROJECT=allegro-vibez
VITE_IZAKHONO_PUBLIC_KEY=$PUBLIC_KEY
EOF
chmod 600 "$BUILD_ENV"

ARGS=(deploy "$PROFILE" --ref "$COMMIT" --production)
[[ -n "$PUBLIC_APP_URL" ]] && ARGS+=(--public-url "$PUBLIC_APP_URL")

echo "Submitting ALLEGRO to IZAKHONO CONTROL → IZAKHONO NODE..."
python3 "$CTL" "${ARGS[@]}"
echo
echo "Use 'sudo python3 $CTL status' to watch the owner-node deployment."
