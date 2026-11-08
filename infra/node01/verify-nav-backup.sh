#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-}"
[[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]] || { echo "Usage: $0 /path/to/nav-backup" >&2; exit 2; }
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"
command -v sha256sum >/dev/null
command -v tar >/dev/null

required=(
  SHA256SUMS backup-manifest.txt
  nav-compose.yml nav-Caddyfile
  owned-stack-compose.yaml owned-stack-Caddyfile
  owned-stack-martin.yaml owned-stack-style.json
  runtime-manifest.json runtime-data.tar.gz
)
for file in "${required[@]}"; do
  [[ -f "$BACKUP_DIR/$file" && ! -L "$BACKUP_DIR/$file" && -s "$BACKUP_DIR/$file" ]] || {
    echo "ERROR: required backup file missing, empty, or symlinked: $file" >&2
    exit 1
  }
done

BACKUP_ID="$(sed -n 's/^backup_id=//p' "$BACKUP_DIR/backup-manifest.txt")"
[[ "$BACKUP_ID" =~ ^nav-node01-[0-9]{8}T[0-9]{6}Z$ ]] || {
  echo "ERROR: invalid or duplicate backup_id in manifest" >&2
  exit 1
}
[[ "$(grep -c '^backup_id=' "$BACKUP_DIR/backup-manifest.txt")" -eq 1 ]] || {
  echo "ERROR: manifest must contain exactly one backup_id" >&2
  exit 1
}

declare -A expected=()
for file in "${required[@]}"; do expected[$file]=1; done
volume_count=0
while IFS= read -r line; do
  [[ "$line" == volume=* ]] || continue
  if [[ ! "$line" =~ ^volume=([A-Za-z0-9_.-]+)[[:space:]]archive=(volume-[A-Za-z0-9_.-]+\.tar\.gz)$ ]]; then
    echo "ERROR: unsafe or malformed volume archive entry: $line" >&2
    exit 1
  fi
  volume="${BASH_REMATCH[1]}"
  archive="${BASH_REMATCH[2]}"
  [[ "$archive" == "volume-$volume.tar.gz" ]] || {
    echo "ERROR: archive name does not match volume name: $volume" >&2
    exit 1
  }
  [[ -z "${expected[$archive]+x}" ]] || { echo "ERROR: duplicate archive entry: $archive" >&2; exit 1; }
  [[ -f "$BACKUP_DIR/$archive" && ! -L "$BACKUP_DIR/$archive" && -s "$BACKUP_DIR/$archive" ]] || {
    echo "ERROR: archive missing, empty, or symlinked for volume $volume" >&2
    exit 1
  }
  tar -tzf "$BACKUP_DIR/$archive" >/dev/null
  expected[$archive]=1
  volume_count=$((volume_count + 1))
done < "$BACKUP_DIR/backup-manifest.txt"

(( volume_count >= 4 )) || { echo "ERROR: expected at least four persistent volumes across edge and owned stack; found $volume_count" >&2; exit 1; }
tar -tzf "$BACKUP_DIR/runtime-data.tar.gz" >/dev/null

declare -A checksummed=()
while IFS= read -r line; do
  [[ "$line" =~ ^[a-fA-F0-9]{64}[[:space:]][[:space:]]([A-Za-z0-9_.-]+)$ ]] || {
    echo "ERROR: malformed or unsafe SHA256SUMS entry" >&2
    exit 1
  }
  file="${BASH_REMATCH[1]}"
  [[ -n "${expected[$file]+x}" && -z "${checksummed[$file]+x}" ]] || {
    echo "ERROR: unexpected or duplicate checksum entry: $file" >&2
    exit 1
  }
  checksummed[$file]=1
done < "$BACKUP_DIR/SHA256SUMS"

[[ "${#checksummed[@]}" -eq "${#expected[@]}" ]] || {
  echo "ERROR: SHA256SUMS does not cover every expected backup file exactly once" >&2
  exit 1
}
(
  cd "$BACKUP_DIR"
  sha256sum -c SHA256SUMS
)

echo "NAV backup verification PASS: $volume_count persistent volume archive(s) plus router/search/tile runtime data"
echo "Backup contents verified; this does not prove a complete application restore."
