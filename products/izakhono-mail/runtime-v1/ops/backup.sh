#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
stamp=$(date +%Y%m%d-%H%M%S)
tar -czf "backups/izakhono-mail-$stamp.tgz" .env dms-config mail-data mail-state mail-logs mail-config roundcube-db caddy-data caddy-config
sha256sum "backups/izakhono-mail-$stamp.tgz" > "backups/izakhono-mail-$stamp.tgz.sha256"
echo "Created backups/izakhono-mail-$stamp.tgz"
