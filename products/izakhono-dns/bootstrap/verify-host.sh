#!/usr/bin/env bash
set -euo pipefail

ZONE="${IZAKHONO_DNS_ZONE:-}"
NS1="${IZAKHONO_DNS_NS1:-}"
NS2="${IZAKHONO_DNS_NS2:-}"

[[ -n "$ZONE" && -n "$NS1" && -n "$NS2" ]] || {
  echo "Set IZAKHONO_DNS_ZONE, IZAKHONO_DNS_NS1 and IZAKHONO_DNS_NS2." >&2
  exit 2
}

command -v dig >/dev/null || { echo "dig is required" >&2; exit 2; }

fail=0
check() {
  local label="$1"; shift
  if "$@"; then
    echo "[PASS] $label"
  else
    echo "[FAIL] $label"
    fail=1
  fi
}

check "NS1 answers SOA authoritatively" sh -c "dig +noall +answer +norecurse @${NS1} ${ZONE} SOA | grep -q '${ZONE}.*SOA'"
check "NS2 answers SOA authoritatively" sh -c "dig +noall +answer +norecurse @${NS2} ${ZONE} SOA | grep -q '${ZONE}.*SOA'"
check "NS1 recursion refused/not available" sh -c "! dig +short @${NS1} example.com A | grep -q ."
check "NS2 recursion refused/not available" sh -c "! dig +short @${NS2} example.com A | grep -q ."

if [[ "$fail" -eq 0 ]]; then
  echo "PUBLIC_DNS_STATUS=AUTHORITY_RESPONDING"
  exit 0
fi

echo "PUBLIC_DNS_STATUS=UNVERIFIED"
exit 1
