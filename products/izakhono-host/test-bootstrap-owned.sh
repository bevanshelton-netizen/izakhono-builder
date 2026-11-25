#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

make_fake_docker() {
  local directory="$1"
  mkdir -p "$directory/bin"
  cat > "$directory/bin/docker" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >> "$DOCKER_LOG"
exit 0
SH
  chmod 700 "$directory/bin/docker"
  : > "$directory/docker.log"
}

write_template() {
  local directory="$1" smtp_user="$2" smtp_pass="$3" tls_email="$4"
  cat > "$directory/.env.example" <<EOF
HOST_RUNTIME_TOKEN=replace-with-a-long-random-token
POSTGRES_PASSWORD=replace-with-a-long-random-password
MINIO_ROOT_PASSWORD=replace-with-a-long-random-password
IZAKHONO_MAIL_API_TOKEN=replace-with-a-long-random-token
TLS_EMAIL=$tls_email
SMTP_USER=$smtp_user
SMTP_PASS=$smtp_pass
EOF
  : > "$directory/docker-compose.owned.yml"
  cp "$ROOT/bootstrap-owned.sh" "$directory/bootstrap-owned.sh"
}

# New .env: HOST-owned secrets are generated and the file is private.
CASE1="$TMP/generated"
mkdir -p "$CASE1"
make_fake_docker "$CASE1"
write_template "$CASE1" "ci-mail@example.com" "ci-mail-password" "ci@example.com"
PATH="$CASE1/bin:$PATH" DOCKER_LOG="$CASE1/docker.log" bash "$CASE1/bootstrap-owned.sh" >/dev/null
[[ "$(stat -c '%a' "$CASE1/.env")" == "600" ]]
! grep -q '^HOST_RUNTIME_TOKEN=replace-with-' "$CASE1/.env"
! grep -q '^IZAKHONO_MAIL_API_TOKEN=replace-with-' "$CASE1/.env"
! grep -q '^POSTGRES_PASSWORD=replace-with-' "$CASE1/.env"
! grep -q '^MINIO_ROOT_PASSWORD=replace-with-' "$CASE1/.env"
grep -q '^SMTP_USER=ci-mail@example.com$' "$CASE1/.env"
grep -q '^SMTP_PASS=ci-mail-password$' "$CASE1/.env"
grep -q ' build ' "$CASE1/docker.log"
grep -q ' up ' "$CASE1/docker.log"

# Existing permissive .env: bootstrap repairs it to mode 0600.
CASE2="$TMP/existing"
mkdir -p "$CASE2"
make_fake_docker "$CASE2"
write_template "$CASE2" "ci-mail@example.com" "ci-mail-password" "ci@example.com"
cat > "$CASE2/.env" <<'EOF'
HOST_RUNTIME_TOKEN=existing-host-token
POSTGRES_PASSWORD=existing-postgres-password
MINIO_ROOT_PASSWORD=existing-minio-password
IZAKHONO_MAIL_API_TOKEN=existing-mail-token
TLS_EMAIL=ci@example.com
SMTP_USER=ci-mail@example.com
SMTP_PASS=ci-mail-password
EOF
chmod 644 "$CASE2/.env"
PATH="$CASE2/bin:$PATH" DOCKER_LOG="$CASE2/docker.log" bash "$CASE2/bootstrap-owned.sh" >/dev/null
[[ "$(stat -c '%a' "$CASE2/.env")" == "600" ]]

# A symlinked .env is rejected before any build or start operation.
CASE3="$TMP/symlink"
mkdir -p "$CASE3"
make_fake_docker "$CASE3"
write_template "$CASE3" "ci-mail@example.com" "ci-mail-password" "ci@example.com"
printf 'secret=outside\n' > "$CASE3/external.env"
chmod 600 "$CASE3/external.env"
ln -s external.env "$CASE3/.env"
if PATH="$CASE3/bin:$PATH" DOCKER_LOG="$CASE3/docker.log" bash "$CASE3/bootstrap-owned.sh" >/dev/null 2>&1; then
  echo "symlinked .env unexpectedly accepted" >&2
  exit 1
fi
! grep -Eq ' (build|up)( |$)' "$CASE3/docker.log"

# Placeholder mailbox credentials are rejected before compose validation/build/start.
CASE4="$TMP/placeholders"
mkdir -p "$CASE4"
make_fake_docker "$CASE4"
write_template "$CASE4" "info@example.com" "replace-with-mailbox-password" "ci@example.com"
if PATH="$CASE4/bin:$PATH" DOCKER_LOG="$CASE4/docker.log" bash "$CASE4/bootstrap-owned.sh" >/dev/null 2>&1; then
  echo "placeholder SMTP credentials unexpectedly accepted" >&2
  exit 1
fi
! grep -Eq ' (config|build|up)( |$)' "$CASE4/docker.log"

echo "HOST bootstrap secret-permission and fail-closed tests passed; fake Docker only, no services started."
