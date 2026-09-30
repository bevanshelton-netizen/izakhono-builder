# IZAKHONO Registry — Free Build Track

## Objective

Build the registry and registrar technology without paying a registry accreditation, TLD application, domain purchase, or proprietary software fee.

## Current boundary

IZAKHONO can independently operate a private/test namespace. Public `.co.za` provisioning remains an external-authority integration because ZARC controls the `.co.za` registry and requires registrar accreditation before provisioning. This is an authority boundary, not a software limitation.

## Free build sequence

1. Registry data model and lifecycle
2. In-memory and PostgreSQL storage contracts
3. EPP command layer
4. RDAP service
5. DNS/PowerDNS adapter
6. Private `.izt` test namespace
7. Registrar API and customer portal
8. Idempotency, audit, abuse/dispute and security controls
9. Automated conformance suite
10. Deployment packaging for IZAKHONO-owned infrastructure
11. External registry adapters only when credentials exist

## Release truth

- TEST ONLY: private namespace or mock registry.
- READY: software built and tests pass.
- PENDING ACTIVATION: external authority or credentials still required.
- LIVE: only after an end-to-end authoritative transaction and DNS/RDAP verification.

Never sell or represent an externally controlled namespace as registered without authoritative evidence.

## Public TLD path

A future IZAKHONO-controlled public gTLD requires the applicable ICANN process and root-zone delegation. The registry technology should therefore be built to the same critical service model: DNS, DNSSEC, EPP, RDAP and data escrow. ICANN's 2026 program also requires applicants to identify evaluated Registry Service Providers.

## Zero-cost rule

No accreditation, application fee, paid domain, paid infrastructure or third-party service spend is incurred by this build track without explicit authorization.
