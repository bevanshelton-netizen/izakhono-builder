#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
set -a; source "$HERE/.env"; set +a
DATA_DIR="${NAV_DATA_DIR:-$HERE/runtime-data}"
PBF="$DATA_DIR/osm/south-africa-latest.osm.pbf"
NEW="$PBF.new"
PBF_URL="https://download.geofabrik.de/africa/south-africa-latest.osm.pbf"
mkdir -p "$DATA_DIR/osm"
curl -fL --retry 5 --retry-delay 3 -o "$NEW" "$PBF_URL"
curl -fL --retry 5 --retry-delay 3 -o "$NEW.md5" "${PBF_URL}.md5"
expected="$(awk '{print $1}' "$NEW.md5" | head -n1)"
actual="$(md5sum "$NEW" | awk '{print $1}')"
[[ -n "$expected" && "$actual" == "$expected" ]] || { echo "New OSM extract checksum failed." >&2; rm -f "$NEW" "$NEW.md5"; exit 2; }
old=""
[[ -f "$PBF" ]] && old="$(md5sum "$PBF" | awk '{print $1}')"
if [[ "$old" == "$actual" ]]; then
  echo "South Africa OSM extract is already current."
  rm -f "$NEW" "$NEW.md5"
  exit 0
fi
[[ -f "$PBF" ]] && cp -f "$PBF" "$PBF.previous"
mv "$NEW" "$PBF"
mv "$NEW.md5" "$PBF.md5.remote"
printf '%s  %s\n' "$actual" "$(basename "$PBF")" > "$PBF.md5"
echo "OSM data changed. Rebuilding PMTiles..."
"$HERE/scripts/build-tiles.sh"
echo "Restarting Valhalla and Martin against the new dataset..."
docker compose --env-file "$HERE/.env" -f "$HERE/compose.yaml" restart nav-router nav-tiles
echo "Nominatim remains on continuous Geofabrik replication; no destructive reimport was performed."
