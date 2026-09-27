# IZAKHONO SUPER APP

The owner-controlled portfolio shell for IZAKHONO.

## Creator Engine integration

The SUPER APP now includes **IZAKHONO Creator Engine** at `/creator` as a single user-facing creator workspace. It is an orchestration surface, not a new dependency that replaces the independent engines underneath it.

One brief can be mapped across:

- ideas, planning, writing and research through IZAKHONO SUPER AI;
- design and image production through IZAKHONO CREATE;
- short-form video through IZAKHONO SHORTS FACTORY;
- audio/voice through the SUPER AI media adapter contract when a backend is configured;
- approvals and execution routing through IZAKHONO FLOW;
- channel handoff through IZAKHONO SOCIAL and IZAKHONO ADS;
- approved affiliate monetisation through IZAKHONO Affiliate;
- trust checks through FORTRESS.

The canonical contract is `creator-engine.v1.json`. The browser can build a deterministic workflow preview without claiming that media was generated, published or paid for. Actual generation and distribution remain gated by the health, credentials and approval state of the relevant independent engine.

## Affiliate integration

IZAKHONO Affiliate is a first-class module at `/affiliate`. It is embedded into the SUPER APP experience while retaining its own independent engine and canonical contract.

The SUPER APP surfaces:

- IZAKHONO BUILDER AI for one-sentence app, website, game and software creation;
- publisher affiliate income;
- the IZAKHONO partner/affiliate network;
- external affiliate-network adapter status;
- autonomous safe-work capabilities;
- protected owner gates;
- CREATE, ADS, CRM, IZAKHONO FLOW, SUPER ACCOUNTANT, FORTRESS, FLOWIQ and TASKS handoffs.

## FLOW integration

IZAKHONO FLOW is a first-class module at `/flow`. It is distinct from FLOWIQ:

- **IZAKHONO FLOW** coordinates the commercial operating chain: Lead -> Qualify -> Quote -> Pay -> Fulfil -> Invoice -> Support -> Retain -> Report.
- **FLOWIQ** handles approvals, exceptions and operational decision routing.

FLOW remains an independently deployable engine. The SUPER APP surfaces its contract and status; it does not absorb FLOW's runtime or payment authority.

The Worker exposes `GET /api/flow/status` for the module contract. This endpoint does not claim NODE01 or public-live status.

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
- `GET /api/creator/status`
- `GET /api/affiliate/status`
- `GET /api/flow/status`

Deployment must follow the portfolio infrastructure directive and must not be described as live until HTTPS and end-to-end acceptance checks pass.


## Production resilience route

The externally reversible production route is:

`https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-one-hub/super-app`

The route was independently checked from the Supabase network and returned HTTPS 200 on 27 September 2026. It is classified as **external resilience**, not the owned-primary route. NODE 01 remains the owned authority and must pass its own public acceptance gate before traffic is called owned-primary.

## Weekly revenue target

The SUPER APP now carries a R20,000/week verified-revenue target cockpit. This is an operating goal, not a revenue guarantee. Only signature-valid verified payment receipts count. The initial direct-checkout mix is 25 RE1 + RE5 bundles at R549 plus 21 RE5 purchases at R299, a planned R20,004/week.

A daily 08:00 SAST database watch updates the R20k sprint task using verified receipts only. Paid-media spend and other high-impact financial actions remain owner-gated.

## Current Creator Engine launch truth

**Integration installed; public-live remains gated.** The SUPER APP surface and orchestration contract are present in source. This does not prove a public HTTPS route, reachable media renderer, authenticated publishing channels or paid-media authorisation. Those states must be verified independently before they are called live.
