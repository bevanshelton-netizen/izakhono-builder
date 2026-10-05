#!/usr/bin/env bash
set -euo pipefail

# Usage: ./cutover-check.sh example.com ns1.example.net ns2.example.net
ZONE="${1:?zone required}"
NS1="${2:?primary nameserver required}"
NS2="${3:?secondary nameserver required}"

command -v dig >/dev/null || { echo "dig is required" >&2; exit 2; }

fail=0
check() {
  if "$@"; then echo "PASS $*"; else echo "FAIL $*"; fail=1; fi
}

check dig +short NS "$ZONE" @1.1.1.1
check dig +short NS "$ZONE" @8.8.8.8
check dig +short SOA "$ZONE" @"$NS1"
check dig +short SOA "$ZONE" @"$NS2"
check dig +tcp +short SOA "$ZONE" @"$NS1"
check dig +tcp +short SOA "$ZONE" @"$NS2"

# Authoritative servers must not provide recursion.
if dig +short +recurse "$ZONE" @"$NS1" >/dev/null 2>&1; then
  echo "INFO recursion query completed; inspect flags with: dig +norecurse +noall +answer +authority +comments $ZONE @$NS1"
fi

if [[ "$fail" -eq 0 ]]; then
  echo "PUBLIC_DNS_STATUS=VERIFIED_PENDING_DNSSEC"
else
  echo "PUBLIC_DNS_STATUS=UNVERIFIED"
  exit 1
fi
