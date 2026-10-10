#!/bin/sh
set -eu

: "${PDNS_API_KEY:?set PDNS_API_KEY}"
: "${PDNS_API_URL:=http://127.0.0.1:8081/api/v1/servers/localhost}"
: "${ZONE:?set ZONE, for example allegrovibez.com}"
: "${PRIMARY_NS_FQDN:?set PRIMARY_NS_FQDN}"
: "${SECONDARY_NS_FQDN:?set SECONDARY_NS_FQDN}"

curl -fsS -X POST "$PDNS_API_URL/zones" \
  -H "X-API-Key: $PDNS_API_KEY" \
  -H 'Content-Type: application/json' \
  --data "{\"name\":\"$ZONE\",\"kind\":\"Native\",\"nameservers\":[\"$PRIMARY_NS_FQDN.\",\"$SECONDARY_NS_FQDN.\"]}" \
  || true

printf '%s\n' "Zone created or already exists: $ZONE"
printf '%s\n' "Next: import the preserved zone records, then rectify and verify SOA/NS/MX/TXT before delegation."
