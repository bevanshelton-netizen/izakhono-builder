# IZAKHONO SUPER APP

The owner-controlled portfolio shell for IZAKHONO.

## Affiliate integration

IZAKHONO Affiliate is a first-class module at `/affiliate`. It is embedded into the SUPER APP experience while retaining its own independent engine and canonical contract.

The SUPER APP surfaces:

- publisher affiliate income;
- the IZAKHONO partner/affiliate network;
- external affiliate-network adapter status;
- autonomous safe-work capabilities;
- protected owner gates;
- CREATE, ADS, CRM, SUPER ACCOUNTANT, FORTRESS, FLOWIQ and TASKS handoffs.

## Architecture rules

- **Owned first, externally reversible.**
- Every platform keeps an independently deployable engine.
- The SUPER APP is an operating surface, not a dependency that other products require to run.
- External affiliate networks remain replaceable adapters.
- No behavioural tracking, advertising IDs or silent analytics.
- Credentials remain server-side.
- Code presence does not equal public-live status.

## Local / Worker deployment

The product includes its own Worker entry point in `src/index.ts` and static assets in `public/`. The Worker exposes:

- `GET /api/health`
- `GET /api/modules`
- `GET /api/affiliate/status`

Deployment must follow the portfolio infrastructure directive and must not be described as live until HTTPS and end-to-end acceptance checks pass.
