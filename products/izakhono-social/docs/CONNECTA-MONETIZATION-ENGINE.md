# CONNECTA — Monetization Engine

## Objective

Turn CONNECTA into a durable revenue platform without compromising its core promise:

**People. Communities. Connected.**

The commercial model is intentionally diversified. CONNECTA should not depend on invasive behavioural advertising or force ordinary users to pay for basic reach.

## Revenue stack

| Layer | Customer | Initial price / model | Priority |
|---|---|---:|---|
| Free | Everyone | R0 | Launch |
| CONNECTA Plus | Consumers | R49/month | Phase 1 |
| CONNECTA Pro | Power users / creators | R149/month | Phase 1 |
| CONNECTA Business | SMEs / organisations | R399/month | Phase 1 |
| Creator memberships | Fans → creators | Creator sets price | Phase 2 |
| Tips | Fans → creators | User-selected | Phase 2 |
| Events | Organisers | Transaction/service fee | Phase 2 |
| Commerce | Sellers | Transaction/service fee | Phase 2 |
| Sponsorships | Advertisers | Contextual, transparent | Phase 3 |
| Enterprise/API | Institutions | Contract | Phase 3 |

Prices are launch hypotheses, not final regulated or contractual offers. They can be changed without changing the data model.

## 1. Consumer subscriptions

### CONNECTA Free

The free tier remains genuinely useful:

- public profile
- feed modes
- posting and replies
- communities
- messaging subject to safety controls
- bookmarks
- public search
- invitations

### CONNECTA Plus — R49/month

Potential entitlements:

- enhanced profile customisation
- larger media limits
- premium profile presentation
- additional personal organisation tools
- expanded storage allowance

### CONNECTA Pro — R149/month

Potential entitlements:

- creator analytics based on aggregate product metrics
- advanced publishing tools
- creator membership controls
- expanded media limits
- advanced community tools
- AI-assisted creation when the CONNECTA AI layer is available

No paid plan should buy hidden feed manipulation or suppress competitors.

## 2. CONNECTA Business — R399/month

Business customers are a major monetization wedge.

Potential entitlements:

- verified business profile path
- business/community administration
- customer messaging tools
- service/product catalogue
- public business landing page
- announcements
- event tools
- aggregate business analytics
- lead/contact tools
- future CONNECTA commerce integrations

Verification remains evidence-based. Payment for a plan does not itself create a verified badge.

## 3. Creator economy

Creators and community organisers can create paid memberships.

Example:

`1,000 members × R50/month = R50,000 gross monthly creator revenue.`

CONNECTA earns a transparent platform fee; the creator receives the remaining eligible amount after payment-provider charges, refunds and applicable taxes/adjustments.

Creators can also receive voluntary tips and, later, sell digital or physical products and event tickets.

## 4. Commerce

CONNECTA should evolve from conversation into commerce:

`Discover → View seller → Message → Purchase → Receipt → Follow seller`

Revenue opportunities:

- transaction/service fee
- business subscription
- promoted catalogue placement
- event/service transactions

CONNECTA must remain payment-provider agnostic. Provider credentials and payment secrets stay outside the CONNECTA database.

## 5. Contextual sponsorships

Advertising is a later-stage revenue layer, not the foundation.

Permitted model:

- contextual placement
- declared sponsorship
- community/category relevance
- aggregate reporting
- user controls

Prohibited commercial architecture:

- cross-site tracking
- advertising IDs
- hidden shadow profiles
- psychological targeting
- selling personal data
- using private messages, bookmarks or safety data for ad targeting
- manipulating organic reach to force payment

## 6. Enterprise/API

Long-term enterprise products can expose approved CONNECTA capabilities through authenticated APIs:

- identity/authentication
- communities
- messaging
- publishing
- moderation workflows
- event distribution
- aggregate analytics
- integrations

Enterprise contracts can provide higher-value recurring revenue without requiring mass consumer monetization first.

## Commercial ledger principles

The monetization migration introduces provider-agnostic records for:

- plans
- subscriptions
- creator memberships
- payment transactions
- creator payouts
- commerce offers
- entitlements

The ledger is deliberately separate from the social graph. Payment records are not a source of behavioural ranking.

The first migration seeds three launch hypotheses:

- `consumer_plus` — R49/month
- `consumer_pro` — R149/month
- `business` — R399/month

No real charge is captured by this migration. Payment execution requires an approved payment partner, webhook verification, idempotency, refunds, reconciliation, applicable tax handling and appropriate compliance review.

## Unit economics targets

Track aggregate commercial health:

- monthly recurring revenue (MRR)
- annual recurring revenue (ARR)
- paid conversion rate
- average revenue per paying account
- creator gross merchandise value
- CONNECTA platform revenue
- payment-provider cost
- refunds/chargebacks
- net revenue
- business account retention
- infrastructure cost per active account

Do not calculate these using covert engagement profiles.

## Launch sequence

### Gate A — Revenue-ready architecture

- database migration applied
- entitlements model tested
- payment provider adapter interface defined
- webhook signature verification defined
- idempotency and refund states tested

### Gate B — First paid products

Launch only after the public CONNECTA route is independently verified:

1. Plus
2. Pro
3. Business

### Gate C — Creator economy

Then add:

1. creator memberships
2. tips
3. creator payouts
4. events

### Gate D — Commerce

Then add seller offers, checkout integration and transaction reporting.

### Gate E — Contextual sponsorships / enterprise

Only after CONNECTA has meaningful community density and strong safety operations.

## Revenue north star

The long-term goal is not simply to monetize attention.

It is to monetize **value created between people, creators, communities and businesses**.

That gives CONNECTA a healthier economic flywheel:

**People join → communities form → creators and businesses participate → value is exchanged → CONNECTA earns a transparent fee → better infrastructure and tools → stronger communities.**
