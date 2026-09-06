# IZAKHONO AUTONOMY STACK

Goal: make IZAKHONO increasingly owner-controlled while keeping safe fallbacks and avoiding false claims of independence before each layer is proven on owner infrastructure.

## Core autonomy layers

| Layer | Product | Current role |
| --- | --- | --- |
| Source control & developer platform | IZAKHONO CODE | Repositories, editor, issues, PRs, CI/CD |
| Build & application generation | IZAKHONO BUILDER | Product generation and deployment orchestration |
| Runtime host | IZAKHONO NODE | Owner-controlled execution target |
| Control plane | IZAKHONO CONTROL | Owner operations and node control |
| Core platform services | IZAKHONO CORE | Shared platform primitives |
| AI workspace | IZAKHONO WORK | Owner-controlled local AI |
| Payments | IZAKHONO PAY | Non-custodial payment orchestration |
| Subscription access | IZAKHONO ACCESS | Paid entitlements and subscriber access |
| Security | SHELTON FORTRESS | Security policy, events and protective controls |
| Product applications | FAISReady and other IZAKHONO platforms | Revenue-generating user services |

## Missing autonomy layers to build next

1. **IZAKHONO ID** — accounts, login, MFA, device trust, service identities.
2. **IZAKHONO DATA** — owner database/storage layer with replication, backups and object storage.
3. **IZAKHONO EDGE** — TLS, routing, domains, reverse proxy, rate limiting and WAF controls.
4. **IZAKHONO OBSERVE** — logs, metrics, uptime, traces, alerts and audit evidence.
5. **IZAKHONO MAIL** — transactional email abstraction with provider fallback and later owner-hosted delivery.
6. **IZAKHONO VAULT** — secrets, key rotation and encrypted configuration.
7. **IZAKHONO QUEUE** — background jobs, retries, scheduled work and event delivery.
8. **IZAKHONO BACKUP** — encrypted, tested restore workflows across owner nodes.
9. **IZAKHONO DESK** — customer support, tickets, CRM-lite and subscriber service.
10. **IZAKHONO ANALYTICS** — product, revenue, funnel and cohort reporting.
11. **IZAKHONO MEDIA** — controlled media storage, streaming and delivery for KORA/ALLEGRO.
12. **IZAKHONO AI GATEWAY** — model routing across owner-hosted models and optional external providers without locking products to one vendor.

## Design rule

Every commercial IZAKHONO product should depend on shared platform contracts rather than hard-code an outside provider.

Examples:

- payment -> IZAKHONO PAY
- subscription access -> IZAKHONO ACCESS
- login -> IZAKHONO ID
- AI -> IZAKHONO AI GATEWAY
- storage -> IZAKHONO DATA
- secrets -> IZAKHONO VAULT
- deployment -> IZAKHONO NODE / CONTROL
- observability -> IZAKHONO OBSERVE

This makes providers replaceable one layer at a time.

## Subscriber promise

Where a plan is sold as unlimited, the platform must mean:

> no artificial message/session credit meter while the subscription is active.

It must not mean infinite hardware capacity. Fair-use, abuse prevention, safety, legal restrictions, and real compute/storage/network limits still apply.

## Build sequence

Revenue-first sequence:

1. IZAKHONO ACCESS + FAISReady subscription entitlement
2. IZAKHONO ID
3. IZAKHONO DATA
4. IZAKHONO EDGE
5. IZAKHONO OBSERVE
6. IZAKHONO VAULT
7. IZAKHONO AI GATEWAY
8. IZAKHONO QUEUE + BACKUP
9. IZAKHONO DESK + ANALYTICS
10. media-scale layers

Each layer is only called operational after CI proof plus a real owner-node validation.
