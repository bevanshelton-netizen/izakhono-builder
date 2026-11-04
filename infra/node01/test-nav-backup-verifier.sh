#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERIFY="$ROOT/infra/node01/verify-nav-backup.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

make_fixture() {
  local dir="$1"
  mkdir -p "$dir/source"
  printf 'fixture\n' > "$dir/source/data"
  tar -czf "$dir/volume-nav-caddy-data.tar.gz" -C "$dir/source" .
  printf 'services: {}\n' > "$dir/nav-compose.yml"
  printf 'localhost {}\n' > "$dir/nav-Caddyfile"
  cat > "$dir/backup-manifest.txt" <<'MANIFEST'
backup_id=nav-node01-20261104T120000Z
created_utc=20261104T120000Z
node=NODE01
product=IZAKHONO NAV
volume=nav-caddy-data archive=volume-nav-caddy-data.tar.gz
MANIFEST
  (cd "$dir" && sha256sum nav-compose.yml nav-Caddyfile backup-manifest.txt volume-*.tar.gz > SHA256SUMS)
}
GOOD="$TMP/good"
make_fixture "$GOOD"
bash "$VERIFY" "$GOOD"

BAD="$TMP/bad-traversal"
cp -a "$GOOD" "$BAD"
sed -i 's#archive=volume-nav-caddy-data.tar.gz#archive=../../outside.tar.gz#' "$BAD/backup-manifest.txt"
(cd "$BAD" && sha256sum nav-compose.yml nav-Caddyfile backup-manifest.txt volume-*.tar.gz > SHA256SUMS)
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

echo "NAV backup verifier tests PASS: valid archive accepted; traversal, unsafe checksum path, and symlink rejected"
