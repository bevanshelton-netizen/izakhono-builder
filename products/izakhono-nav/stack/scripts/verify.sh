#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
[[ -f "$HERE/.env" ]] && set -a && source "$HERE/.env" && set +a
HOST="${NAV_VERIFY_URL:-http://127.0.0.1:${NAV_HTTP_PORT:-80}}"
REPORT="$HERE/activation-report.txt"
: > "$REPORT"

pass(){ printf '%-26s PASS\n' "$1" | tee -a "$REPORT"; }
fail(){ printf '%-26s FAIL\n' "$1" | tee -a "$REPORT"; return 1; }

curl -fsS --max-time 8 "$HOST/" >/dev/null && pass "web" || fail "web"
health="$(curl -fsS --max-time 8 "$HOST/api/health")" || fail "engine health"
node -e 'const h=JSON.parse(process.argv[1]); if(h.routing!=="ready"||h.search!=="ready"||h.tiles!=="ready"||h.node01Required!==false) process.exit(1)' "$health" && pass "owned dependencies" || fail "owned dependencies"

search="$(curl -fsS --max-time 10 "$HOST/api/search?q=Johannesburg")" || fail "search"
node -e 'const r=JSON.parse(process.argv[1]); if(!Array.isArray(r)||!r.length||!Number.isFinite(Number(r[0].lat))||!Number.isFinite(Number(r[0].lng))) process.exit(1)' "$search" && pass "search result" || fail "search result"

route_url="$HOST/api/route/driving/28.0473,-26.2041;28.0478,-26.1950"
route="$(curl -fsS --max-time 15 "$route_url")" || fail "route"
node -e 'const r=JSON.parse(process.argv[1]); if(!r.geometry?.coordinates?.length||!Number.isFinite(Number(r.distance))||!Number.isFinite(Number(r.duration))) process.exit(1)' "$route" && pass "route geometry" || fail "route geometry"

curl -fsS --max-time 15 "$HOST/tiles/10/591/603.png" -o /tmp/izakhono-nav-tile.png || fail "owned raster tile"
test -s /tmp/izakhono-nav-tile.png && pass "owned raster tile" || fail "owned raster tile"

printf '\nOWNED LIVE STACK VERIFIED locally at %s\n' "$HOST" | tee -a "$REPORT"
