#!/usr/bin/env bash
set -euo pipefail

SOURCE_IMAGE="${SOURCE_IMAGE:-ghcr.io/bevanshelton-netizen/izakhono-super-seo:node01}"
LOCAL_IMAGE="${LOCAL_IMAGE:-127.0.0.1:5000/izakhono-super-seo:node01}"

case "$LOCAL_IMAGE" in
  127.0.0.1:5000/izakhono-super-seo:*) ;;
  *) echo "[STOP] LOCAL_IMAGE must remain inside the private NODE01 registry."; exit 1 ;;
esac

echo "[1/4] Pulling approved workload image..."
docker pull "$SOURCE_IMAGE"

echo "[2/4] Tagging into private NODE01 registry..."
docker tag "$SOURCE_IMAGE" "$LOCAL_IMAGE"
echo "[3/4] Publishing to private NODE01 registry..."
docker push "$LOCAL_IMAGE"
echo "[4/4] Verifying local registry catalog..."
curl -fsS http://127.0.0.1:5000/v2/_catalog
echo
echo "[PASS] SUPER SEO is available from the private NODE01 registry."
echo "LOCAL_IMAGE=$LOCAL_IMAGE"
