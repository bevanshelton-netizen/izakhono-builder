#!/usr/bin/env bash
set -euo pipefail
SRC="${1:?source git URL required}"
NAME="${2:?target repo name required}"
[[ "$NAME" =~ ^[A-Za-z0-9._-]+$ ]] || exit 2
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p /srv/izakhono-code/repos
TARGET="/srv/izakhono-code/repos/$NAME.git"
[[ ! -e "$TARGET" ]] || { echo target-exists >&2; exit 3; }
git clone --mirror "$SRC" "$TMP/$NAME.git"
cp -a "$TMP/$NAME.git" "$TARGET"
chown -R izakhono-code:izakhono-code "$TARGET"
git --git-dir="$TARGET" fsck --full
echo "MIGRATED=$NAME"
echo "TARGET=$TARGET"
