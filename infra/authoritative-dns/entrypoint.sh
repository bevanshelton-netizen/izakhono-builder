#!/bin/sh
set -eu

: "${PDNS_API_KEY:?PDNS_API_KEY is required}"
: "${DNS_MODE:?DNS_MODE must be primary or secondary}"
: "${PRIMARY_NS_FQDN:?PRIMARY_NS_FQDN is required}"
: "${SECONDARY_NS_FQDN:?SECONDARY_NS_FQDN is required}"

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
  cat >> "$CONFIG" <<EOF
primary=yes
secondary=no
also-notify=$SECONDARY_PUBLIC_IPV4
allow-axfr-ips=$SECONDARY_PUBLIC_IPV4
EOF
elif [ "$DNS_MODE" = "secondary" ]; then
  : "${PRIMARY_PUBLIC_IPV4:?PRIMARY_PUBLIC_IPV4 is required for secondary mode}"
  cat >> "$CONFIG" <<EOF
primary=no
secondary=yes
autosecondary=yes
allow-notify-from=$PRIMARY_PUBLIC_IPV4
allow-axfr-ips=$PRIMARY_PUBLIC_IPV4
xfr-cycle-interval=60
EOF
  sqlite3 "$DB" "INSERT OR IGNORE INTO supermasters(ip,nameserver,account) VALUES('$PRIMARY_PUBLIC_IPV4','$SECONDARY_NS_FQDN','izakhono');"
else
  echo "DNS_MODE must be primary or secondary" >&2
  exit 64
fi

if [ "${PDNS_API_ENABLED:-yes}" = "yes" ] && [ "$DNS_MODE" = "primary" ]; then
  cat >> "$CONFIG" <<EOF
api=yes
api-key=$PDNS_API_KEY
webserver=yes
webserver-address=127.0.0.1
webserver-port=8081
EOF
else
  cat >> "$CONFIG" <<EOF
api=no
webserver=no
EOF
fi

exec /usr/sbin/pdns_server --daemon=no --guardian=no
