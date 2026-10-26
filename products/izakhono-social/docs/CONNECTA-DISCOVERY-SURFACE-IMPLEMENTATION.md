# CONNECTA Discovery Surface Implementation

## Purpose
Define the first usable discovery surfaces for Benefits, Commerce and Vehicles while preserving CONNECTA's verification standard.

## Shared surface contract

Each surface must provide:

1. A clear purpose and search/filter entry point.
2. Structured discovery cards.
3. Trust status visible before a user acts.
4. A real enquiry/claim CTA only when the underlying flow is available.
5. Partner attribution without implying a partnership that has not been verified.
6. Outcome states that distinguish enquiry, pending, settled and evidenced outcomes.
7. Report/fraud controls for commercial and benefit listings.

## Benefits

Primary questions:
- What can I get today?
- What can I save today?
- What is genuinely free?
- What competition can I enter?

Card types:
- Coupon
- Exclusive offer
- Flight/travel deal
- Competition
- Giveaway
- Free product/service
- Education/job opportunity
- Community benefit

Required fields:
`id`, `title`, `category`, `benefit`, `provider`, `trust_status`, `starts_at`, `ends_at`, `terms_url`, `claim_mode`, `attribution_id`.

No offer is promoted as active without verified terms and dates.

## Commerce

Commerce discovery supports:
- verified businesses
- products and services
- catalogues
- partner storefronts
- enquiries
- tracked campaigns

Required fields:
`id`, `business_id`, `title`, `category`, `description`, `price_display`, `availability`, `trust_status`, `cta_mode`, `enquiry_id`, `campaign_id`.

A listing may generate an enquiry without claiming that a sale occurred. A conversion is only recorded after the required evidence/settlement gate passes.

## Vehicles

Vehicles is a first-class commercial category.

Required structured fields:
`id`, `seller_id`, `make`, `model`, `year`, `price`, `currency`, `mileage`, `transmission`, `fuel`, `body`, `condition`, `stock_reference`, `location`, `trust_status`, `enquiry_id`, `campaign_id`.

Filters:
- make/model
- new/used/import/commercial/motorcycle/parts/service
- price range
- year
- mileage
- transmission
- fuel
- body type
- location
- verified seller
- official partner

No vehicle inventory is presented as a partner feed until the source and relationship are verified.

## Trust state machine

`SUBMITTED -> VERIFICATION_PENDING -> VERIFIED -> ACTIVE -> ENQUIRY -> OUTCOME_PENDING -> EVIDENCED`

Failure/review states:

`VERIFICATION_PENDING -> REJECTED`
`ACTIVE -> SUSPENDED`
`OUTCOME_PENDING -> DISPUTED`
`EVIDENCED -> REVERSED`

## Commercial integrity

- No partner claim without agreement.
- No promotion without verified terms.
- No inventory claim without source verification.
- No donation claim without settlement.
- No impact claim without evidence.
- No sale claim without evidence.
- Sponsored placement must be labelled.
- Ordinary CONNECTA expression remains free and is not paywalled by these surfaces.

## Implementation sequence

1. Shared discovery data contracts.
2. Reusable card and filter components.
3. Benefits surface.
4. Commerce surface.
5. Vehicles surface.
6. Enquiry creation and attribution.
7. Verification/admin review.
8. End-to-end tests.

Status: SOFTWARE PACKAGED. Public route remains NOT_YET_VERIFIED until the owned runtime and public HTTPS evidence gates pass.
