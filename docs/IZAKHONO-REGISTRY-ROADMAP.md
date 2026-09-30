# IZAKHONO REGISTRY ROADMAP

## R0 — Free build
- Registry core and lifecycle engine
- EPP parser/response foundation
- RDAP
- PostgreSQL adapter contract
- PowerDNS adapter contract
- private/test TLD
- conformance tests
- security/audit model
- external registry adapters

## R1 — Owned runtime
Move persistence to IZAKHONO PostgreSQL and authoritative DNS to IZAKHONO-controlled PowerDNS/FORTRESS infrastructure. Add TLS, EPP client authentication, rate limits, idempotency keys, encrypted secrets, backup/restore and monitoring.

## R2 — .co.za connectivity
Use an accredited ZARC path as an adapter. No production registration claim until ZARC credentials and an actual end-to-end transaction are verified.

## R3 — IZAKHONO public TLD
A self-built registry is not sufficient to create a globally resolvable public TLD. ICANN's current 2026 program requires a gTLD applicant to identify an evaluated Registry Service Provider (RSP), and registry operators must meet DNS, DNSSEC, EPP, RDAP and data-escrow requirements.

## R4 — RSP capability
Evaluate whether IZAKHONO should itself qualify as an RSP in a future ICANN round, or use an evaluated RSP while keeping IZAKHONO Registry as the product/control plane.
