#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo ./build.sh"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

echo "== IZAKHONO OS Alpha =="
echo "Running mandatory privacy gate..."
bash ./verify-privacy.sh

command -v lb >/dev/null 2>&1 || {
  apt-get update
  apt-get install -y live-build
}

lb clean --purge || true

lb config \
  --mode debian \
  --distribution trixie \
  --architectures amd64 \
  --binary-images iso-hybrid \
  --debian-installer live \
  --archive-areas "main contrib non-free-firmware" \
  --apt-recommends true \
  --bootappend-live "boot=live components quiet splash username=izakhono hostname=izakhono-os"

lb build

if [[ -f live-image-amd64.hybrid.iso ]]; then
  sha256sum live-image-amd64.hybrid.iso | tee live-image-amd64.hybrid.iso.sha256
  echo "BUILD COMPLETE"
  echo "Status remains BUILD-ONLY until VM boot, hardware and privacy verification pass."
else
  echo "Expected ISO not found."
  exit 2
fi
