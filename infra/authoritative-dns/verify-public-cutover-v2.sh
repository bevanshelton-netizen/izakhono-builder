#!/bin/sh
set -eu

: "${ZONE:?set ZONE}"
: "${PRIMARY_NS_FQDN:?set PRIMARY_NS_FQDN}"
: "${SECONDARY_NS_FQDN:?set SECONDARY_NS_FQDN}"
: "${PRIMARY_PUBLIC_IPV4:?set PRIMARY_PUBLIC_IPV4}"
: "${SECONDARY_PUBLIC_IPV4:?set SECONDARY_PUBLIC_IPV4}"

fail=0
pass_check() { printf 'PASS  %s\n' "$1"; }
fail_check() { printf 'FAIL  %s\n' "$1"; fail=1; }
run_check() {
  label="$1"; shift
  if "$@" >/dev/null 2>&1; then pass_check "$label"; else fail_check "$label"; fi
}

# Direct authoritative reachability.
run_check "primary UDP/53" sh -c "dig +time=3 +tries=1 @'$PRIMARY_PUBLIC_IPV4' '$ZONE' SOA +short | grep -q ."
run_check "primary TCP/53" sh -c "dig +tcp +time=3 +tries=1 @'$PRIMARY_PUBLIC_IPV4' '$ZONE' SOA +short | grep -q ."
run_check "secondary UDP/53" sh -c "dig +time=3 +tries=1 @'$SECONDARY_PUBLIC_IPV4' '$ZONE' SOA +short | grep -q ."
run_check "secondary TCP/53" sh -c "dig +tcp +time=3 +tries=1 @'$SECONDARY_PUBLIC_IPV4' '$ZONE' SOA +short | grep -q ."

# Both servers must advertise authority and the same SOA serial.
P_SOA=$(dig +time=3 +tries=1 @"$PRIMARY_PUBLIC_IPV4" "$ZONE" SOA +short || true)
S_SOA=$(dig +time=3 +tries=1 @"$SECONDARY_PUBLIC_IPV4" "$ZONE" SOA +short || true)
if printf '%s\n' "$P_SOA" | grep -q . && printf '%s\n' "$S_SOA" | grep -q .; then pass_check "SOA present on both"; else fail_check "SOA present on both"; fi
P_SERIAL=$(printf '%s\n' "$P_SOA" | awk '{print $3}')
S_SERIAL=$(printf '%s\n' "$S_SOA" | awk '{print $3}')
if [ -n "$P_SERIAL" ] && [ "$P_SERIAL" = "$S_SERIAL" ]; then pass_check "SOA serials match"; else fail_check "SOA serials match"; fi
run_check "primary authoritative AA" sh -c "dig @'$PRIMARY_PUBLIC_IPV4' '$ZONE' SOA | grep -q 'flags:.* aa'"
run_check "secondary authoritative AA" sh -c "dig @'$SECONDARY_PUBLIC_IPV4' '$ZONE' SOA | grep -q 'flags:.* aa'"

# The served NS set must contain the intended pair.
run_check "primary serves primary NS" sh -c "dig @'$PRIMARY_PUBLIC_IPV4' '$ZONE' NS +short | grep -Fqi '$PRIMARY_NS_FQDN'"
run_check "primary serves secondary NS" sh -c "dig @'$PRIMARY_PUBLIC_IPV4' '$ZONE' NS +short | grep -Fqi '$SECONDARY_NS_FQDN'"
run_check "secondary serves primary NS" sh -c "dig @'$SECONDARY_PUBLIC_IPV4' '$ZONE' NS +short | grep -Fqi '$PRIMARY_NS_FQDN'"
run_check "secondary serves secondary NS" sh -c "dig @'$SECONDARY_PUBLIC_IPV4' '$ZONE' NS +short | grep -Fqi '$SECONDARY_NS_FQDN'"

# Parent delegation check. This must be run against a resolver with trace support.
run_check "parent delegation includes primary" sh -c "dig +trace '$ZONE' NS 2>/dev/null | grep -Fqi '$PRIMARY_NS_FQDN'"
run_check "parent delegation includes secondary" sh -c "dig +trace '$ZONE' NS 2>/dev/null | grep -Fqi '$SECONDARY_NS_FQDN'"

# In-bailiwick glue checks.
case "$PRIMARY_NS_FQDN" in *."$ZONE".) run_check "primary glue resolves" sh -c "dig +short '$PRIMARY_NS_FQDN' A | grep -Fq '$PRIMARY_PUBLIC_IPV4'";; esac
case "$SECONDARY_NS_FQDN" in *."$ZONE".) run_check "secondary glue resolves" sh -c "dig +short '$SECONDARY_NS_FQDN' A | grep -Fq '$SECONDARY_PUBLIC_IPV4'";; esac

if [ "$fail" -ne 0 ]; then
  echo "IZAKHONO public DNS cutover gate FAILED." >&2
  exit 1
fi

echo "IZAKHONO public DNS cutover gate PASSED."
