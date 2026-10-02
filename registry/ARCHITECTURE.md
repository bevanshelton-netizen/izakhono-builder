# IZAKHONO Registry — Clean Architecture Baseline

## Purpose
The registry is the TLD-agnostic control plane for IZAKHONO domain-registration products, private/test namespaces and future external authorities.

## Canonical layers
1. Transport — HTTP, EPP and customer/registrar interfaces.
2. Application workflow — registration, renewal, transfer, DNS verification, RDAP verification and handover.
3. Domain model — domain/contact/host/order lifecycle rules and invariants.
4. Persistence — D1/Postgres-compatible stores; business rules stay out of storage adapters.
5. Authority adapters — external registries; never treated as confirmed without transport confirmation.
6. Infrastructure adapters — DNS, RDAP, payment and messaging providers.

## Canonical registration truth
authorityConfirmed -> dnsPublished -> dnsVerified -> rdapVerified -> readyForHandover -> handedOver

The registry must not infer external authority from local state. A local domain marked ok is valid only after authoritative confirmation and DNS/RDAP verification.

## Idempotency invariant
Every mutating API accepting Idempotency-Key must atomically claim the key against the request hash before side effects. Same key plus different hash is rejected. Completed retries return the stored response. Concurrent retries cannot create a second side effect.

## Security boundary
Operator authentication is distinct from registrar identity. EPP commands carry authenticated registrar context. Customer authentication must be scoped to the customer/order before public launch. Secrets are never stored in source. State changes are auditable.

## Authority boundary
IZAKHONO Registry software does not itself create public TLD authority. Public .co.za registration requires an authorized external registry path; an IZAKHONO-controlled future gTLD requires the applicable delegation process.

## Release gate
No paid public registration is exposed until a real transaction is verified end-to-end:
Customer -> Registrar/API -> IZAKHONO Registry -> Authoritative Registry -> confirmation -> DNS -> RDAP -> handover.

## Design rule
Prefer one canonical state machine and one application workflow. Adapters translate infrastructure; they do not own business truth.
