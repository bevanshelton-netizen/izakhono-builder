#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:-}"
SLUG="${IZAKHONO_BUILDER_CODE_SLUG:-izakhono-builder}"
CODE_URL="${IZAKHONO_CODE_URL:-http://127.0.0.1:8860}"
CODE_ENV="${IZAKHONO_CODE_ENV:-/etc/izakhono/code-node.env}"

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

[ -n "$SOURCE_DIR" ] || { echo "[STOP] Pass the checked-out izakhono-builder directory."; exit 2; }
SOURCE_DIR="$(readlink -f "$SOURCE_DIR")"
[ -d "$SOURCE_DIR/.git" ] || { echo "[STOP] Source is not a Git checkout: $SOURCE_DIR"; exit 3; }
[ -f "$CODE_ENV" ] || { echo "[STOP] IZAKHONO CODE NODE environment is missing."; exit 4; }

for cmd in git curl node; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "[STOP] Missing $cmd."; exit 5; }
done

curl -fsS "$CODE_URL/health" >/dev/null || { echo "[STOP] IZAKHONO CODE NODE is not healthy."; exit 6; }

ADMIN_KEY="$(awk -F= '$1=="IZAKHONO_CODE_ADMIN_KEY"{sub(/^[^=]*=/,"");print;exit}' "$CODE_ENV")"
[ -n "$ADMIN_KEY" ] || { echo "[STOP] CODE admin key unavailable."; exit 7; }

TMP="$(mktemp -d)"
TOKEN_ID=""
cleanup(){
  if [ -n "$TOKEN_ID" ]; then
    curl -fsS -X POST -H "x-izakhono-key: $ADMIN_KEY" -H "content-type: application/json" --data '{}'       "$CODE_URL/v1/repos/$SLUG/tokens/$TOKEN_ID/revoke" >/dev/null 2>&1 || true
  fi
  unset ADMIN_KEY TOKEN_VALUE BASIC
  rm -rf "$TMP"
}
trap cleanup EXIT

CREATE="$(node -e 'process.stdout.write(JSON.stringify({slug:process.argv[1],description:"IZAKHONO Builder canonical source",publicRead:false}))' "$SLUG")"
STATUS="$(curl -sS -o "$TMP/create.json" -w '%{http_code}' -X POST   -H "x-izakhono-key: $ADMIN_KEY" -H "content-type: application/json"   --data-binary "$CREATE" "$CODE_URL/v1/repos")"
if [ "$STATUS" != "201" ] && [ "$STATUS" != "409" ]; then
  echo "[STOP] CODE repository registration failed with HTTP $STATUS."
  cat "$TMP/create.json" || true
  exit 8
fi

TOKEN_BODY='{"scope":"write","label":"builder-owner-sync"}'
TOKEN_STATUS="$(curl -sS -o "$TMP/token.json" -w '%{http_code}' -X POST   -H "x-izakhono-key: $ADMIN_KEY" -H "content-type: application/json"   --data-binary "$TOKEN_BODY" "$CODE_URL/v1/repos/$SLUG/tokens")"
[ "$TOKEN_STATUS" = "201" ] || { echo "[STOP] CODE write token issue failed."; exit 9; }

TOKEN_ID="$(node -e 'const x=require(process.argv[1]); process.stdout.write(x.token.id)' "$TMP/token.json")"
TOKEN_VALUE="$(node -e 'const x=require(process.argv[1]); process.stdout.write(x.value)' "$TMP/token.json")"
BASIC="$(node -e 'process.stdout.write(Buffer.from("git:"+process.argv[1]).toString("base64"))' "$TOKEN_VALUE")"

git clone --mirror "$SOURCE_DIR" "$TMP/source.git" >/dev/null 2>&1
git -C "$TMP/source.git" -c "http.extraHeader=Authorization: Basic $BASIC" push --mirror "$CODE_URL/git/$SLUG.git" >/dev/null 2>&1

curl -fsS -X POST -H "x-izakhono-key: $ADMIN_KEY" -H "content-type: application/json" --data '{}'   "$CODE_URL/v1/repos/$SLUG/tokens/$TOKEN_ID/revoke" >/dev/null
TOKEN_ID=""
unset TOKEN_VALUE BASIC

OWNED_REPO="/var/lib/izakhono-code/repos/$SLUG.git"
[ -d "$OWNED_REPO" ] || { echo "[STOP] Owned bare repository not found after sync."; exit 10; }
SOURCE_SHA="$(git -C "$SOURCE_DIR" rev-parse HEAD)"
OWNED_SHA="$(git --git-dir="$OWNED_REPO" rev-parse refs/heads/main 2>/dev/null || true)"

echo "IZAKHONO_BUILDER_CODE_SYNC=PASS"
echo "SOURCE_SHA=$SOURCE_SHA"
echo "OWNED_MAIN_SHA=$OWNED_SHA"
echo "OWNED_REPO=$OWNED_REPO"
