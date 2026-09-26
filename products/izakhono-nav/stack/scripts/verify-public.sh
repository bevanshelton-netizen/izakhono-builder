#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
set -a; source "$HERE/.env"; set +a
HOST="${NAV_PUBLIC_HOST:?NAV_PUBLIC_HOST is required}"
BASE="https://$HOST"
REPORT="$HERE/public-verification-report.txt"
: > "$REPORT"
pass(){ printf '%-28s PASS\n' "$1" | tee -a "$REPORT"; }
fail(){ printf '%-28s FAIL\n' "$1" | tee -a "$REPORT"; return 1; }

curl -fsS --proto '=https' --tlsv1.2 --max-time 12 "$BASE/" >/tmp/nav-public.html && grep -q 'IZAKHONO NAV' /tmp/nav-public.html && pass "HTTPS NAV experience" || fail "HTTPS NAV experience"

health="$(curl -fsS --proto '=https' --tlsv1.2 --max-time 12 "$BASE/api/health")" || fail "public engine health"
node -e 'const h=JSON.parse(process.argv[1]); if(h.routing!=="ready"||h.search!=="ready"||h.tiles!=="ready"||h.runtimeClass!=="owned"||h.node01Required!==false) process.exit(1)' "$health" && pass "owned runtime identity" || fail "owned runtime identity"

curl -fsS --proto '=https' --tlsv1.2 --max-time 15 "$BASE/api/search?q=Johannesburg" >/tmp/nav-public-search.json && pass "public search" || fail "public search"
curl -fsS --proto '=https' --tlsv1.2 --max-time 20 "$BASE/api/route/driving/28.0473,-26.2041;28.0478,-26.1950" >/tmp/nav-public-route.json && pass "public route" || fail "public route"
curl -fsS --proto '=https' --tlsv1.2 --max-time 20 "$BASE/tiles/10/591/603.png" -o /tmp/nav-public-tile.png && test -s /tmp/nav-public-tile.png && pass "public owned tile" || fail "public owned tile"

printf '\nOWNED LIVE VERIFIED: %s\n' "$BASE" | tee -a "$REPORT"
