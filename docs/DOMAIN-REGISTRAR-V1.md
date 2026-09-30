# IZAKHONO DOMAIN REGISTRAR V1

## Objective
Build an IZAKHONO-owned domain registration control plane so customers can search, register, renew, transfer and manage domains through IZAKHONO, while keeping the provider/registry connection replaceable.

## Important boundary
IZAKHONO can own the storefront, customer account system, billing, DNS control plane, audit trail and registrar orchestration. It cannot invent ownership of a public TLD: actual .com registrations must reach the authoritative registry through an accredited registrar/registry relationship. ICANN requires direct gTLD registry access to be backed by registrar accreditation.

## Architecture
Customer -> IZAKHONO DOMAIN -> Registrar API Adapter -> Registry/Accredited Registrar
                         -> IZAKHONO DNS
                         -> IZAKHONO HOST / Mail
                         -> Billing + Ledger
                         -> RDAP/WHOIS verification
                         -> Audit + alerts

### Core services
- Domain Search: availability, registration and renewal pricing.
- Domain Orders: quote -> checkout -> pending -> registered -> failed/refunded.
- Registration: contacts, nameservers, auth codes, registry responses.
- Lifecycle: renew, transfer, restore, lock/unlock, nameserver changes.
- DNS: A/AAAA/CNAME/MX/TXT/CAA/NS records through the owned DNS control plane.
- RDAP: registration-state verification.
- Billing: customer charges, provider cost, margin and renewal ledger.
- Adapter layer: no provider-specific API leaks into the customer-facing application.
- Audit: immutable event history for every domain mutation.
- Customer portal: domain list, expiry, nameservers, DNS, contacts and transfer controls.

## Provider strategy
Phase 1: build IZAKHONO's complete registrar platform and use a replaceable accredited registrar/registry adapter for real .com transactions.
Phase 2: qualify and apply for ICANN accreditation where commercially justified.
Phase 3: contract directly with supported registries and remove unnecessary intermediary dependency.

## Security
- Encrypt provider credentials and domain auth codes.
- Never expose registry credentials to browser clients.
- Require authenticated owner/customer sessions for mutations.
- Log actor, timestamp, domain, previous state and new state.
- Add idempotency keys to all registration/renewal/transfer mutations.
- Never claim a domain is registered until registry/RDAP evidence confirms it.

## Calvin activation
Current test case: xqwaxqwamile.com.
The domain is currently available at US$11.25 for one year through the available domain-search control. No purchase is performed by this specification. Registration requires an authorized purchase transaction and an actual registrar/registry endpoint.

## Acceptance gates
1. Search returns authoritative/adapter-backed availability.
2. Quote includes registration + renewal + IZAKHONO price.
3. Checkout creates an idempotent order.
4. Registration records the provider/registry transaction ID.
5. RDAP confirms registered state.
6. DNS nameservers resolve.
7. DNS record changes are observable.
8. Renewal and expiry dates are reconciled.
9. Transfer locks/auth codes are protected.
10. Customer handover cannot show "active" without evidence.
