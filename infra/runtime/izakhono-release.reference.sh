#!/usr/bin/env bash
set -euo pipefail

# Reference implementation for an IZAKHONO-owned node.
# Install as /opt/izakhono/bin/izakhono-release after adapting the
# ingress/storage details to the actual node topology.

command=${1:-}
receipt=${2:-}
image=${3:-}
state_dir=${IZAKHONO_STATE_DIR:-/opt/izakhono/state}
network=${IZAKHONO_NETWORK:-izakhono-edge}

fail() { echo "[IZAKHONO RELEASE] $*" >&2; exit 1; }

mkdir -p "$state_dir/releases" "$state_dir/active" "$state_dir/rollback"
docker network inspect "$network" >/dev/null 2>&1 || docker network create "$network" >/dev/null

case "$command" in
  apply)
    [[ -f "$receipt" ]] || fail "release receipt missing"
    [[ -n "$image" ]] || fail "image reference missing"
    command -v jq >/dev/null || fail "jq is required"
    slug=$(jq -r '.application.slug' "$receipt")
    port=$(jq -r '.runtime.port' "$receipt")
    route=$(jq -r '.routes.public_https' "$receipt")
    digest=$(jq -r '.release.artifact_digest' "$receipt")
    [[ "$slug" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || fail "unsafe application slug"
    [[ "$port" =~ ^[0-9]+$ ]] || fail "invalid application port"
    [[ "$route" == https://* ]] || fail "production route must be HTTPS"

    release_dir="$state_dir/releases/$slug"
    mkdir -p "$release_dir"
    cp "$receipt" "$release_dir/candidate.json"
    printf '%s\n' "$image" > "$release_dir/candidate.image"
    printf '%s\n' "$digest" > "$release_dir/candidate.digest"

    # Stop only the application owned by this release adapter.
    docker rm -f "izakhono-$slug" >/dev/null 2>&1 || true

    # The ingress implementation is intentionally label-driven. Traefik,
    # Caddy or the future IZAKHONO EDGE can consume the same logical labels.
    docker run -d \
      --name "izakhono-$slug" \
      --restart unless-stopped \
      --network "$network" \
      --label "za.co.izakhono.application=$slug" \
      --label "za.co.izakhono.route=$route" \
      --label "za.co.izakhono.release=$digest" \
      "$image" >/dev/null

    printf '%s\n' "$digest" > "$release_dir/running.digest"
    echo "[PASS] Candidate deployed: $slug"
    ;;

  promote)
    application=""; source=""; artifact=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --application) application="$2"; shift 2;;
        --source) source="$2"; shift 2;;
        --artifact) artifact="$2"; shift 2;;
        *) shift;;
      esac
    done
    [[ "$application" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || fail "invalid application"
    release_dir="$state_dir/releases/$application"
    [[ -f "$release_dir/candidate.json" ]] || fail "no candidate release"
    cp "$release_dir/candidate.json" "$release_dir/live.json"
    cp "$release_dir/candidate.image" "$release_dir/live.image"
    cp "$release_dir/candidate.digest" "$release_dir/live.digest"
    printf '%s\n' "$source" > "$release_dir/live.source"
    printf '%s\n' "$artifact" > "$release_dir/live.artifact"
    echo "[PASS] Promoted to LIVE: $application"
    ;;

  rollback)
    application="$receipt"
    [[ "$application" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || fail "invalid application"
    release_dir="$state_dir/releases/$application"
    [[ -f "$release_dir/rollback.image" ]] || fail "no verified rollback release recorded"
    image=$(cat "$release_dir/rollback.image")
    docker rm -f "izakhono-$application" >/dev/null 2>&1 || true
    docker run -d --name "izakhono-$application" --restart unless-stopped --network "$network" "$image" >/dev/null
    echo "[PASS] Rolled back: $application"
    ;;

  *)
    fail "usage: $0 apply <receipt> <image> | promote --application <slug> --source <sha> --artifact <digest> | rollback <slug>"
    ;;
esac
