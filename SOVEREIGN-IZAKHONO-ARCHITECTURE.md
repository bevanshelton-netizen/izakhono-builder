# SOVEREIGN IZAKHONO ARCHITECTURE

## Objective

IZAKHONO must operate without GitHub, Vercel, Netlify, Cloudflare, or any single external SaaS provider being a runtime dependency.

External providers become optional adapters only.

## Replacement stack

| External dependency | IZAKHONO replacement |
|---|---|
| GitHub | IZAKHONO Source + Object Store + Repository Service |
| Vercel / Netlify | IZAKHONO Deploy + Edge + Web Runtime |
| Cloudflare DNS | IZAKHONO DNS + authoritative/secondary DNS adapters |
| Supabase | IZAKHONO Data Plane: PostgreSQL + Object Storage + Auth + Realtime adapters |
| Hostinger / Xneelo | IZAKHONO Hosting Fabric |
| GitHub Actions | IZAKHONO CI/Build Queue |
| Vercel Functions | IZAKHONO Functions/Jobs Runtime |
| External monitoring | IZAKHONO Observability + Audit |

## Ownership rule

The IZAKHONO control plane owns:

1. Source of truth
2. Workspace state
3. Identity and access policy
4. Build definitions
5. Job queue
6. Deployment records
7. Domains and DNS state
8. Certificates and TLS state
9. Customer provisioning state
10. Backups and recovery metadata

## Compute independence

NODE01-SW is the portable computer/control layer. Compute workers may be:

- NODE01 physical workstation
- additional IZAKHONO nodes
- local Docker workers
- private servers
- approved VPS/cloud workers

A compute worker can disappear without destroying the user's workspace or source data.

## Migration rule

No new core IZAKHONO product may require an external provider in order to start, build, test, store state, or recover.

External adapters are permitted only for:

- temporary migration
- redundancy
- geographic edge delivery
- customer-requested integrations
- services not yet economically practical to own

## GitHub status

GitHub is currently being used as a development/migration mirror for the existing codebase. It is **not** the target IZAKHONO runtime or permanent system of record.

## Vercel status

Vercel is a temporary deployment adapter where already useful. New sovereign deployment work must target IZAKHONO DEPLOY and the IZAKHONO Hosting Fabric first.

## Exit condition

The replacement is complete when an IZAKHONO operator can:

PAYMENT → CREATE CUSTOMER → CREATE WORKSPACE → BUILD → TEST → DEPLOY → DNS → TLS → EMAIL → HANDOVER

without requiring GitHub or Vercel.
