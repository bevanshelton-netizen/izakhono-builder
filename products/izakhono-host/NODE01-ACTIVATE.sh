#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

printf '\nIZAKHONO HOST — NODE01 SOFTWARE ACTIVATION ON ISN-01\n\n'

# Stage 1: verify the actual execution environment.
./NODE-PREFLIGHT.sh

# Stage 2: generate owner secrets, Roundcube secrets and start the owned host stack.
./bootstrap-owned.sh

# Stage 3: start the local or remote Stalwart mail plane.
./mail/STALWART-ACTIVATE.sh

# Stage 4: formal local compliance gate.
./NODE-COMPLIANCE.sh

# Stage 5: explicit local host-runtime evidence.
echo
curl -fsS http://127.0.0.1:8080/health
echo

echo
echo "NODE01 SOFTWARE ACTIVATION: HOST RUNTIME STARTED"
echo "Mail services have been staged. Mailbox creation remains blocked until the Stalwart API token and domain ownership verification are completed."
echo "Hosting Control Centre: https://hosting-admin.izakhonoafrica.co.za (password file: host/secrets/host_admin_password)"
echo "Mail Control Centre: https://mail-admin.izakhonoafrica.co.za (password file: mail/secrets/mail_admin_password)"
echo "Public LIVE status remains blocked until DNS, TLS, static-IP/PTR, external SMTP, IMAP, deliverability and restore acceptance pass."
echo
echo "Useful verification:"
echo "  docker compose --env-file .env -f docker-compose.owned.yml ps"
echo "  docker compose --env-file .env -f mail/docker-compose.mail.yml ps"
echo "  ./mail/MAIL-CONTROL-PLANE-VERIFY.sh status"
echo "  ./mail/MAIL-ACCEPTANCE-REAL.sh"
echo
