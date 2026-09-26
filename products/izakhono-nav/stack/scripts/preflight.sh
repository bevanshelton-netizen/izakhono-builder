#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
[[ -f "$HERE/.env" ]] || cp "$HERE/.env.example" "$HERE/.env"
set -a
source "$HERE/.env"
set +a

command -v docker >/dev/null || { echo "Docker is required." >&2; exit 2; }
docker compose version >/dev/null || { echo "Docker Compose v2 is required." >&2; exit 2; }
command -v curl >/dev/null || { echo "curl is required." >&2; exit 2; }
command -v md5sum >/dev/null || { echo "md5sum is required." >&2; exit 2; }

RAW_DATA_DIR="${NAV_DATA_DIR:-runtime-data}"
if [[ "$RAW_DATA_DIR" = /* ]]; then
  DATA_DIR="$RAW_DATA_DIR"
else
  DATA_DIR="$HERE/$RAW_DATA_DIR"
fi

if grep -q 'CHANGE-ME-BEFORE-FIRST-START' "$HERE/.env"; then
  secret="$(od -An -N24 -tx1 /dev/urandom | tr -d '[:space:]')"
  sed -i "s/CHANGE-ME-BEFORE-FIRST-START/$secret/" "$HERE/.env"
  echo "Generated a private Nominatim database password in .env."
  set -a
  source "$HERE/.env"
  set +a
fi

if git -C "$HERE" rev-parse --show-toplevel >/dev/null 2>&1; then
  root="$(git -C "$HERE" rev-parse --show-toplevel)"
  exclude="$root/.git/info/exclude"
  grep -qxF "products/izakhono-nav/stack/.env" "$exclude" 2>/dev/null || echo "products/izakhono-nav/stack/.env" >> "$exclude"
  grep -qxF "products/izakhono-nav/stack/runtime-data/" "$exclude" 2>/dev/null || echo "products/izakhono-nav/stack/runtime-data/" >> "$exclude"
fi

ram_gb="$(awk '/MemTotal/{printf "%.0f",$2/1024/1024}' /proc/meminfo 2>/dev/null || echo 0)"
disk_gb="$(df -Pk "$DATA_DIR" 2>/dev/null | awk 'NR==2{printf "%.0f",$4/1024/1024}' || true)"
[[ -n "$disk_gb" ]] || disk_gb="$(df -Pk "$HERE" | awk 'NR==2{printf "%.0f",$4/1024/1024}')"

if (( ram_gb < 8 )); then echo "At least 8 GB RAM is required for this South Africa stack." >&2; exit 4; fi
if (( ram_gb < 16 )); then echo "WARNING: ${ram_gb}GB RAM detected; 16GB+ is recommended."; fi
if (( disk_gb < 30 )); then echo "At least 30 GB free disk is required." >&2; exit 5; fi
if (( disk_gb < 60 )); then echo "WARNING: ${disk_gb}GB free; 60GB+ is recommended for rebuild headroom."; fi

docker compose --env-file "$HERE/.env" -f "$HERE/compose.yaml" config >/dev/null
echo "NAV owned-stack preflight passed."
