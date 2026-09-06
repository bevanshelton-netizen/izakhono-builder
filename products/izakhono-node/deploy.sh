#!/usr/bin/env bash
set -euo pipefail

JOB_JSON="${1:?job json required}"
need(){ command -v "$1" >/dev/null || { echo "missing $1" >&2; exit 20; }; }
need git; need docker; need curl; need python3

get(){ python3 -c 'import json,sys; d=json.loads(sys.argv[1]); print(d.get(sys.argv[2],""))' "$JOB_JSON" "$1"; }

APP="$(get app)"
REPO="$(get repo)"
REF="$(get ref)"
MODE="$(get mode)"
MODE="${MODE:-single}"
PORT="$(get container_port)"
HEALTH="$(get health_path)"
HEALTH_URL="$(get health_url)"
PUBLIC_URL="$(get public_url)"
ENV_FILE="$(get env_file)"
DOCKERFILE="$(get dockerfile)"
COMPOSE_FILE="$(get compose_file)"
DATA_PATH="$(get data_path)"

DOCKERFILE="${DOCKERFILE:-Dockerfile}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
DATA_PATH="${DATA_PATH:-/app/data}"

[[ "$APP" =~ ^[a-zA-Z0-9_-]+$ ]] || exit 21
[[ "$MODE" == "single" || "$MODE" == "compose" ]] || { echo "invalid-mode" >&2; exit 22; }

if [[ -n "$ENV_FILE" ]]; then
  ENV_REAL="$(readlink -f "$ENV_FILE")"
  [[ "$ENV_REAL" == /etc/izakhono/apps/* ]] || { echo bad-env-path; exit 24; }
  [[ -f "$ENV_REAL" ]] || { echo missing-env; exit 25; }
fi

ROOT="/var/lib/izakhono-node/apps/$APP"
SRC="$ROOT/source"
mkdir -p "$ROOT"

if [[ ! -d "$SRC/.git" ]]; then
  git clone "$REPO" "$SRC"
else
  git -C "$SRC" remote set-url origin "$REPO"
  git -C "$SRC" fetch --prune origin
fi

PREV_SHA="$(git -C "$SRC" rev-parse HEAD 2>/dev/null || true)"
git -C "$SRC" fetch --tags origin "$REF" || true
git -C "$SRC" checkout --detach "$REF"
SHA="$(git -C "$SRC" rev-parse HEAD)"
SHORT="${SHA:0:12}"

if [[ "$MODE" == "compose" ]]; then
  need docker
  docker compose version >/dev/null 2>&1 || { echo "missing docker compose" >&2; exit 26; }
  [[ -f "$SRC/$COMPOSE_FILE" ]] || { echo "missing-compose-file" >&2; exit 27; }
  [[ "$HEALTH_URL" == http://127.0.0.1:* || "$HEALTH_URL" == http://localhost:* || "$HEALTH_URL" == https://127.0.0.1:* || "$HEALTH_URL" == https://localhost:* ]] || {
    echo "compose-health-url-must-be-localhost" >&2; exit 28;
  }

  PROJECT="izakhono-$APP"
  DC=(docker compose -p "$PROJECT" -f "$SRC/$COMPOSE_FILE")
  [[ -n "$ENV_FILE" ]] && DC+=(--env-file "$ENV_FILE")

  "${DC[@]}" config -q
  "${DC[@]}" build --pull
  "${DC[@]}" up -d --remove-orphans

  pass=0
  for _ in $(seq 1 60); do
    if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null; then pass=1; break; fi
    sleep 2
  done

  rollback_compose(){
    echo rollback >&2
    if [[ -n "$PREV_SHA" ]]; then
      git -C "$SRC" checkout --detach "$PREV_SHA" || true
      "${DC[@]}" build || true
      "${DC[@]}" up -d --remove-orphans || true
    else
      "${DC[@]}" down || true
    fi
  }

  [[ "$pass" == 1 ]] || { "${DC[@]}" ps || true; "${DC[@]}" logs --tail=200 || true; rollback_compose; exit 30; }

  if [[ -n "$PUBLIC_URL" ]]; then
    curl -fsS --max-time 15 "$PUBLIC_URL" >/dev/null || { rollback_compose; exit 32; }
  fi

  printf '{"ok":true,"app":"%s","commit":"%s","mode":"compose","compose_file":"%s"}\n' "$APP" "$SHA" "$COMPOSE_FILE"
  exit 0
fi

[[ "$PORT" =~ ^[0-9]+$ ]] || exit 22
[[ "$HEALTH" == /* ]] || exit 23

IMAGE="izakhono/$APP:$SHORT"
CANARY="${APP}-canary"
PROD="$APP"
VOL="${APP}_data"
CANARY_VOL="${APP}_canary_data"

docker build --pull -f "$SRC/$DOCKERFILE" -t "$IMAGE" "$SRC"
docker volume create "$VOL" >/dev/null
docker volume create "$CANARY_VOL" >/dev/null
docker rm -f "$CANARY" >/dev/null 2>&1 || true

ARGS=(run -d --name "$CANARY" --label "izakhono.app=$APP" --label "izakhono.commit=$SHA" -p 127.0.0.1::"$PORT" -v "$CANARY_VOL:$DATA_PATH")
[[ -n "$ENV_FILE" ]] && ARGS+=(--env-file "$ENV_FILE")
ARGS+=("$IMAGE")
docker "${ARGS[@]}" >/dev/null

HOST_PORT="$(docker port "$CANARY" "$PORT/tcp" | sed -E 's/.*:([0-9]+)$/\1/' | head -1)"
pass=0
for _ in $(seq 1 45); do
  if curl -fsS --max-time 5 "http://127.0.0.1:$HOST_PORT$HEALTH" >/dev/null; then pass=1; break; fi
  sleep 2
done
[[ "$pass" == 1 ]] || { docker logs "$CANARY" || true; docker rm -f "$CANARY" || true; echo canary-failed; exit 30; }

PREV_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$PROD" 2>/dev/null || true)"
docker rm -f "$PROD" >/dev/null 2>&1 || true
docker rm -f "$CANARY" >/dev/null 2>&1 || true

PROD_ARGS=(run -d --name "$PROD" --restart unless-stopped --label "izakhono.app=$APP" --label "izakhono.commit=$SHA" -p "127.0.0.1:$PORT:$PORT" -v "$VOL:$DATA_PATH")
[[ -n "$ENV_FILE" ]] && PROD_ARGS+=(--env-file "$ENV_FILE")
PROD_ARGS+=("$IMAGE")

rollback(){
  echo rollback >&2
  docker rm -f "$PROD" >/dev/null 2>&1 || true
  if [[ -n "$PREV_IMAGE" ]]; then
    RB=(run -d --name "$PROD" --restart unless-stopped -p "127.0.0.1:$PORT:$PORT" -v "$VOL:$DATA_PATH")
    [[ -n "$ENV_FILE" ]] && RB+=(--env-file "$ENV_FILE")
    RB+=("$PREV_IMAGE")
    docker "${RB[@]}" >/dev/null || true
  fi
}

docker "${PROD_ARGS[@]}" >/dev/null
pass=0
for _ in $(seq 1 45); do
  if curl -fsS --max-time 5 "http://127.0.0.1:$PORT$HEALTH" >/dev/null; then pass=1; break; fi
  sleep 2
done
[[ "$pass" == 1 ]] || { rollback; exit 31; }
if [[ -n "$PUBLIC_URL" ]]; then
  curl -fsS --max-time 15 "${PUBLIC_URL%/}$HEALTH" >/dev/null || { rollback; exit 32; }
fi

printf '{"ok":true,"app":"%s","commit":"%s","image":"%s","mode":"single"}\n' "$APP" "$SHA" "$IMAGE"
