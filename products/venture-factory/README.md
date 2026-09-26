# IZAKHONO Venture Factory

Independently deployable engine for the IZAKHONO AI Business Factory.

## Purpose

Turn a business idea into a structured product, revenue, build, validation and go-to-market plan. The engine uses IZAKHONO SUPER AI when configured and falls back safely to deterministic planning when the AI route is unavailable.

## Architecture

- own Node runtime and health endpoint
- own persistent plan store
- own static interface
- SUPER AI is a replaceable internal capability dependency, not a browser-side vendor SDK
- no behavioural tracking or advertising IDs
- no autonomous advertising spend, payment or external account mutation
- owned-first deployment through IZAKHONO CONTROL -> NODE
- reversible external hosting may be added separately

## Endpoints

- `GET /healthz`
- `POST /api/plan`
- `GET /api/plans`

Planning is owner-key protected by default. Set `VENTURE_FACTORY_PUBLIC_PLANNING=true` only after abuse controls and commercial access policy are ready.

## Promotion rule

A plan is not a live business. Promotion into IZAKHONO Builder and public deployment remain separate gates with their own validation receipts.

## Live rule

Do not call this service public-live until the owned route returns HTTPS 200 and the verified Venture Factory experience. An external resilience route does not replace the owned engine.


## Builder promotion bridge

The standalone engine can promote an owner-approved saved plan into IZAKHONO Builder.

Required runtime settings:

- `IZAKHONO_BUILDER_URL`
- `IZAKHONO_BUILDER_ADMIN_KEY`

Owner-only endpoints:

- `POST /api/plans/:id/build`
- `GET /api/builds`

The build action creates the Builder project and runs its plan, generate and validation sequence. It persists a local build receipt and remains fail-closed: `public_live` stays `false` until the normal deployment verification gates pass.

Enabling `VENTURE_FACTORY_PUBLIC_PLANNING=true` only opens plan creation. It does **not** expose saved plans, Builder promotion, build receipts or any owner action.


## Commercial customer access

Venture Factory now has an optional fail-closed customer mode that uses existing IZAKHONO identity, entitlement and payment infrastructure instead of inventing a separate account system.

When `VENTURE_FACTORY_CUSTOMER_MODE=true`:

- the browser/client presents an IZAKHONO ID bearer session;
- Venture Factory introspects that session server-side through IZAKHONO ID;
- Venture Factory checks the `venture-factory` entitlement through IZAKHONO ACCESS;
- active subscribers can create plans without a separate message-credit counter;
- inactive subscribers receive HTTP 402 with `checkout_available` when IZAKHONO PAY is configured;
- `POST /api/customer/checkout` creates a pending IZAKHONO PAY intent with ACCESS metadata;
- access does not unlock until PAY confirms payment and ACCESS grants the entitlement;
- Builder promotion and saved-plan/build-list routes remain owner-only.

Customer endpoints:

- `GET /api/customer/session`
- `POST /api/customer/checkout`

Required commercial runtime settings:

- `IZAKHONO_ID_URL`
- `IZAKHONO_ID_INTERNAL_KEY`
- `IZAKHONO_ACCESS_URL`
- `IZAKHONO_ACCESS_INTERNAL_KEY`
- `IZAKHONO_PAY_URL`
- `IZAKHONO_PAY_API_KEY`
- `VENTURE_FACTORY_PRICE_MINOR`
- `VENTURE_FACTORY_PUBLIC_ORIGIN`

Optional plan controls:

- `VENTURE_FACTORY_ACCESS_PLAN` (default `monthly`)
- `VENTURE_FACTORY_ACCESS_PERIOD_DAYS` (default `30`)
- `VENTURE_FACTORY_ACCESS_ENTITY_ID` (default `izakhono-africa`)

No commercial price is hard-coded into source. Customer mode remains disabled by default and the NODE01 launcher refuses to enable it unless the identity, entitlement, payment and price configuration is complete.

### Production gate

IZAKHONO ID's current repository state is still an alpha identity boundary. Do not expose paid customer login broadly until MFA, account recovery, email verification, brute-force protection, audit/security controls and the rest of its documented production gates are completed. The customer-mode integration is built now so Venture Factory can plug into the hardened ID/ACCESS/PAY stack without redesigning its product engine later.


## Customer MFA login

Venture Factory supports IZAKHONO ID's TOTP MFA challenge flow without storing identity passwords or TOTP secrets itself.

Customer login is two-stage when MFA is enabled:

1. `POST /api/customer/login` forwards the password login to IZAKHONO ID.
2. If ID returns `mfa_required`, Venture Factory returns the short-lived challenge without issuing a local session.
3. `POST /api/customer/login/mfa` forwards either the authenticator code or one-time recovery code to IZAKHONO ID.
4. Only after ID verifies the second factor is the bearer session returned and usable for ACCESS/PAY/plan creation.

The browser stores only the bearer session in session storage. MFA challenges are held in memory and cleared on completion/logout. Builder promotion remains owner-only.
