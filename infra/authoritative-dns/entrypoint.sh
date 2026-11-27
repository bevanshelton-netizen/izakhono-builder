#!/bin/sh
set -eu

: "${DNS_MODE:?DNS_MODE must be primary or secondary}"
: "${PRIMARY_NS_FQDN:?PRIMARY_NS_FQDN is required}"
: "${SECONDARY_NS_FQDN:?SECONDARY_NS_FQDN is required}"

# Validate names before they are written into PowerDNS configuration or SQL.
validate_fqdn() {
  value=$1
  printf '%s\n' "$value" | awk '
    length($0) > 253 || $0 !~ /^[A-Za-z0-9.-]+$/ { exit 1 }
    {
      n = split($0, labels, ".")
      if (n < 2) exit 1
      for (i = 1; i <= n; i++) {
        if (length(labels[i]) < 1 || length(labels[i]) > 63) exit 1
        if (labels[i] !~ /^[A-Za-z0-9]/ || labels[i] !~ /[A-Za-z0-9]$/) exit 1
      }
    }
  '
}

validate_ipv4() {
  printf '%s\n' "$1" | awk -F. '
    NF != 4 { exit 1 }
    {
      for (i = 1; i <= 4; i++) {
        if ($i !~ /^[0-9]+$/ || length($i) > 3 || $i + 0 > 255) exit 1
      }
    }
  '
}

if ! validate_fqdn "$PRIMARY_NS_FQDN"; then
  echo "PRIMARY_NS_FQDN must be a valid DNS hostname" >&2
  exit 64
fi
if ! validate_fqdn "$SECONDARY_NS_FQDN"; then
  echo "SECONDARY_NS_FQDN must be a valid DNS hostname" >&2
  exit 64
fi

DB=/var/lib/powerdns/pdns.sqlite3
CONFIG=/etc/powerdns/pdns.conf

if [ ! -s "$DB" ]; then
  sqlite3 "$DB" < /opt/izakhono-dns/schema.sqlite3.sql
  chown pdns:pdns "$DB"
fi

cat > "$CONFIG" <<EOF
setuid=pdns
setgid=pdns
local-address=0.0.0.0
local-port=53
launch=gsqlite3
gsqlite3-database=$DB
gsqlite3-pragma-foreign-keys=yes
gsqlite3-pragma-journal-mode=WAL
cache-ttl=20
query-cache-ttl=20
negquery-cache-ttl=20
any-to-tcp=yes
version-string=anonymous
EOF

if [ "$DNS_MODE" = "primary" ]; then
  : "${SECONDARY_PUBLIC_IPV4:?SECONDARY_PUBLIC_IPV4 is required for primary mode}"
  if ! validate_ipv4 "$SECONDARY_PUBLIC_IPV4"; then
    echo "SECONDARY_PUBLIC_IPV4 must be a valid IPv4 address" >&2
    exit 64
  fi
  cat >> "$CONFIG" <<EOF
primary=yes
secondary=no
also-notify=$SECONDARY_PUBLIC_IPV4
allow-axfr-ips=$SECONDARY_PUBLIC_IPV4
EOF
elif [ "$DNS_MODE" = "secondary" ]; then
  : "${PRIMARY_PUBLIC_IPV4:?PRIMARY_PUBLIC_IPV4 is required for secondary mode}"
  if ! validate_ipv4 "$PRIMARY_PUBLIC_IPV4"; then
    echo "PRIMARY_PUBLIC_IPV4 must be a valid IPv4 address" >&2
    exit 64
  fi
  cat >> "$CONFIG" <<EOF
primary=no
secondary=yes
autosecondary=yes
allow-notify-from=$PRIMARY_PUBLIC_IPV4
allow-axfr-ips=$PRIMARY_PUBLIC_IPV4
xfr-cycle-interval=60
EOF
  # Pair the primary source IP with the primary NS name in the zone NS RRset.
  sqlite3 "$DB" "INSERT OR IGNORE INTO supermasters(ip,nameserver,account) VALUES('$PRIMARY_PUBLIC_IPV4','$PRIMARY_NS_FQDN','izakhono');"
else
  echo "DNS_MODE must be primary or secondary" >&2
  exit 64
fi

if [ "${PDNS_API_ENABLED:-yes}" = "yes" ] && [ "$DNS_MODE" = "primary" ]; then
  : "${PDNS_API_KEY:?PDNS_API_KEY is required when the primary API is enabled}"
  case "$PDNS_API_KEY" in
    *'
'*|*'
'*)
      echo "PDNS_API_KEY must not contain newline characters" >&2
      exit 64
      ;;
  esac
  cat >> "$CONFIG" <<EOF
api=yes
api-key=$PDNS_API_KEY
webserver=yes
webserver-address=0.0.0.0
webserver-port=8081
EOF
else
  cat >> "$CONFIG" <<EOF
api=no
webserver=no
EOF
fi

exec /usr/sbin/pdns_server --daemon=no --guardian=no
