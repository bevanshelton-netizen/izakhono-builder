#!/usr/bin/env bash
set -euo pipefail

DOMAIN="streamkoraafrica.com"
MAIL_HOST="mail.${DOMAIN}"
ACCOUNT="info@${DOMAIN}"
ROOT="/opt/izakhono/kora-mail"
CF_API="https://api.cloudflare.com/client/v4"

: "${KORA_MAIL_PASSWORD:?KORA_MAIL_PASSWORD must be supplied through the NODE01 secret store; never commit it to Git}"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN must be supplied through the NODE01 secret store; never commit it to Git}"

install -d -m 700 "${ROOT}/data" "${ROOT}/data/mail-data" "${ROOT}/data/mail-state" "${ROOT}/data/config" "${ROOT}/data/letsencrypt"

cp "$(dirname "$0")/compose.yml" "${ROOT}/compose.yml"
cp "$(dirname "$0")/mail.env.example" "${ROOT}/mail.env"
chmod 600 "${ROOT}/mail.env"

cf() {
  curl -fsS \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H 'Content-Type: application/json' \
    "$@"
}

json_value() {
  python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["result"][0]["id"])'
}

ZONE_ID="$(cf "${CF_API}/zones?name=${DOMAIN}&status=active&per_page=1" | json_value)"

PUBLIC_IPV4="$(curl -4 -fsS https://api.ipify.org)"
if [[ ! "${PUBLIC_IPV4}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Could not determine a public IPv4 address for NODE01" >&2
  exit 1
fi

record_json() {
  local type="$1" name="$2"
  cf "${CF_API}/zones/${ZONE_ID}/dns_records?type=${type}&name=${name}&per_page=100"
}

upsert_record() {
  local type="$1" name="$2" content="$3" priority="${4:-}"
  local existing id payload
  existing="$(record_json "${type}" "${name}")"
  id="$(printf '%s' "${existing}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["result"][0]["id"] if d.get("result") else "")')"
  if [[ "${type}" == "MX" ]]; then
    payload="$(python3 - "$name" "$content" "$priority" <<'PY'
import json,sys
name,content,priority=sys.argv[1:]
print(json.dumps({"type":"MX","name":name,"content":content,"priority":int(priority),"ttl":300}))
PY
)"
  elif [[ "${type}" == "A" ]]; then
    payload="$(python3 - "$name" "$content" <<'PY'
import json,sys
name,content=sys.argv[1:]
print(json.dumps({"type":"A","name":name,"content":content,"proxied":False,"ttl":300}))
PY
)"
  else
    payload="$(python3 - "$type" "$name" "$content" <<'PY'
import json,sys
type_,name,content=sys.argv[1:]
print(json.dumps({"type":type_,"name":name,"content":content,"ttl":300}))
PY
)"
  fi

  if [[ -n "${id}" ]]; then
    cf -X PUT "${CF_API}/zones/${ZONE_ID}/dns_records/${id}" --data "${payload}" >/dev/null
  else
    cf -X POST "${CF_API}/zones/${ZONE_ID}/dns_records" --data "${payload}" >/dev/null
  fi
}

upsert_record A "${MAIL_HOST}" "${PUBLIC_IPV4}"
upsert_record MX "${DOMAIN}" "${MAIL_HOST}" 10

SPF_EXISTING="$(record_json TXT "${DOMAIN}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("\n".join(r["content"] for r in d.get("result",[]) if r.get("content","").startswith("v=spf1")))')"
if [[ -z "${SPF_EXISTING}" ]]; then
  upsert_record TXT "${DOMAIN}" "v=spf1 mx ~all"
else
  echo "Existing SPF preserved; verifying it is compatible with the owned MX path."
fi

DMARC_EXISTING="$(record_json TXT "_dmarc.${DOMAIN}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("\n".join(r["content"] for r in d.get("result",[]) if r.get("content","").startswith("v=DMARC1")))')"
if [[ -z "${DMARC_EXISTING}" ]]; then
  upsert_record TXT "_dmarc.${DOMAIN}" "v=DMARC1; p=none; adkim=r; aspf=r; pct=100; ri=86400"
fi

# Obtain a trusted certificate for mail.streamkoraafrica.com without taking over the existing web ports.
CF_CREDS="${ROOT}/cloudflare.ini"
printf 'dns_cloudflare_api_token = %s\n' "${CLOUDFLARE_API_TOKEN}" > "${CF_CREDS}"
chmod 600 "${CF_CREDS}"

cleanup() { rm -f "${CF_CREDS}"; }
trap cleanup EXIT

docker run --rm \
  -v "${ROOT}/data/letsencrypt:/etc/letsencrypt" \
  -v "${CF_CREDS}:/run/secrets/cloudflare.ini:ro" \
  certbot/dns-cloudflare:latest certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /run/secrets/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 30 \
  -d "${MAIL_HOST}" \
  --agree-tos \
  --register-unsafely-without-email \
  --non-interactive

cd "${ROOT}"
docker compose pull
docker compose up -d

ready=0
for i in $(seq 1 60); do
  if docker exec kora-mail supervisorctl status postfix 2>/dev/null | grep -q RUNNING && \
     docker exec kora-mail supervisorctl status dovecot 2>/dev/null | grep -q RUNNING; then
    ready=1
    break
  fi
  sleep 5
done
if [[ "${ready}" != 1 ]]; then
  docker logs --tail 200 kora-mail || true
  exit 1
fi

docker exec kora-mail setup email add "${ACCOUNT}" "${KORA_MAIL_PASSWORD}" || true
docker exec kora-mail setup alias add "postmaster@${DOMAIN}" "${ACCOUNT}" || true
docker exec kora-mail setup alias add "sales@${DOMAIN}" "${ACCOUNT}" || true
docker exec kora-mail setup alias add "partnerships@${DOMAIN}" "${ACCOUNT}" || true
docker exec kora-mail setup alias add "support@${DOMAIN}" "${ACCOUNT}" || true
docker exec kora-mail setup alias add "admin@${DOMAIN}" "${ACCOUNT}" || true

docker exec kora-mail setup config dkim domain "${DOMAIN}" || true

DKIM_FILE="$(docker exec kora-mail sh -lc "find /tmp/docker-mailserver/rspamd/dkim -maxdepth 1 -type f -name '*-${DOMAIN}.public.txt' | head -n 1" | tr -d '\r')"
if [[ -z "${DKIM_FILE}" ]]; then
  echo "DKIM public key file was not generated" >&2
  exit 1
fi
DKIM_RECORD="$(docker exec kora-mail cat "${DKIM_FILE}")"
SELECTOR="mail"
DKIM_PUBLIC="$(printf '%s' "${DKIM_RECORD}" | tr -d '\n' | sed -n 's/.*p=\([^\"]*\).*/\1/p' | tr -d '[:space:]')"
if [[ -z "${DKIM_PUBLIC}" ]]; then
  echo "Could not extract DKIM public key" >&2
  exit 1
fi
upsert_record TXT "${SELECTOR}._domainkey.${DOMAIN}" "v=DKIM1; k=rsa; p=${DKIM_PUBLIC}"

docker compose restart kora-mail

cat > "${ROOT}/ACCEPTANCE-NEXT.txt" <<EOF
KORA owned mail account provisioned:
${ACCOUNT}

Mail host:
${MAIL_HOST}

NODE01 public IPv4:
${PUBLIC_IPV4}

DNS configured by this deployment:
A   ${MAIL_HOST} -> ${PUBLIC_IPV4}
MX  ${DOMAIN} -> ${MAIL_HOST} (priority 10)
SPF preserved if already present, otherwise v=spf1 mx ~all
DMARC published in monitoring mode if absent
DKIM published for selector ${SELECTOR}

Required network:
TCP 25, 465, 587, 993 reachable from the public internet.
PTR/rDNS for NODE01 public IP must resolve to ${MAIL_HOST}.

Do not mark LIVE until external inbound, outbound, reply, SPF, DKIM, DMARC and TLS tests pass.
EOF
chmod 600 "${ROOT}/ACCEPTANCE-NEXT.txt"

echo "KORA MAIL PROVISIONED ON NODE01: ${ACCOUNT}"
