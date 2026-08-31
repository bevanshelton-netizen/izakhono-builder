#!/usr/bin/env bash
set -euo pipefail

ROOT=/opt/izakhono/backups
LATEST="$(find "$ROOT" -mindepth 1 -maxdepth 1 -type d -name '20*' -printf '%f\n' 2>/dev/null | sort | tail -n 1)"
[ -n "$LATEST" ] || { echo 'No timestamped IZAKHONO backup exists yet.'; exit 1; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/verify-backup-restore.sh" "$ROOT/$LATEST"
