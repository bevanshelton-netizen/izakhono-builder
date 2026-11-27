#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."

backup="${1:-}"
identity="${2:-}"
if [[ -z "$backup" || -z "$identity" || ! -f "$backup" || ! -f "$identity" ]]; then
  echo "Usage: ./ops/restore.sh backups/izakhono-mail-<stamp>.tar.gz.age /secure/path/age-identity.txt" >&2
  exit 2
fi
command -v age >/dev/null || { echo "BLOCKED: age is required for restore." >&2; exit 1; }
command -v python3 >/dev/null || { echo "BLOCKED: python3 is required to validate the archive." >&2; exit 1; }
[[ -f .env ]] || { echo "BLOCKED: restore .env separately from the approved secret store." >&2; exit 1; }
[[ -f "$backup.sha256" ]] || { echo "BLOCKED: backup checksum sidecar is missing." >&2; exit 1; }
sha256sum -c "$backup.sha256"

stage="$(mktemp -d)"
cleanup() {
  if [[ -n "${stage:-}" && -d "$stage" ]]; then rm -rf "$stage"; fi
}
trap cleanup EXIT

echo "[1/6] Decrypting backup into a private temporary directory..."
age -d -i "$identity" -o "$stage/data.tar.gz" "$backup"

echo "[2/6] Validating archive paths and entry types before extraction..."
python3 - "$stage/data.tar.gz" <<'PY'
import sys
import tarfile
allowed = {"stalwart-etc", "stalwart-data", "roundcube-db"}
with tarfile.open(sys.argv[1], "r:gz") as archive:
    members = archive.getmembers()
    if not members:
        raise SystemExit("BLOCKED: empty backup archive")
    for member in members:
        name = member.name.rstrip("/")\n        parts = name.split("/")
        if not name or name.startswith("/") or any(part in {"", ".", ".."} for part in parts):
            raise SystemExit(f"BLOCKED: unsafe archive path: {member.name!r}")
        if parts[0] not in allowed:
            raise SystemExit(f"BLOCKED: unexpected archive component: {member.name!r}")
        if not (member.isdir() or member.isfile()):
            raise SystemExit(f"BLOCKED: non-regular archive entry: {member.name!r}")
    roots = {member.name.split("/")[0] for member in members}
    if roots != allowed:
        raise SystemExit(f"BLOCKED: incomplete backup components: {sorted(roots)}")
print("ARCHIVE_VALIDATION: PASS")
PY

mkdir -p "$stage/extracted"
tar --no-same-owner --no-same-permissions -xzf "$stage/data.tar.gz" -C "$stage/extracted"
for component in stalwart-etc stalwart-data roundcube-db; do
  [[ -d "$stage/extracted/$component" ]] || { echo "BLOCKED: backup is missing $component" >&2; exit 1; }
done

echo "[3/6] Creating an encrypted pre-restore safety backup..."
./ops/backup.sh

was_mail="$(docker inspect -f '{{.State.Running}}' izakhono-mailserver 2>/dev/null || echo false)"
was_db="$(docker inspect -f '{{.State.Running}}' izakhono-roundcube-db 2>/dev/null || echo false)"
was_webmail="$(docker inspect -f '{{.State.Running}}' izakhono-roundcube 2>/dev/null || echo false)"
restart_previous() {
  if [[ "$was_mail" == true ]]; then docker start izakhono-mailserver >/dev/null 2>&1 || true; fi
  if [[ "$was_db" == true ]]; then docker start izakhono-roundcube-db >/dev/null 2>&1 || true; fi
  if [[ "$was_webmail" == true ]]; then docker start izakhono-roundcube >/dev/null 2>&1 || true; fi
}
trap 'restart_previous; cleanup' EXIT

echo "[4/6] Stopping mail services before restoring persistent data..."
docker stop izakhono-roundcube izakhono-roundcube-db izakhono-mailserver >/dev/null 2>&1 || true

echo "[5/6] Restoring the verified data set..."
docker run --rm --network none \
  -v izakhono-mail-etc:/target \
  -v "$stage/extracted/stalwart-etc:/source:ro" \
  alpine:3.20 sh -c 'find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; cp -a /source/. /target/'
docker run --rm --network none \
  -v izakhono-mail-data:/target \
  -v "$stage/extracted/stalwart-data:/source:ro" \
  alpine:3.20 sh -c 'find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; cp -a /source/. /target/'
rm -rf roundcube-db
cp -a "$stage/extracted/roundcube-db" roundcube-db

echo "[6/6] Starting the canonical services and checking health..."
docker compose --env-file .env -f ../../izakhono-host/mail/docker-compose.mail.yml up -d
docker compose --env-file .env up -d
for i in {1..30}; do
  mail_health="$(docker inspect -f '{{.State.Health.Status}}' izakhono-mailserver 2>/dev/null || echo unavailable)"
  db_health="$(docker inspect -f '{{.State.Health.Status}}' izakhono-roundcube-db 2>/dev/null || echo unavailable)"
  web_health="$(docker inspect -f '{{.State.Health.Status}}' izakhono-roundcube 2>/dev/null || echo unavailable)"
  if [[ "$mail_health" == healthy && "$db_health" == healthy && "$web_health" == healthy ]]; then break; fi
  sleep 5
done
if [[ "$(docker inspect -f '{{.State.Health.Status}}' izakhono-mailserver 2>/dev/null || echo unavailable)" != healthy
  || "$(docker inspect -f '{{.State.Health.Status}}' izakhono-roundcube-db 2>/dev/null || echo unavailable)" != healthy
  || "$(docker inspect -f '{{.State.Health.Status}}' izakhono-roundcube 2>/dev/null || echo unavailable)" != healthy ]]; then
  echo "RESTORE BLOCKED: one or more services failed health checks; inspect logs and keep production promotion blocked." >&2
  exit 1
fi

echo "RESTORE COMPLETE: data restored and containers healthy. Run full SMTP/IMAP/DNS/TLS and backup acceptance before production promotion."
