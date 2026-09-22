#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${ROOT}/release"
mkdir -p "${OUT}"

echo "== IZAKHONO OS · NODE 01 owned build =="
echo "Source: ${ROOT}"
echo "Running source and privacy gates first..."
bash "${ROOT}/test-source.sh"

sudo bash "${ROOT}/build.sh"

ISO="${ROOT}/live-image-amd64.hybrid.iso"
SUM="${ISO}.sha256"

test -f "${ISO}"
test -f "${SUM}"

cp -f "${ISO}" "${OUT}/IZAKHONO-OS-alpha-amd64.iso"
cp -f "${SUM}" "${OUT}/IZAKHONO-OS-alpha-amd64.iso.sha256"

{
  echo "IZAKHONO OS owned build"
  echo "status=BUILD_ONLY"
  echo "source_commit=${IZAKHONO_SOURCE_COMMIT:-unknown}"
  echo "built_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "privacy_gate=passed"
  echo "vm_boot=not_yet_verified"
  echo "hardware=not_yet_verified"
} > "${OUT}/BUILD-STATUS.txt"

echo "Owned build complete. Status remains BUILD_ONLY until VM boot verification passes."
