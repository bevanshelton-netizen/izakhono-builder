# IZAKHONO Hosting Resilience Matrix v1

## Purpose

Free hosting is an **optional capacity/fallback layer**, never the system of record and never the only production route.

The Website Factory must remain buildable and recoverable when any external provider reaches a quota, changes pricing, suspends a project, or becomes unavailable.

## Routing hierarchy

1. **IZAKHONO-owned runtime** — primary route.
2. **Owned-compatible container/runtime route** — secondary route where available.
3. **Approved external provider** — reversible transition/fallback route.
4. **Free-tier provider** — opportunistic capacity only; never a hard dependency.
5. **Static artifact export** — final recovery option for sites that support it.

A provider is not considered production-live merely because deployment succeeded. Public-live requires independent HTTPS, DNS, application health, and acceptance evidence.

## Capability matrix

| Capability | Primary | Secondary | External adapter | Free-first use |
|---|---|---|---|---|
| Source of truth | IZAKHONO internal repository | Git export/archive | GitHub mirror | Yes |
| Build | IZAKHONO Build Engine | Docker/WSL runner | CI provider | Yes |
| Web runtime | IZAKHONO Node/owned runtime | portable Docker runtime | Cloudflare/Vercel/other adapter | Opportunistic |
| DNS | IZAKHONO control plane | backup DNS plan | Cloudflare/registrar adapter | Yes |
| TLS | owned runtime certificate automation | reverse proxy | provider-managed TLS | Yes |
| Database | portable PostgreSQL-compatible design | local/owned DB | Supabase/managed DB adapter | Yes, with limits |
| Object storage | owned storage | portable S3-compatible | S3-compatible provider | Yes |
| Email | IZAKHONO mail control plane | SMTP relay adapter | transactional mail provider | Yes, subject to deliverability |
| CI/CD | IZAKHONO policy + Git workflows | local runner | GitHub Actions/other CI | Yes |
| Monitoring | IZAKHONO health probes | local logs | provider monitoring | Yes |
| Forms | IZAKHONO form endpoint | static form handoff | external form adapter | Yes |
| Feature flags | IZAKHONO config | local config | external flag service | Yes |
| Search | portable search interface | local index | external search API | Yes |
| AI/ML | provider-neutral IZAKHONO adapter | local/open model | external AI API | Yes |
| Backups | owned immutable snapshots | offline export | cloud backup adapter | Yes |

## Hard rules

- No customer site may depend on one free-tier provider for source, database, deployment and DNS simultaneously.
- Generated source must remain recoverable without the deployment provider.
- Provider credentials stay server-side and are never generated into customer source.
- Every provider integration is an adapter with a documented replacement route.
- Quotas must be observable before they become an outage.
- Migration must use the same generated artifact; do not rebuild the customer site merely to change hosts.
- Free-tier limits are treated as capacity constraints, not failures of the Website Factory.
- Never label a route "live" without evidence.

## Website Factory flow

Customer payment
→ project creation
→ content/configuration
→ deterministic build
→ validation
→ immutable internal snapshot
→ deployment candidate
→ primary owned runtime
→ HTTPS/DNS acceptance
→ customer live site

If the primary route fails:

deployment candidate
→ alternate compatible runtime
→ HTTPS/DNS acceptance
→ customer live site

The customer project, source, configuration and deployment receipt remain provider-neutral.

## Provider admission test

A new external service may be admitted only if:

- it has a clear free/open-source or commercial operating model;
- its terms permit the intended use;
- credentials can be rotated;
- data can be exported;
- the application can run without it where practical;
- a replacement route is documented;
- its quota and failure modes are known;
- it does not become the sole source of truth.

## Current implementation alignment

IZAKHONO BUILDER already keeps validated generated source in its internal repository model and treats GitHub as an optional mirror/export target. IZAKHONO HOST provides the control-plane model for customer onboarding, domains, DNS, SSL, mailboxes, subscriptions, invoices and provisioning jobs.

This matrix adds the explicit hosting-resilience policy around those existing foundations.
