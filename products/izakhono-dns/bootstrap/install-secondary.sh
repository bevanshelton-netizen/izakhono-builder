#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

NODE_ID="${IZAKHONO_DNS_NODE_ID:-ns2}"
ZONE="${IZAKHONO_DNS_ZONE:-}"
MASTER_IP="${IZAKHONO_DNS_MASTER_IP:-}"

[[ "$NODE_ID" == ns2 ]] || { echo "This installer is for ns2." >&2; exit 1; }
[[ -n "$ZONE" ]] || { echo "IZAKHONO_DNS_ZONE is required" >&2; exit 1; }
[[ "$MASTER_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || { echo "IZAKHONO_DNS_MASTER_IP must be an IPv4 address" >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y bind9 bind9-utils dnsutils

install -d -m 0750 /var/lib/izakhono-dns

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
    type slave;
    masters { ${MASTER_IP}; };
    file "/var/cache/bind/db.${ZONE}";
};
EOF

named-checkconf
systemctl enable --now bind9
systemctl restart bind9

cat > /var/lib/izakhono-dns/activation-proof.txt <<EOF
IZAKHONO_DNS_NODE_ID=${NODE_ID}
IZAKHONO_DNS_ZONE=${ZONE}
IZAKHONO_DNS_MASTER_IP=${MASTER_IP}
IZAKHONO_DNS_SERVICE=bind9
IZAKHONO_DNS_RECURSION=DISABLED
PUBLIC_DNS_STATUS=UNVERIFIED
NOTE=Configure authenticated AXFR/IXFR on ns1 before relying on this secondary.
EOF
chmod 0640 /var/lib/izakhono-dns/activation-proof.txt

echo "[PASS] Secondary DNS software installed."
echo "[PASS] Recursion disabled."
echo "[HOLD] Authenticated zone transfer and external parent delegation remain required."
