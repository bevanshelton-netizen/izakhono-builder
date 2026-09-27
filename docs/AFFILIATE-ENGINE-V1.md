# IZAKHONO AFFILIATE Engine v1

IZAKHONO AFFILIATE is the portfolio-wide affiliate and referral layer for the IZAKHONO SUPER APP.

## Purpose

It operates in two directions:

1. **Publisher mode** — IZAKHONO can earn commission from approved third-party offers.
2. **IZAKHONO Network mode** — approved partners, creators and publishers can earn commission on qualifying IZAKHONO sales.

The engine is owned-first. External affiliate networks are adapters and must never become the system of record.

## Portfolio flow

```
Approved offer / IZAKHONO product
        |
        v
IZAKHONO AFFILIATE
  - offer normalisation
  - eligibility rules
  - SubID / link generation
  - attribution ledger
  - partner ledger
        |
        +--> IZAKHONO CREATE  -> approved creative
        +--> IZAKHONO ADS     -> approved distribution
        +--> CRM              -> partners / leads / opportunities
        +--> FORTRESS         -> fraud / bot / abuse checks
        +--> SUPER ACCOUNTANT -> verified commission and payout events
        +--> FLOWIQ           -> exception and approval workflows
```

## Autonomous operations

The engine may automatically discover public programme changes, ingest approved feeds, rank offer relevance, create tracked links, reconcile conversion events, detect suspicious patterns, pause broken adapters and report exceptions.

It must not silently accept third-party legal terms, provide banking or tax identity data, commit paid advertising spend, or materially change commission economics. Those actions remain gated to the owner or an authorised officer.

## Privacy and tracking

Use first-party attribution and network-required transaction references only. Behavioural profiling and advertising IDs are disabled. Affiliate disclosures and consent requirements must be surfaced wherever legally or contractually required.

## External adapters

The initial adapter registry covers Awin, CJ, impact.com, Rakuten Advertising, FlexOffers, ClickBank, eBay Partner Network, Tradedoubler, Partnerize and 2Checkout / Verifone. Each adapter remains disabled until an account exists, credentials are stored server-side, and an authenticated test succeeds.

## Internal affiliate programme

Commission rates are product-specific and are not hard-coded globally. A product can enter the IZAKHONO affiliate catalogue only when its public HTTPS route, qualifying transaction path, refund/reversal logic, commission rule and accounting mapping are verified.

## Payout safety

A payout event requires:

- a verified qualifying conversion;
- expiry of the applicable reversal/refund window;
- FORTRESS fraud clearance;
- accounting reconciliation; and
- any product-specific compliance checks.

## Launch status

Code presence is not a live claim. A network adapter is considered live only after a successful authenticated test. A public affiliate surface is considered live only after verified HTTPS and end-to-end attribution evidence.
