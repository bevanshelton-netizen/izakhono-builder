#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERIFY="$ROOT/infra/node01/verify-nav-backup.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

make_fixture() {
  local dir="$1"
  mkdir -p "$dir/source" "$dir/runtime/osm" "$dir/runtime/router" "$dir/runtime/tiles"
  printf 'fixture\n' > "$dir/source/data"
  printf 'osm\n' > "$dir/runtime/osm/source.pbf"
  printf 'router\n' > "$dir/runtime/router/graph.bin"
  printf 'tiles\n' > "$dir/runtime/tiles/south-africa.pmtiles"
  for volume in edge_nav-caddy-data edge_nav-caddy-config owned_nav-search-db owned_nav-search-flatnode; do
    tar -czf "$dir/volume-$volume.tar.gz" -C "$dir/source" .
  done
  tar -czf "$dir/runtime-data.tar.gz" -C "$dir/runtime" .
  printf 'services: {}\n' > "$dir/nav-compose.yml"
  printf 'localhost {}\n' > "$dir/nav-Caddyfile"
  printf 'services: {}\n' > "$dir/owned-stack-compose.yaml"
  printf ':8080 {}\n' > "$dir/owned-stack-Caddyfile"
  printf 'listen_addresses: []\n' > "$dir/owned-stack-martin.yaml"
  printf '{}\n' > "$dir/owned-stack-style.json"
  printf '{}\n' > "$dir/runtime-manifest.json"
  cat > "$dir/backup-manifest.txt" <<'MANIFEST'
backup_id=nav-node01-20261104T120000Z
created_utc=20261104T120000Z
node=NODE01
product=IZAKHONO NAV
volume=edge_nav-caddy-data archive=volume-edge_nav-caddy-data.tar.gz
volume=edge_nav-caddy-config archive=volume-edge_nav-caddy-config.tar.gz
volume=owned_nav-search-db archive=volume-owned_nav-search-db.tar.gz
volume=owned_nav-search-flatnode archive=volume-owned_nav-search-flatnode.tar.gz
MANIFEST
  (
    cd "$dir"
    sha256sum nav-compose.yml nav-Caddyfile owned-stack-compose.yaml owned-stack-Caddyfile \
      owned-stack-martin.yaml owned-stack-style.json runtime-manifest.json \
      backup-manifest.txt runtime-data.tar.gz volume-*.tar.gz > SHA256SUMS
  )
}
GOOD="$TMP/good"
make_fixture "$GOOD"
bash "$VERIFY" "$GOOD"

BAD="$TMP/bad-traversal"
cp -a "$GOOD" "$BAD"
sed -i 's#archive=volume-edge_nav-caddy-data.tar.gz#archive=../../outside.tar.gz#' "$BAD/backup-manifest.txt"
(cd "$BAD" && sha256sum nav-compose.yml nav-Caddyfile owned-stack-compose.yaml owned-stack-Caddyfile owned-stack-martin.yaml owned-stack-style.json runtime-manifest.json backup-manifest.txt runtime-data.tar.gz volume-*.tar.gz > SHA256SUMS)
if bash "$VERIFY" "$BAD" >/dev/null 2>&1; then
  echo "ERROR: verifier accepted path traversal in manifest" >&2
  exit 1
fi

BAD="$TMP/bad-checksum-path"
cp -a "$GOOD" "$BAD"
printf '%064d  ../outside\n' 0 >> "$BAD/SHA256SUMS"
if bash "$VERIFY" "$BAD" >/dev/null 2>&1; then
  echo "ERROR: verifier accepted unsafe checksum path" >&2
  exit 1
fi

BAD="$TMP/bad-symlink"
cp -a "$GOOD" "$BAD"
rm "$BAD/nav-Caddyfile"
ln -s /etc/passwd "$BAD/nav-Caddyfile"
if bash "$VERIFY" "$BAD" >/dev/null 2>&1; then
  echo "ERROR: verifier accepted symlinked backup content" >&2
  exit 1
fi

echo "NAV backup verifier tests PASS: full owned-stack archive accepted; traversal, unsafe checksum path, and symlink rejected"
