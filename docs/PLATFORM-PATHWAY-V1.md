# IZAKHONO Platform Pathway v1

## Purpose

Use one repeatable delivery pathway for every IZAKHONO platform. A platform is a configured product profile, not a bespoke infrastructure project.

## Golden pathway

`brief → profile → modules → build → validate → internal snapshot → release candidate → owned-runtime deployment → HTTPS/DNS → service integration → end-to-end acceptance → verified handover`

External providers are adapters. They must remain replaceable and must never become the authoritative source of platform state.

## Mandatory baseline

Every platform receives:

- a versioned IZAKHONO manifest;
- a product slug and owner/trading identity;
- health endpoint and deployment health gate;
- authentication boundary where required;
- structured configuration for data, payments and external services;
- audit/release evidence;
- rollback evidence before production-live status;
- an internal source snapshot under IZAKHONO control;
- a public route only after actual verification.

## Configurable modules

Platforms select only what they need from the reusable registry:

- `auth`
- `payments`
- `webhooks`
- `crm`
- `whatsapp`
- `email`
- `forms`
- `commerce`
- `subscriptions`
- `lms`
- `media`
- `music`
- `creator`
- `listener`
- `fleet`
- `navigation`
- `security`
- `analytics`
- `admin`

## Payment rule

Use the approved IZAKHONO payment adapter for the platform. For South African platform flows, iKhokha remains the preferred payment path where already established. Payment confirmation must be server-verified before entitlement or fulfilment.

## Infrastructure rule

**Owned-first, externally reversible.**

Preferred route:

`IZAKHONO CODE / Forge → IZAKHONO runtime → IZAKHONO DNS/HTTPS → public service`

External route:

`IZAKHONO source → verified provider adapter → public service`

A provider deployment is never treated as the source of truth. Vercel/Cloudflare and similar services are capacity adapters and fallbacks unless an explicit platform policy says otherwise.

## Release gates

1. Source validation passes.
2. Build succeeds.
3. Internal source snapshot is committed.
4. Release candidate receipt exists.
5. Deployment succeeds.
6. Health endpoint passes.
7. Public route responds.
8. Critical business workflow passes.
9. Payment/webhook flow passes where enabled.
10. Rollback evidence exists.
11. Only then may status become `public_live: true`.

## Failure handling

A failure in DNS, provider quota, email, payment configuration or another adapter must not trigger an application rebuild. Isolate the failing adapter, keep the validated release candidate, switch to an approved fallback where possible, and continue verification.

## Platform profiles

The following products are intended to use this standard with minor profile-specific adjustments:

- FAISReady — learning/compliance + iKhokha
- Allegro Vibez — music/creator/listener + iKhokha/webhooks
- Edu-Build — LMS/student/admin + payments
- KORA — media/streaming + audience modules
- IZAKHONO Work — business operations/CRM
- IZAKHONO NAV — navigation/safety/fleet
- FORTRESS — security/identity/monitoring

## Operational principle

**Build the pathway once. Configure it many times.**

A platform is considered delivered only when the actual customer journey has been verified, not merely when code has been built or a provider deployment reports success.
