# IZAKHONO REGISTRY CORE

Zero-cost-first registry-grade core for IZAKHONO DOMAIN.

This package is TLD-agnostic. It can run a private/test namespace today and later connect to authoritative registry infrastructure through adapters. It does not claim public root-zone delegation or .co.za production authority.

## Core objects

- domain
- contact
- host
- registrar
- lifecycle state
- audit event
- idempotency record

## Control-plane capabilities

- Domain normalization and lifecycle transitions.
- Persistent D1 storage.
- Registrar persistence and active/suspended enforcement.
- Authenticated registrar creation.
- Authenticated domain creation with idempotency protection.
- Authenticated lifecycle transitions.
- EPP and RDAP protocol foundations.
- DNS provider abstraction.
- External registry adapter abstraction.

## Authority boundary

A self-built registry does not automatically become a public TLD authority. Public .co.za service requires the applicable authoritative registry/registrar relationship and successful end-to-end transaction verification. A future IZAKHONO-controlled gTLD would additionally require the applicable ICANN/IANA process and root-zone delegation.

## Release gate

NO VERIFIED CAPABILITY → NO CUSTOMER PROMISE → NO SALE.

Do not advertise or sell public domain registration until authoritative registration, DNS provisioning, RDAP verification and customer handover have all been tested successfully.
