#!/usr/bin/env python3
"""Offline structural validation for the owned authoritative-DNS cutover manifest."""
from __future__ import annotations

import json
import sys
from pathlib import Path

manifest_path = Path(__file__).with_name("dns-cutover-manifest.v2.json")
try:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError) as exc:
    print(f"DNS manifest cannot be read: {exc}", file=sys.stderr)
    raise SystemExit(1)

errors: list[str] = []

def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)

require(manifest.get("schema") == "izakhono.authoritative-dns/cutover-v2", "unexpected schema")
require(manifest.get("mode") == "owned-first", "mode must remain owned-first")

authority = manifest.get("authority", {})
require(authority.get("provider") == "IZAKHONO Authoritative DNS", "unexpected authority provider")
require(authority.get("implementation") == "PowerDNS Authoritative", "unexpected DNS implementation")
require(bool(authority.get("primary")), "primary nameserver is missing")
require(bool(authority.get("secondary")), "secondary nameserver is missing")
require(authority.get("primary") != authority.get("secondary"), "primary and secondary must differ")

required_evidence = {
    "primary_public_ipv4",
    "secondary_public_ipv4",
    "distinct_failure_domains",
    "udp53_reachable_primary",
    "tcp53_reachable_primary",
    "udp53_reachable_secondary",
    "tcp53_reachable_secondary",
    "parent_ns_matches",
    "zone_ns_matches",
    "soa_consistent",
    "mail_records_preserved",
    "dnssec_validated_if_enabled",
}
evidence = set(manifest.get("required_evidence", []))
require(required_evidence <= evidence, "required cutover evidence fields are missing")

required_states = [
    "REQUESTED",
    "ZONE_IMPORTED",
    "SERVING_PRIVATE",
    "PUBLIC_REACHABILITY_VERIFIED",
    "PARENT_DELEGATION_VERIFIED",
    "AUTHORITY_VERIFIED",
    "DNSSEC_VERIFIED",
    "CUTOVER_APPROVED",
    "LIVE",
]
states = manifest.get("state_machine", [])
positions = [states.index(state) for state in required_states if state in states]
require(len(positions) == len(required_states), "cutover state machine is missing required states")
require(positions == sorted(positions), "cutover states are out of order")

safety = manifest.get("safety", {})
for key in (
    "preserve_existing_zone_before_change",
    "preserve_mx_txt_records",
    "rollback_required",
    "public_live_requires_independent_evidence",
    "registrar_change_requires_owner_authorization",
):
    require(safety.get(key) is True, f"safety gate must remain true: {key}")

if errors:
    for error in errors:
        print(f"FAIL  {error}", file=sys.stderr)
    raise SystemExit(1)

print("Authoritative DNS manifest: PASS")
print(f"Evidence fields: {len(evidence)}")
print(f"Cutover states: {len(states)}")
