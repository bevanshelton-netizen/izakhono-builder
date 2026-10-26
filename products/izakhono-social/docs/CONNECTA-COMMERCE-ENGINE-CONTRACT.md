# CONNECTA Commerce Engine Contract

## Purpose

CONNECTA Benefits, Commerce and Vehicles share one verification-first commercial discovery layer. The engine turns verified opportunities into discoverable offers, listings and enquiries without treating submitted data as active truth.

## Lifecycle

`DRAFT -> SUBMITTED -> VERIFICATION_PENDING -> VERIFIED -> ACTIVE -> PAUSED -> EXPIRED -> CLOSED`

A record may also enter `REVIEW_REQUIRED` or `REJECTED` from verification or safety review.

## Partner

Required concepts:

- `partner_id`
- legal/trading name
- category
- authorised contact
- KYB/identity verification state
- agreement state and dates
- territory
- campaign state
- lead destination
- terms and disclosures

**Partner claim rule:** no company is presented as an official CONNECTA partner until a signed/verified agreement exists.

## Benefits / Offers

An offer contains:

- `offer_id`
- `partner_id`
- category/subcategory
- title and description
- benefit/value
- eligibility
- start/end dates
- territory
- inventory/availability statement
- redemption method
- terms reference
- verification state
- sponsored/exclusive labels where applicable
- attribution campaign

CONNECTA must distinguish:

- submitted offer
- verified offer
- active offer
- expired offer
- exclusive CONNECTA offer

A promotion is not published as verified until its material terms have been checked.

## Vehicles

Vehicle listings use structured fields:

- make
- model
- year
- price/currency
- mileage
- transmission
- fuel
- body type
- condition
- stock/reference ID
- seller identity
- location
- availability
- verification state

Supported discovery surfaces include new, used, imports, commercial vehicles, motorcycles, parts/services and other lawful vehicle categories.

## Enquiries and Attribution

Each qualified enquiry receives:

- `enquiry_id`
- listing/offer ID
- partner ID
- campaign ID where applicable
- consent state
- timestamp
- destination
- attribution metadata
- outcome state

Outcome lifecycle:

`NEW -> ROUTED -> CONTACTED -> QUALIFIED -> CONVERTED | LOST | WITHDRAWN`

A conversion must not be claimed merely because an enquiry was created. Sales outcomes require partner-confirmed evidence.

## Revenue

Permitted commercial models include:

- qualified lead fees
- referral/commission agreements
- campaign packages
- sponsored placement with clear labelling
- partner storefront subscriptions
- catalogue/inventory services
- API/integration services
- analytics and reporting
- commerce enablement

Commercial monetisation must not paywall ordinary CONNECTA speech or basic participation.

## Verification Standard

The engine inherits CONNECTA's global verification rule:

> No badge without evidence. No partner claim without agreement. No promotion without verified terms. No inventory claim without current source evidence. No sale claim without attributable outcome evidence.

Submitted content remains visibly unverified until the relevant gate passes.

## Benefits Hub Principle

The Benefits Hub is designed as a habitual value destination:

- What can I get today?
- What can I save today?
- What is genuinely free today?
- What exclusive benefit is available?
- What opportunity might I otherwise miss?

Benefits may include coupons, flights, travel, vehicles, shopping, education, jobs, events, competitions, giveaways, community benefits and other verified opportunities.

## Safety

The engine must support reporting, seller/partner identity, fraud review, prohibited-category controls, inaccurate-price reporting, expired-offer handling and audit trails.

No fictional inventory, price, discount, prize, partner, beneficiary or outcome may be represented as real.

## Implementation State

This contract is a software architecture specification. It does not by itself activate external partners, inventory feeds, payment settlement, offers, agreements or public commerce routes.
