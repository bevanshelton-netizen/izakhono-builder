#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
DOMAIN="${1:-}"
SOURCE_DIR="${2:-}"
[[ "$DOMAIN" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]] || { echo "Usage: $0 <domain> <website-directory>" >&2; exit 1; }
[[ -d "$SOURCE_DIR" && -f "$SOURCE_DIR/index.html" ]] || { echo "Website directory must exist and contain index.html." >&2; exit 2; }
[[ -f .env ]] || { echo "Host .env is missing." >&2; exit 3; }
set -a; . ./.env; set +a
: "${HOST_RUNTIME_TOKEN:?Missing HOST_RUNTIME_TOKEN}"
API="http://127.0.0.1:8080"
TMP="$(mktemp -d)"; chmod 700 "$TMP"; trap 'rm -rf "$TMP"' EXIT

python3 - "$DOMAIN" > "$TMP/provision.json" <<'PY'
import json, sys
print(json.dumps({"domain": sys.argv[1], "source_ref": "operator-file-deploy"}))
PY
curl -fsS -X POST "$API/api/sites/provision" \
  -H "Authorization: Bearer $HOST_RUNTIME_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "@$TMP/provision.json" > "$TMP/site.json"
SITE_ID="$(jq -r '.site.id // empty' "$TMP/site.json")"
[[ -n "$SITE_ID" ]] || { echo "Provision endpoint did not return a site ID." >&2; exit 4; }

python3 - "$SOURCE_DIR" > "$TMP/deploy.json" <<'PY'
import base64, json, os, sys
root = os.path.realpath(sys.argv[1])
ignored = {".git", "node_modules", ".next", "dist", "build", "__pycache__", ".venv", "venv"}
files = []
total = 0
for current, dirs, names in os.walk(root, followlinks=False):
    dirs[:] = sorted(d for d in dirs if d not in ignored and not os.path.islink(os.path.join(current, d)))
    for name in sorted(names):
        path = os.path.join(current, name)
        if os.path.islink(path) or not os.path.isfile(path):
            continue
        rel = os.path.relpath(path, root).replace(os.sep, "/")
        data = open(path, "rb").read()
        if len(data) > 512 * 1024:
            raise SystemExit(f"File exceeds 512 KiB: {rel}")
        total += len(data)
        if total > 8 * 1024 * 1024:
            raise SystemExit("Website deployment exceeds 8 MiB total.")
        files.append({"path": rel, "content_base64": base64.b64encode(data).decode("ascii")})
        if len(files) > 200:
            raise SystemExit("Website deployment exceeds 200 files.")
if not any(item["path"] == "index.html" for item in files):
    raise SystemExit("Website deployment must include index.html.")
print(json.dumps({"files": files}, separators=(",", ":")))
PY

curl -fsS -X POST "$API/api/sites/$SITE_ID/content" \
  -H "Authorization: Bearer $HOST_RUNTIME_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "@$TMP/deploy.json" > "$TMP/deployed.json"
echo "Website content deployed atomically."
jq '{ok,site:{id:.site.id,domain:.site.domain,status:.site.status},deployment}' "$TMP/deployed.json"
echo "The site is not marked LIVE. Run ./HOST-SITE-ACCEPT.sh $DOMAIN after public DNS and HTTPS are configured."
