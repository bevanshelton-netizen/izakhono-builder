#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

NODE_ID="${IZAKHONO_DNS_NODE_ID:-}"
PUBLIC_IP="${IZAKHONO_DNS_PUBLIC_IP:-}"
ZONE="${IZAKHONO_DNS_ZONE:-}"

[[ "$NODE_ID" =~ ^ns[0-9]+$ ]] || { echo "IZAKHONO_DNS_NODE_ID must look like ns1 or ns2" >&2; exit 1; }
[[ "$PUBLIC_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || { echo "IZAKHONO_DNS_PUBLIC_IP must be an IPv4 address" >&2; exit 1; }
[[ -n "$ZONE" && "$ZONE" != */* ]] || { echo "IZAKHONO_DNS_ZONE is required" >&2; exit 1; }

if [[ "$PUBLIC_IP" == 203.0.113.* || "$PUBLIC_IP" == 198.51.100.* || "$PUBLIC_IP" == 192.0.2.* ]]; then
  echo "Documentation/test IPv4 range supplied; refusing production bootstrap." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y bind9 bind9-utils dnsutils

install -d -m 0750 /etc/bind/zones /var/lib/izakhono-dns

cat >/etc/bind/named.conf.options <<'EOF'
options {
    directory "/var/cache/bind";
    recursion no;
    allow-recursion { none; };
    allow-query-cache { none; };
    allow-query { any; };
    listen-on { any; };
    listen-on-v6 { any; };
    minimal-responses yes;
    version "not disclosed";
    auth-nxdomain no;
};
EOF

cat >/etc/bind/named.conf.local <<EOF
zone "${ZONE}" {
    type master;
    file "/etc/bind/zones/db.${ZONE}";
    allow-transfer { none; };
    notify no;
};
EOF

cat >"/etc/bind/zones/db.${ZONE}" <<EOF
\$TTL 3600
@ IN SOA ns1.${ZONE}. hostmaster.${ZONE}. (
    2026100501 ; serial
    3600       ; refresh
    600        ; retry
    1209600    ; expire
    3600       ; negative cache
)
@ IN NS ns1.${ZONE}.
@ IN NS ns2.${ZONE}.
ns1 IN A ${PUBLIC_IP}
EOF

# Validate before enabling the service.
named-checkconf
named-checkzone "$ZONE" "/etc/bind/zones/db.${ZONE}"
systemctl enable --now bind9
systemctl restart bind9

cat > /var/lib/izakhono-dns/activation-proof.txt <<EOF
IZAKHONO_DNS_NODE_ID=${NODE_ID}
IZAKHONO_DNS_ZONE=${ZONE}
IZAKHONO_DNS_PUBLIC_IP=${PUBLIC_IP}
IZAKHONO_DNS_SERVICE=bind9
IZAKHONO_DNS_RECURSION=DISABLED
PUBLIC_DNS_STATUS=UNVERIFIED
NOTE=External parent delegation and independent authoritative verification still required.
EOF
chmod 0640 /var/lib/izakhono-dns/activation-proof.txt

echo "[PASS] Authoritative DNS software installed on ${NODE_ID}."
echo "[PASS] Recursion disabled."
echo "[PASS] TCP/UDP 53 service enabled."
echo "[HOLD] PUBLIC_DNS_STATUS=UNVERIFIED until parent delegation is externally confirmed."
