#!/bin/sh
set -eu

ENGINE_PORT="${CONNECTA_INTERNAL_ENGINE_PORT:-4100}"
WEB_PORT="${PORT:-10000}"

cleanup() {
  if [ -n "${ENGINE_PID:-}" ]; then kill -TERM "$ENGINE_PID" 2>/dev/null || true; fi
}
trap cleanup INT TERM EXIT

cd /app/engine
node scripts/migrate.js

PORT="$ENGINE_PORT" node src/server.js &
ENGINE_PID=$!

i=0
until node -e "fetch('http://127.0.0.1:' + process.env.CONNECTA_INTERNAL_ENGINE_PORT + '/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" CONNECTA_INTERNAL_ENGINE_PORT="$ENGINE_PORT"; do
  i=$((i+1))
  if [ "$i" -ge 60 ]; then
    echo "CONNECTA ENGINE failed readiness" >&2
    exit 1
  fi
  sleep 1
done

cd /app/web
export CONNECTA_ENGINE_URL="http://127.0.0.1:$ENGINE_PORT"
export PORT="$WEB_PORT"
export HOSTNAME="0.0.0.0"
exec node server.js
