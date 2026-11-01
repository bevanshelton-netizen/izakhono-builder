#!/usr/bin/env bash
set -euo pipefail

# Reference implementation for an IZAKHONO-owned node.
# Install as /opt/izakhono/bin/izakhono-release after adapting the
# ingress/storage details to the actual node topology.
#
# Safety contract:
# - candidate artifact identity is the immutable Docker image ID;
# - promote may only promote the exact image that is currently running;
# - the existing LIVE target is verified before it becomes rollback state;
# - live.json and rollback.json are committed with atomic rename;
# - rollback restores the exact recorded image and receipt metadata.

command=${1:-}
receipt=${2:-}
image=${3:-}
state_dir=${IZAKHONO_STATE_DIR:-/opt/izakhono/state}
network=${IZAKHONO_NETWORK:-izakhono-edge}

fail() { echo "[IZAKHONO RELEASE] $*" >&2; exit 1; }

require_sha256() {
  [[ "$1" =~ ^sha256:[0-9a-fA-F]{64}$ ]] || fail "invalid immutable artifact digest: $1"
}

atomic_write() {
  local destination=$1
  local value=$2
  local tmp
  tmp=$(mktemp "${destination}.tmp.XXXXXX")
  printf '%s\n' "$value" > "$tmp"
  chmod --reference="$destination" "$tmp" 2>/dev/null || true
  mv -f "$tmp" "$destination"
}

atomic_copy() {
  local source=$1
  local destination=$2
  local tmp
  tmp=$(mktemp "${destination}.tmp.XXXXXX")
  cp "$source" "$tmp"
  mv -f "$tmp" "$destination"
}

image_id() {
  local ref=$1
  local id
  id=$(docker image inspect "$ref" --format '{{.Id}}' 2>/dev/null) || fail "Docker image is unavailable: $ref"
  [[ "$id" =~ ^sha256:[0-9a-fA-F]{64}$ ]] || fail "Docker returned a non-immutable image ID for $ref"
  printf '%s\n' "$id"
}

running_image_id() {
  local container=$1
  local id
  id=$(docker inspect "$container" --format '{{.Image}}' 2>/dev/null) || fail "running container is unavailable: $container"
  [[ "$id" =~ ^sha256:[0-9a-fA-F]{64}$ ]] || fail "running container has no immutable image ID: $container"
  printf '%s\n' "$id"
}

validate_receipt() {
  local path=$1
  command -v jq >/dev/null || fail "jq is required"
  [[ -f "$path" ]] || fail "release receipt missing"
  jq -e '.schema == "izakhono.release/v1"' "$path" >/dev/null || fail "unsupported release receipt schema"
  local slug port route digest network_name
  slug=$(jq -r '.application.slug' "$path")
  port=$(jq -r '.runtime.port' "$path")
  route=$(jq -r '.routes.public_https' "$path")
  digest=$(jq -r '.release.artifact_digest' "$path")
  network_name=$(jq -r '.runtime.network' "$path")
  [[ "$slug" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || fail "unsafe application slug"
  [[ "$port" =~ ^[0-9]+$ ]] || fail "invalid application port"
  [[ "$route" == https://* ]] || fail "production route must be HTTPS"
  [[ "$network_name" == "$network" ]] || fail "receipt targets the wrong runtime network"
  require_sha256 "$digest"
}

mkdir -p "$state_dir/releases" "$state_dir/active" "$state_dir/rollback"
docker network inspect "$network" >/dev/null 2>&1 || docker network create "$network" >/dev/null

case "$command" in
  apply)
    [[ -n "$image" ]] || fail "image reference missing"
    validate_receipt "$receipt"
    slug=$(jq -r '.application.slug' "$receipt")
    route=$(jq -r '.routes.public_https' "$receipt")
    digest=$(jq -r '.release.artifact_digest' "$receipt")
    release_dir="$state_dir/releases/$slug"
    mkdir -p "$release_dir"

    actual_image_id=$(image_id "$image")
    [[ "$actual_image_id" == "$digest" ]] || fail "receipt artifact digest does not match loaded image ID"

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

    [[ "$(running_image_id "izakhono-$slug")" == "$digest" ]] || fail "candidate container image ID does not match artifact"

    atomic_copy "$receipt" "$release_dir/candidate.json"
    atomic_write "$release_dir/candidate.image" "$image"
    atomic_write "$release_dir/candidate.digest" "$digest"
    atomic_write "$release_dir/running.digest" "$digest"
    echo "[PASS] Candidate deployed: $slug"
    ;;

  promote)
    application=""; source=""; artifact=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --application) application="${2:-}"; shift 2;;
        --source) source="${2:-}"; shift 2;;
        --artifact) artifact="${2:-}"; shift 2;;
        *) fail "unknown promote argument: $1";;
      esac
    done
    [[ "$application" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || fail "invalid application"
    [[ -n "$source" ]] || fail "release source is required"
    require_sha256 "$artifact"

    release_dir="$state_dir/releases/$application"
    [[ -f "$release_dir/candidate.json" ]] || fail "no candidate release"
    [[ -f "$release_dir/candidate.image" ]] || fail "candidate image reference missing"
    [[ -f "$release_dir/candidate.digest" ]] || fail "candidate digest missing"

    candidate_digest=$(cat "$release_dir/candidate.digest")
    [[ "$candidate_digest" == "$artifact" ]] || fail "promotion artifact does not match candidate digest"
    validate_receipt "$release_dir/candidate.json"
    receipt_digest=$(jq -r '.release.artifact_digest' "$release_dir/candidate.json")
    [[ "$receipt_digest" == "$candidate_digest" ]] || fail "candidate receipt and digest disagree"

    container="izakhono-$application"
    candidate_running_id=$(running_image_id "$container")
    [[ "$candidate_running_id" == "$candidate_digest" ]] || fail "running candidate does not match immutable artifact"
    [[ "$(image_id "$(cat "$release_dir/candidate.image")")" == "$candidate_digest" ]] || fail "candidate image reference no longer resolves to its immutable artifact"

    # Validate the existing LIVE target before making it the rollback target.
    rollback_mode=none
    if [[ -f "$release_dir/live.json" ]]; then
      [[ -f "$release_dir/live.image" && -f "$release_dir/live.digest" ]] || fail "existing LIVE state is incomplete"
      live_digest=$(cat "$release_dir/live.digest")
      require_sha256 "$live_digest"
      live_image=$(cat "$release_dir/live.image")
      [[ "$(image_id "$live_image")" == "$live_digest" ]] || fail "existing LIVE image no longer matches its recorded digest"
      validate_receipt "$release_dir/live.json"
      [[ "$(jq -r '.release.artifact_digest' "$release_dir/live.json")" == "$live_digest" ]] || fail "existing LIVE receipt and digest disagree"
      rollback_mode=verified

      atomic_copy "$release_dir/live.json" "$release_dir/rollback.json"
      atomic_copy "$release_dir/live.image" "$release_dir/rollback.image"
      atomic_copy "$release_dir/live.digest" "$release_dir/rollback.digest"
      [[ -f "$release_dir/live.source" ]] && atomic_copy "$release_dir/live.source" "$release_dir/rollback.source" || atomic_write "$release_dir/rollback.source" ""
      [[ -f "$release_dir/live.artifact" ]] && atomic_copy "$release_dir/live.artifact" "$release_dir/rollback.artifact" || atomic_write "$release_dir/rollback.artifact" "$live_digest"
      atomic_write "$release_dir/rollback.mode" "verified"
    else
      atomic_write "$release_dir/rollback.mode" "none"
    fi

    # Canonical LIVE state is committed atomically. The compatibility files
    # are written only after the canonical live.json is safely in place.
    live_tmp=$(mktemp "$release_dir/live.json.tmp.XXXXXX")
    jq --arg source "$source" --arg artifact "$artifact" --arg image "$(cat "$release_dir/candidate.image")" --arg rollback_mode "$rollback_mode" \
      '. + {release: (.release + {source: $source, artifact_digest: $artifact}), deployed_image: $image, rollback_mode: $rollback_mode}' \
      "$release_dir/candidate.json" > "$live_tmp" || { rm -f "$live_tmp"; fail "failed to build LIVE state"; }
    mv -f "$live_tmp" "$release_dir/live.json"
    atomic_copy "$release_dir/candidate.image" "$release_dir/live.image"
    atomic_copy "$release_dir/candidate.digest" "$release_dir/live.digest"
    atomic_write "$release_dir/live.source" "$source"
    atomic_write "$release_dir/live.artifact" "$artifact"
    echo "[PASS] Promoted to LIVE: $application (rollback=$rollback_mode)"
    ;;

  rollback)
    application="$receipt"
    [[ "$application" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || fail "invalid application"
    release_dir="$state_dir/releases/$application"
    [[ -f "$release_dir/rollback.mode" ]] || fail "no rollback state recorded"
    [[ "$(cat "$release_dir/rollback.mode")" == "verified" ]] || fail "no verified rollback release recorded"
    [[ -f "$release_dir/rollback.json" && -f "$release_dir/rollback.image" && -f "$release_dir/rollback.digest" ]] || fail "rollback state is incomplete"

    rollback_digest=$(cat "$release_dir/rollback.digest")
    require_sha256 "$rollback_digest"
    rollback_image=$(cat "$release_dir/rollback.image")
    [[ "$(image_id "$rollback_image")" == "$rollback_digest" ]] || fail "rollback image no longer matches its recorded digest"
    validate_receipt "$release_dir/rollback.json"
    [[ "$(jq -r '.release.artifact_digest' "$release_dir/rollback.json")" == "$rollback_digest" ]] || fail "rollback receipt and digest disagree"

    docker rm -f "izakhono-$application" >/dev/null 2>&1 || true
    docker run -d \
      --name "izakhono-$application" \
      --restart unless-stopped \
      --network "$network" \
      --label "za.co.izakhono.application=$application" \
      --label "za.co.izakhono.release=$rollback_digest" \
      "$rollback_image" >/dev/null
    [[ "$(running_image_id "izakhono-$application")" == "$rollback_digest" ]] || fail "rollback container image ID mismatch"

    atomic_copy "$release_dir/rollback.json" "$release_dir/live.json"
    atomic_copy "$release_dir/rollback.image" "$release_dir/live.image"
    atomic_copy "$release_dir/rollback.digest" "$release_dir/live.digest"
    [[ -f "$release_dir/rollback.source" ]] && atomic_copy "$release_dir/rollback.source" "$release_dir/live.source" || atomic_write "$release_dir/live.source" "rollback"
    [[ -f "$release_dir/rollback.artifact" ]] && atomic_copy "$release_dir/rollback.artifact" "$release_dir/live.artifact" || atomic_copy "$release_dir/rollback.digest" "$release_dir/live.artifact"
    echo "[PASS] Rolled back: $application to $rollback_digest"
    ;;

  *)
    fail "usage: $0 apply <receipt> <image> | promote --application <slug> --source <sha> --artifact <digest> | rollback <slug>"
    ;;
esac
