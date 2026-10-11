# IZAKHONO Owned DNS Cutover Runbook v2

## Objective

Move a production zone from an external DNS dependency to the IZAKHONO authoritative DNS plane without losing web, mail, verification, security or service records.

## Architecture

```text
Registrar / Parent Registry
        |
        +--> ns1.<authority>  ---> IZAKHONO PowerDNS PRIMARY
        |
        +--> ns2.<authority>  ---> IZAKHONO PowerDNS SECONDARY

IZAKHONO HOST / PROVISIONER
        |
        +--> zone provisioning API
        +--> DNS health gates
        +--> TLS / web / mail record orchestration
```

## Phase 1 — Inventory

1. Identify the exact registered zone.
2. Export the complete existing zone before making changes.
3. Preserve A, AAAA, CNAME, MX, TXT, SRV, CAA, NS and verification records.
4. Record current TTLs and SOA serial.
5. Record the current registrar and delegation.
6. Record current mail routing, SPF, DKIM and DMARC.

No cutover proceeds with an incomplete inventory.

## Phase 2 — Build

1. Deploy the existing `infra/authoritative-dns` PowerDNS primary.
2. Deploy the secondary in a separate failure domain.
3. Assign stable public IPv4 addresses.
4. Expose UDP/53 and TCP/53 on both servers.
5. Restrict the PowerDNS API to the private management plane.
6. Restrict AXFR/IXFR to the approved secondary address/network.
7. Keep recursive DNS disabled; these servers are authoritative only.
8. Provision the zone and imported records.
9. Keep external DNS as an adapter/fallback until cutover evidence passes.

## Phase 3 — Validate

Run `verify-authority.sh` for the direct authoritative checks and `verify-public-cutover-v2.sh` for the public delegation gate.

Required evidence:

- primary and secondary answer on UDP/53;
- primary and secondary answer on TCP/53;
- authoritative AA flag;
- matching SOA serials;
- matching NS set;
- parent delegation points to the intended nameservers;
- in-bailiwick glue resolves correctly;
- web records resolve to the intended edge;
- existing MX/TXT records remain intact;
- DNSSEC is validated end-to-end before it is treated as production-ready.

## Phase 4 — Cutover

The registrar nameserver change is the only manual/owner-authorized external operation in this runbook.

Before changing delegation:

- capture a final zone snapshot;
- confirm rollback zone is available;
- confirm both IZAKHONO servers are healthy;
- confirm mail records are present;
- confirm application records are present;
- confirm the old provider remains available during propagation.

After delegation changes, independently verify the parent and each authoritative server.

## Phase 5 — Completion

Set the project state to `LIVE` only when independent public evidence exists.

A successful software deployment is not sufficient evidence of public DNS authority.

## Rollback

If any public verification gate fails:

1. Do not modify application records to compensate.
2. Restore the previous registrar delegation.
3. Keep the IZAKHONO zone intact for diagnosis.
4. Compare the parent delegation, glue, SOA, NS, web and mail records.
5. Re-run the complete gate before attempting another cutover.

## Security rules

- No DNS API key, database password or TSIG secret enters source control.
- No recursive resolver is exposed from the authoritative servers.
- No customer zone is published before its provisioning state is valid.
- No public-live label is emitted without evidence.
- Cloudflare and other providers remain replaceable adapters, not the source of truth.
