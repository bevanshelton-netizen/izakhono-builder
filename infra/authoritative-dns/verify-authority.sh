#!/bin/sh
set -eu

: "${ZONE:?set ZONE}"
: "${PRIMARY_NS_FQDN:?set PRIMARY_NS_FQDN}"
: "${SECONDARY_NS_FQDN:?set SECONDARY_NS_FQDN}"
: "${PRIMARY_PUBLIC_IPV4:?set PRIMARY_PUBLIC_IPV4}"
: "${SECONDARY_PUBLIC_IPV4:?set SECONDARY_PUBLIC_IPV4}"

fail=0
check() {
  label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf 'PASS  %s\n' "$label"
  else
    printf 'FAIL  %s\n' "$label"
    fail=1
  fi
}

check "primary SOA" dig +time=3 +tries=1 @"$PRIMARY_PUBLIC_IPV4" "$ZONE" SOA +short
check "secondary SOA" dig +time=3 +tries=1 @"$SECONDARY_PUBLIC_IPV4" "$ZONE" SOA +short
check "primary NS" dig +time=3 +tries=1 @"$PRIMARY_PUBLIC_IPV4" "$ZONE" NS +short
check "secondary NS" dig +time=3 +tries=1 @"$SECONDARY_PUBLIC_IPV4" "$ZONE" NS +short
check "primary authoritative AA" sh -c "dig +time=3 +tries=1 @'$PRIMARY_PUBLIC_IPV4' '$ZONE' SOA | grep -q 'flags:.* aa'"
check "secondary authoritative AA" sh -c "dig +time=3 +tries=1 @'$SECONDARY_PUBLIC_IPV4' '$ZONE' SOA | grep -q 'flags:.* aa'"
check "primary nameserver A" sh -c "dig +time=3 +tries=1 @'$PRIMARY_PUBLIC_IPV4' '$PRIMARY_NS_FQDN' A +short | grep -q '$PRIMARY_PUBLIC_IPV4'"
check "secondary nameserver A" sh -c "dig +time=3 +tries=1 @'$SECONDARY_PUBLIC_IPV4' '$SECONDARY_NS_FQDN' A +short | grep -q '$SECONDARY_PUBLIC_IPV4'"

if [ "$fail" -ne 0 ]; then
  echo 'Authoritative DNS gate FAILED.' >&2
  exit 1
fi

echo 'Authoritative DNS gate PASSED.'
