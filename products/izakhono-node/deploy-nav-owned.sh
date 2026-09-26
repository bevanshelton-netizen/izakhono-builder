#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "[STOP] Run this activation as root." >&2
  exit 1
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
RELEASE_REF="${IZAKHONO_NAV_RELEASE_REF:-348fa0203bb52f1c440b7a6cf8c9098d6b6bb9fd}"
PROFILE_TEMPLATE="$HERE/profiles/izakhono-nav.production.json"
APP_ROOT="/var/lib/izakhono-node/apps/izakhono-nav"
SRC="$APP_ROOT/source"
ENV_FILE="/etc/izakhono/apps/izakhono-nav.env"
DATA_DIR="/var/lib/izakhono-nav"
PROJECT="izakhono-izakhono-nav"
INIT_TIMEOUT="${NAV_INIT_TIMEOUT_SECONDS:-28800}"
POLL_SECONDS="${NAV_INIT_POLL_SECONDS:-30}"

[[ "$RELEASE_REF" =~ ^[0-9a-f]{40}$ ]] || { echo "[STOP] NAV production release must be an immutable SHA." >&2; exit 2; }
command -v git >/dev/null || { echo "[STOP] git missing." >&2; exit 2; }
command -v docker >/dev/null || { echo "[STOP] docker missing." >&2; exit 2; }
command -v curl >/dev/null || { echo "[STOP] curl missing." >&2; exit 2; }
command -v python3 >/dev/null || { echo "[STOP] python3 missing." >&2; exit 2; }

# Bring NODE + CONTROL to the current reviewed implementation if they are not already ready.
if ! curl -fsS --max-time 3 http://127.0.0.1:9191/readyz >/dev/null 2>&1 || ! curl -fsS --max-time 3 http://127.0.0.1:9292/healthz >/dev/null 2>&1; then
  echo "[NAV] IZAKHONO NODE/CONTROL not ready; activating owner runtime first."
  "$HERE/install.sh"
fi

mkdir -p "$APP_ROOT" "$DATA_DIR" /etc/izakhono/apps

SOURCE="github-mirror"
REPO_URL="https://github.com/bevanshelton-netizen/izakhono-builder.git"
CANONICAL_CODE="/var/lib/izakhono-code/repos/izakhono-builder.git"
LEGACY_CODE="/srv/izakhono-code/repos/izakhono-builder.git"

if [[ ! -d "$CANONICAL_CODE" && -d "$LEGACY_CODE" ]]; then
  echo "[NAV] Migrating legacy IZAKHONO CODE mirror to the canonical /var/lib location."
  mkdir -p "$(dirname "$CANONICAL_CODE")"
  git clone --mirror "file://$LEGACY_CODE" "$CANONICAL_CODE"
fi

if [[ -d "$CANONICAL_CODE" ]] && git --git-dir="$CANONICAL_CODE" cat-file -e "$RELEASE_REF^{commit}" 2>/dev/null; then
  SOURCE="izakhono-code"
  REPO_URL="file://$CANONICAL_CODE"
elif [[ -d "$CANONICAL_CODE" ]]; then
  echo "[NAV] Internal CODE exists but does not contain release $RELEASE_REF; using the approved mirror for this immutable release."
fi

echo "[NAV] Source preference resolved: $SOURCE"
if [[ ! -d "$SRC/.git" ]]; then
  git clone "$REPO_URL" "$SRC"
else
  git -C "$SRC" remote set-url origin "$REPO_URL"
  git -C "$SRC" fetch --prune origin
fi

git -C "$SRC" fetch origin "$RELEASE_REF"
git -C "$SRC" checkout --detach "$RELEASE_REF"
RESOLVED="$(git -C "$SRC" rev-parse HEAD)"
[[ "$RESOLVED" == "$RELEASE_REF" ]] || { echo "[STOP] NAV release resolution mismatch." >&2; exit 3; }

STACK="$SRC/products/izakhono-nav/stack"
[[ -f "$STACK/compose.yaml" ]] || { echo "[STOP] NAV stack missing at release $RELEASE_REF." >&2; exit 4; }

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$STACK/.env.example" "$ENV_FILE"
fi

python3 - "$ENV_FILE" "$DATA_DIR" "$(hostname | tr -cd 'A-Za-z0-9_-')" <<'PY'
import pathlib, sys
path=pathlib.Path(sys.argv[1])
data_dir=sys.argv[2]
host=sys.argv[3] or "OWNED"
rows=path.read_text().splitlines()
values={
  "NAV_DATA_DIR": data_dir,
  "NAV_RUNTIME_ID": "NAV-"+host,
  "NAV_RELEASE_ID": "IZAKHONO-NAV-v1.0",
}
out=[]
seen=set()
for row in rows:
  if "=" in row and not row.lstrip().startswith("#"):
    k=row.split("=",1)[0]
    if k in values:
      out.append(f"{k}={values[k]}")
      seen.add(k)
      continue
  out.append(row)
for k,v in values.items():
  if k not in seen: out.append(f"{k}={v}")
path.write_text("\n".join(out)+"\n")
PY
chmod 600 "$ENV_FILE"
ln -sfn "$ENV_FILE" "$STACK/.env"

echo "[NAV] Running owned-stack preflight."
"$STACK/scripts/preflight.sh"

set -a
source "$ENV_FILE"
set +a

if [[ ! -f "$DATA_DIR/osm/south-africa-latest.osm.pbf" ]]; then
  "$STACK/scripts/bootstrap-data.sh"
fi
if [[ ! -f "$DATA_DIR/tiles/south-africa.pmtiles" ]]; then
  "$STACK/scripts/build-tiles.sh"
fi

echo "[NAV] Starting private owned services for long initialization."
docker compose --env-file "$ENV_FILE" -p "$PROJECT" -f "$STACK/compose.yaml" up -d --build nav-router nav-search nav-tiles nav-engine nav-web

deadline=$(( $(date +%s) + INIT_TIMEOUT ))
last=""
while (( $(date +%s) < deadline )); do
  if health="$(curl -fsS --max-time 8 "http://127.0.0.1:${NAV_ENGINE_PORT:-8788}/api/health" 2>/dev/null)"; then
    last="$health"
    if python3 - "$health" <<'PY'
import json,sys
h=json.loads(sys.argv[1])
raise SystemExit(0 if h.get("routing")=="ready" and h.get("search")=="ready" and h.get("tiles")=="ready" and h.get("node01Required") is False else 1)
PY
    then
      echo "[NAV] Router, search and maps are ready."
      break
    fi
  fi
  echo "[NAV] Initialization continues; current health: ${last:-not yet available}"
  sleep "$POLL_SECONDS"
done

health="$(curl -fsS --max-time 8 "http://127.0.0.1:${NAV_ENGINE_PORT:-8788}/api/health" 2>/dev/null || true)"
if ! python3 - "$health" <<'PY'
import json,sys
try: h=json.loads(sys.argv[1])
except Exception: raise SystemExit(2)
ok=h.get("routing")=="ready" and h.get("search")=="ready" and h.get("tiles")=="ready" and h.get("node01Required") is False
raise SystemExit(0 if ok else 2)
PY
then
  echo "[STOP] NAV owned services did not reach full readiness within the initialization window." >&2
  docker compose --env-file "$ENV_FILE" -p "$PROJECT" -f "$STACK/compose.yaml" ps >&2 || true
  exit 5
fi

"$STACK/scripts/verify.sh"

TMP_PROFILE="$(mktemp)"
trap 'rm -f "$TMP_PROFILE"' EXIT
python3 - "$PROFILE_TEMPLATE" "$TMP_PROFILE" "$RELEASE_REF" "$SOURCE" <<'PY'
import json,sys
src,dst,ref,source=sys.argv[1:]
p=json.load(open(src,encoding="utf-8"))
p["ref"]=ref
p["source"]="izakhono-code" if source.startswith("izakhono-code") else "github-mirror"
json.dump(p,open(dst,"w",encoding="utf-8"),indent=2)
PY

echo "[NAV] Promoting the immutable release through IZAKHONO CONTROL → NODE."
DEPLOY_OUT="$(/opt/izakhono-control/izakhonoctl.py deploy "$TMP_PROFILE" --production)"
printf '%s\n' "$DEPLOY_OUT"
JOB_ID="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))' <<<"$DEPLOY_OUT")"
[[ -n "$JOB_ID" ]] || { echo "[STOP] CONTROL did not return a deployment job id." >&2; exit 6; }

for _ in $(seq 1 180); do
  JOB_OUT="$(/opt/izakhono-control/izakhonoctl.py job "$JOB_ID")"
  STATUS="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' <<<"$JOB_OUT")"
  case "$STATUS" in
    succeeded)
      printf '%s\n' "$JOB_OUT"
      break
      ;;
    failed|timed_out|interrupted)
      printf '%s\n' "$JOB_OUT" >&2
      echo "[STOP] Signed NAV production promotion failed: $STATUS" >&2
      exit 7
      ;;
  esac
  sleep 5
done

JOB_OUT="$(/opt/izakhono-control/izakhonoctl.py job "$JOB_ID")"
STATUS="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' <<<"$JOB_OUT")"
[[ "$STATUS" == "succeeded" ]] || { echo "[STOP] NAV deployment job did not complete successfully." >&2; exit 8; }

"$STACK/scripts/install-refresh-timer.sh"

PROOF="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("proof_path",""))' <<<"$JOB_OUT")"
echo
echo "[PASS] IZAKHONO NAV owned production stack is active on this runtime."
echo "Release: $RELEASE_REF"
echo "Source:  $SOURCE"
echo "Web:     http://127.0.0.1:${NAV_WEB_PORT:-8787}"
echo "Engine:  http://127.0.0.1:${NAV_ENGINE_PORT:-8788}"
echo "Proof:   ${PROOF:-recorded by IZAKHONO NODE}"
echo
echo "Public HTTPS is intentionally a separate EDGE/DNS verification gate."
