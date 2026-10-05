# IZAKHONO Authoritative DNS Host Bootstrap

This package turns a fresh Debian/Ubuntu Linux host into an authoritative-only IZAKHONO DNS node.

It is deliberately **not** a public cutover by itself. The operator must supply real public IP addresses, registrar delegation/glue, and independently verify the resulting nameservers.

## Design

- BIND 9 authoritative-only service.
- Recursion disabled.
- DNSSEC signing remains an explicit verification gate.
- AXFR/IXFR is disabled until authenticated secondary configuration is supplied.
- Listens on TCP/UDP 53.
- Does not expose SSH or application ports.
- Generates an installation receipt under `/var/lib/izakhono-dns/activation-proof.txt`.
- Never writes registrar credentials or private DNSSEC material to Git.

## Usage

On a fresh Debian/Ubuntu host as root:

```bash
export IZAKHONO_DNS_NODE_ID=ns1
export IZAKHONO_DNS_PUBLIC_IP=203.0.113.10
export IZAKHONO_DNS_ZONE=example.com
./install-authoritative.sh
```

Replace example values with real infrastructure. `203.0.113.10` is documentation-only and must never be used as a production address.

For a second node use `ns2` and a separate public IP/failure domain. Do not reuse the same physical host if the goal is resilient authoritative DNS.

## Activation rule

The installer may report the **software service** ready, but IZAKHONO DNS remains `PUBLIC_DNS_STATUS=UNVERIFIED` until the external verification script confirms authoritative SOA/NS responses from independent resolvers and the registrar's parent delegation is confirmed.
