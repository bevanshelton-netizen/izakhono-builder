#!/usr/bin/env bash
set -euo pipefail

DOMAIN="streamkoraafrica.com"
MAIL_HOST="mail.${DOMAIN}"
ACCOUNT="info@${DOMAIN}"
ROOT="/opt/izakhono/kora-mail"

: "${KORA_MAIL_PASSWORD:?KORA_MAIL_PASSWORD must be supplied through the NODE01 secret store; never commit it to Git}"

install -d -m 700 "${ROOT}/data" "${ROOT}/data/mail-data" "${ROOT}/data/mail-state" "${ROOT}/data/config" "${ROOT}/data/letsencrypt"

cp "$(dirname "$0")/compose.yml" "${ROOT}/compose.yml"
cp "$(dirname "$0")/mail.env.example" "${ROOT}/mail.env"
chmod 600 "${ROOT}/mail.env"

cd "${ROOT}"

docker compose pull

docker compose up -d

# Wait for the MTA/MDA before account provisioning.
for i in $(seq 1 30); do
  if docker exec kora-mail supervisorctl status postfix 2>/dev/null | grep -q RUNNING && \
     docker exec kora-mail supervisorctl status dovecot 2>/dev/null | grep -q RUNNING; then
    break
  fi
  sleep 5
done

docker exec kora-mail setup email add "${ACCOUNT}" "${KORA_MAIL_PASSWORD}"
docker exec kora-mail setup alias add "postmaster@${DOMAIN}" "${ACCOUNT}"
docker exec kora-mail setup alias add "sales@${DOMAIN}" "${ACCOUNT}"
docker exec kora-mail setup alias add "partnerships@${DOMAIN}" "${ACCOUNT}"
docker exec kora-mail setup alias add "support@${DOMAIN}" "${ACCOUNT}"
docker exec kora-mail setup alias add "admin@${DOMAIN}" "${ACCOUNT}"

docker exec kora-mail setup config dkim domain "${DOMAIN}"
docker compose restart kora-mail

cat > "${ROOT}/ACCEPTANCE-NEXT.txt" <<EOF
KORA owned mail account provisioned:
${ACCOUNT}

Mail host:
${MAIL_HOST}

Required public DNS:
MX  ${DOMAIN} -> ${MAIL_HOST} (priority 10)
A   ${MAIL_HOST} -> NODE01 public IPv4
AAAA ${MAIL_HOST} -> NODE01 public IPv6 (only if verified)
TXT ${DOMAIN} -> v=spf1 mx ~all (tighten after verification)
TXT _dmarc.${DOMAIN} -> v=DMARC1; p=none; adkim=r; aspf=r; pct=100
TXT <DKIM selector>._domainkey.${DOMAIN} -> generated public key from ${ROOT}/data/config

Required network:
TCP 25, 465, 587, 993 reachable from the public internet.
PTR/rDNS for NODE01 public IP must resolve to ${MAIL_HOST}.

Do not mark LIVE until external inbound, outbound, reply, SPF, DKIM, DMARC and TLS tests pass.
EOF
chmod 600 "${ROOT}/ACCEPTANCE-NEXT.txt"

echo "KORA MAIL PROVISIONED ON NODE01: ${ACCOUNT}"
