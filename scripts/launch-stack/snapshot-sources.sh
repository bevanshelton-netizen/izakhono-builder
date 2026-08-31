#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-/srv/izakhono/repos}"
DEST="${2:-/opt/izakhono/backups/source-snapshots}"
[ -d "$ROOT" ] || { echo "Source root not found: $ROOT"; exit 2; }
mkdir -p "$DEST"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$DEST/$STAMP"
mkdir -p "$OUT"

count=0
while IFS= read -r -d '' gitdir; do
  repo="$(dirname "$gitdir")"
  name="$(basename "$repo")"
  safe="$(printf '%s' "$name" | tr -cd 'A-Za-z0-9._-')"
  [ -n "$safe" ] || continue
  git -C "$repo" fsck --no-dangling >/dev/null
  git -C "$repo" bundle create "$OUT/${safe}.bundle" --all
  count=$((count + 1))
done < <(find "$ROOT" -mindepth 2 -maxdepth 2 -type d -name .git -print0)

[ "$count" -gt 0 ] || { rmdir "$OUT"; echo 'No Git repositories found.'; exit 1; }
(
  cd "$OUT"
  sha256sum *.bundle > SHA256SUMS
)
chmod -R go-rwx "$OUT"
echo "[PASS] Created $count portable Git bundle snapshot(s) at $OUT."
echo 'These bundles can recreate source history without GitHub, but should also be copied off-host.'
