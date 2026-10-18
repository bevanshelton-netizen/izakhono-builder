# IZAKHONO HOST v0.2

IZAKHONO HOST is the owned-first customer hosting control plane for domains, websites, SSL, DNS, email and billing.

## v0.2 scope

- customer onboarding
- domain inventory
- site inventory
- service plans
- typed provisioning jobs
- DNS record plans
- native IZAKHONO site runtime
- SSL acceptance gates
- business mailbox inventory
- invoices and payment status
- audit events
- operator dashboard
- replaceable provider adapters
- owned runtime infrastructure stack

## Infrastructure rule

**Owned-first, externally reversible.**

IZAKHONO owns the customer state and the preferred runtime. Provider integrations are adapters only. Provider credentials never belong in browser code.

The production target is the native IZAKHONO runtime, edge and data stack. External providers may be used for registrar/DNS capacity or other bounded dependencies, but no external web-hosting platform is required for the core system.

## Native runtime

`runtime/control-plane` is the first containerized IZAKHONO runtime control plane. It provisions tenant site records, tracks acceptance evidence and exposes a health endpoint.

`docker-compose.owned.yml` supplies the owned-runtime baseline: native runtime, Caddy edge, CoreDNS, PostgreSQL, MinIO and Valkey.

## Security

No customer can execute arbitrary infrastructure commands from the browser. Provisioning is represented as typed jobs and provider adapters. Production secrets are server-side only.

## Status vocabulary

- `planned`
- `queued`
- `running`
- `verified`
- `failed`
- `paused`

A service is not marked live without verification evidence.
