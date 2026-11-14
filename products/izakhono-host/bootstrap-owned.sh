#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

command -v docker >/dev/null 2>&1 || { echo "Docker is required" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose is required" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required" >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "OpenSSL is required" >&2; exit 1; }

if [[ ! -f .env ]]; then
  cp .env.example .env
  python3 - <<'PY'
from pathlib import Path
import base64
import os
import secrets

p = Path(".env")
text = p.read_text()
replacements = {
    "HOST_RUNTIME_TOKEN=REPLACE_WITH_LONG_RANDOM_TOKEN":
        "HOST_RUNTIME_TOKEN=" + secrets.token_urlsafe(48),
    "POSTGRES_PASSWORD=REPLACE_WITH_UNIQUE_DATABASE_PASSWORD":
        "POSTGRES_PASSWORD=" + secrets.token_urlsafe(36),
    "MINIO_ROOT_PASSWORD=REPLACE_WITH_UNIQUE_MINIO_PASSWORD":
        "MINIO_ROOT_PASSWORD=" + secrets.token_urlsafe(36),
    "IZAKHONO_MAIL_API_TOKEN=REPLACE_WITH_LONG_RANDOM_MAIL_BRIDGE_TOKEN":
        "IZAKHONO_MAIL_API_TOKEN=" + secrets.token_urlsafe(48),
    "STALWART_RECOVERY_ADMIN=admin:REPLACE_WITH_UNIQUE_STALWART_RECOVERY_PASSWORD":
        "STALWART_RECOVERY_ADMIN=admin:" + secrets.token_urlsafe(36),
    "CONTROL_PLANE_TOKEN=REPLACE_WITH_SEPARATE_LONG_RANDOM_TOKEN":
        "CONTROL_PLANE_TOKEN=" + secrets.token_urlsafe(48),
    "MAIL_HANDOVER_ENCRYPTION_KEY=REPLACE_WITH_FERNET_KEY":
        "MAIL_HANDOVER_ENCRYPTION_KEY=" + base64.urlsafe_b64encode(os.urandom(32)).decode("ascii"),
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"Expected template entry missing: {old.split('=')[0]}")
    text = text.replace(old, new, 1)
p.write_text(text)
PY
  chmod 600 .env
  echo "Created .env and generated independent host, database, mail bridge, recovery and handover secrets."
fi

mkdir -p mail/secrets
chmod 700 mail/secrets
if [[ ! -s mail/secrets/roundcube_db_password ]]; then
  openssl rand -base64 48 | tr -d '\n' > mail/secrets/roundcube_db_password
fi
if [[ ! -s mail/secrets/roundcube_des_key ]]; then
  openssl rand -base64 32 | tr -d '\n' > mail/secrets/roundcube_des_key
fi
chmod 600 mail/secrets/roundcube_db_password mail/secrets/roundcube_des_key

if grep -q '^MAIL_ADMIN_PASSWORD_HASH=REPLACE_WITH_CADDY_BCRYPT_HASHif grep -q 'REPLACE_WITH' .env; then
  echo "Some mail settings remain intentionally unconfigured:"
  grep -E '^(STALWART_API_KEY|SMTP_PASS|MAIL_PUBLIC_IP|DKIM_SELECTOR|HOST_PUBLIC_IP)=' .env || true
  echo "Create the Stalwart API token after first server setup; set SMTP_PASS after the notifications mailbox is activated."
fi

if grep -q 'ops@example.com' .env; then
  echo "Set TLS_EMAIL in .env before public HTTPS activation." >&2
  exit 1
fi

echo "[1/4] Validating owned host and mail compose definitions"
docker compose --env-file .env -f docker-compose.owned.yml config >/dev/null
if [[ "${MAIL_MODE:-local}" == "local" ]]; then
  docker compose --env-file .env -f mail/docker-compose.mail.yml config >/dev/null
fi

echo "[2/4] Building owned runtime"
docker compose --env-file .env -f docker-compose.owned.yml build --pull host-runtime mail-control-plane

echo "[3/4] Starting owned host services"
docker compose --env-file .env -f docker-compose.owned.yml up -d

echo "[4/4] Waiting for native host runtime health"
for i in {1..30}; do
  if docker compose --env-file .env -f docker-compose.owned.yml exec -T host-runtime node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    echo "IZAKHONO HOST runtime is healthy."
    docker compose --env-file .env -f docker-compose.owned.yml ps
    echo "Mail containers are staged; Stalwart API token and notification mailbox credentials are configured in a later mail setup step."
    exit 0
  fi
  sleep 2
done

echo "Runtime did not become healthy; inspect: docker compose -f docker-compose.owned.yml logs --tail=200" >&2
exit 1
 .env; then
  ADMIN_PASSWORD="$(openssl rand -hex 32)"
  printf '%s' "$ADMIN_PASSWORD" > mail/secrets/mail_admin_password
  chmod 600 mail/secrets/mail_admin_password
  ADMIN_HASH="$(docker run --rm caddy:2-alpine caddy hash-password --plaintext "$ADMIN_PASSWORD")"
  MAIL_ADMIN_HASH="$ADMIN_HASH" python3 - <<'PY'
from pathlib import Path
import os
p = Path(".env")
text = p.read_text()
text = text.replace(
    "MAIL_ADMIN_PASSWORD_HASH=REPLACE_WITH_CADDY_BCRYPT_HASH",
    "MAIL_ADMIN_PASSWORD_HASH='" + os.environ["MAIL_ADMIN_HASH"] + "'",
    1,
)
p.write_text(text)
PY
  unset ADMIN_PASSWORD ADMIN_HASH
  echo "Generated owner-only Mail Control Centre password in mail/secrets/mail_admin_password."
elif [[ ! -s mail/secrets/mail_admin_password ]]; then
  echo "MAIL_ADMIN_PASSWORD_HASH exists but its plaintext recovery file is missing. Restore the password file or perform a deliberate admin-password reset." >&2
  exit 4
fi

mkdir -p host/secrets
chmod 700 host/secrets
if grep -q '^HOST_ADMIN_PASSWORD_HASH=REPLACE_WITH_CADDY_BCRYPT_HASHif grep -q 'REPLACE_WITH' .env; then
  echo "Some mail settings remain intentionally unconfigured:"
  grep -E '^(STALWART_API_KEY|SMTP_PASS|MAIL_PUBLIC_IP|DKIM_SELECTOR)=' .env || true
  echo "Create the Stalwart API token after first server setup; set SMTP_PASS after the notifications mailbox is activated."
fi

if grep -q 'ops@example.com' .env; then
  echo "Set TLS_EMAIL in .env before public HTTPS activation." >&2
  exit 1
fi

echo "[1/4] Validating owned host and mail compose definitions"
docker compose --env-file .env -f docker-compose.owned.yml config >/dev/null
if [[ "${MAIL_MODE:-local}" == "local" ]]; then
  docker compose --env-file .env -f mail/docker-compose.mail.yml config >/dev/null
fi

echo "[2/4] Building owned runtime"
docker compose --env-file .env -f docker-compose.owned.yml build --pull host-runtime mail-control-plane

echo "[3/4] Starting owned host services"
docker compose --env-file .env -f docker-compose.owned.yml up -d

echo "[4/4] Waiting for native host runtime health"
for i in {1..30}; do
  if docker compose --env-file .env -f docker-compose.owned.yml exec -T host-runtime node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    echo "IZAKHONO HOST runtime is healthy."
    docker compose --env-file .env -f docker-compose.owned.yml ps
    echo "Mail containers are staged; Stalwart API token and notification mailbox credentials are configured in a later mail setup step."
    exit 0
  fi
  sleep 2
done

echo "Runtime did not become healthy; inspect: docker compose -f docker-compose.owned.yml logs --tail=200" >&2
exit 1
 .env; then
  HOST_ADMIN_PASSWORD="$(openssl rand -hex 32)"
  printf '%s' "$HOST_ADMIN_PASSWORD" > host/secrets/host_admin_password
  chmod 600 host/secrets/host_admin_password
  HOST_ADMIN_HASH="$(docker run --rm caddy:2-alpine caddy hash-password --plaintext "$HOST_ADMIN_PASSWORD")"
  HOST_ADMIN_HASH="$HOST_ADMIN_HASH" python3 - <<'PY'
from pathlib import Path
import os
p = Path(".env")
text = p.read_text()
text = text.replace(
    "HOST_ADMIN_PASSWORD_HASH=REPLACE_WITH_CADDY_BCRYPT_HASH",
    "HOST_ADMIN_PASSWORD_HASH='" + os.environ["HOST_ADMIN_HASH"] + "'",
    1,
)
p.write_text(text)
PY
  unset HOST_ADMIN_PASSWORD HOST_ADMIN_HASH
  echo "Generated owner-only Hosting Control Centre password in host/secrets/host_admin_password."
elif [[ ! -s host/secrets/host_admin_password ]]; then
  echo "HOST_ADMIN_PASSWORD_HASH exists but its plaintext recovery file is missing. Restore the password file or perform a deliberate admin-password reset." >&2
  exit 5
fi

if grep -q 'REPLACE_WITH' .env; then
  echo "Some mail settings remain intentionally unconfigured:"
  grep -E '^(STALWART_API_KEY|SMTP_PASS|MAIL_PUBLIC_IP|DKIM_SELECTOR)=' .env || true
  echo "Create the Stalwart API token after first server setup; set SMTP_PASS after the notifications mailbox is activated."
fi

if grep -q 'ops@example.com' .env; then
  echo "Set TLS_EMAIL in .env before public HTTPS activation." >&2
  exit 1
fi

echo "[1/4] Validating owned host and mail compose definitions"
docker compose --env-file .env -f docker-compose.owned.yml config >/dev/null
if [[ "${MAIL_MODE:-local}" == "local" ]]; then
  docker compose --env-file .env -f mail/docker-compose.mail.yml config >/dev/null
fi

echo "[2/4] Building owned runtime"
docker compose --env-file .env -f docker-compose.owned.yml build --pull host-runtime mail-control-plane

echo "[3/4] Starting owned host services"
docker compose --env-file .env -f docker-compose.owned.yml up -d

echo "[4/4] Waiting for native host runtime health"
for i in {1..30}; do
  if docker compose --env-file .env -f docker-compose.owned.yml exec -T host-runtime node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    echo "IZAKHONO HOST runtime is healthy."
    docker compose --env-file .env -f docker-compose.owned.yml ps
    echo "Mail containers are staged; Stalwart API token and notification mailbox credentials are configured in a later mail setup step."
    exit 0
  fi
  sleep 2
done

echo "Runtime did not become healthy; inspect: docker compose -f docker-compose.owned.yml logs --tail=200" >&2
exit 1
