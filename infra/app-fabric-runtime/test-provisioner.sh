#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROVISIONER="${ROOT}/provisioner.sh"
MANIFEST="${ROOT}/manifests/faisready.json"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

export IZAKHONO_PROVISIONER_STATE="$TMP/state"

bash -n "$PROVISIONER"
plan="$("$PROVISIONER" plan "$MANIFEST")"
jq -e '.schema == "izakhono.provision-plan/v1" and .live == false and .next_gate == "register"' <<<"$plan" >/dev/null

registered="$("$PROVISIONER" register "$MANIFEST")"
jq -e '.schema == "izakhono.registry/v1" and .status == "REGISTERED" and .live == false' <<<"$registered" >/dev/null

gate="$("$PROVISIONER" provision "$MANIFEST")"
jq -e '.schema == "izakhono.provision/v1" and .status == "PROVISION_READY" and .live == false and .next_gate == "deploy"' <<<"$gate" >/dev/null

test -f "$TMP/state/registry/faisready.json"
test -f "$TMP/state/provisioning/faisready.json"
echo '[PASS] Universal provisioner plan/register/provision contract verified.'
