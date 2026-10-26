# CONNECTA Discovery UX Contract

## Purpose
Define the shared user-facing discovery behaviour for Benefits, Commerce and Vehicles without inventing live inventory, partners, prices, offers or sales.

## Discovery card
Every surfaced item may contain:
- title
- category/subcategory
- image/media reference when available
- location
- price/benefit when verified
- verification state
- partner state
- expiry date when applicable
- source/attribution reference
- primary action
- report action

Missing evidence must be rendered as unavailable, not inferred.

## Filters
Shared filters:
- category
- location
- verified status
- availability
- date/expiry
- price range where applicable

Vehicles additionally support make, model, year, mileage, fuel, transmission, body type and condition.

Benefits additionally support benefit type, free-only, exclusive-to-CONNECTA and expiry.

Commerce additionally supports business type, service area, verified business and official partner.

## Enquiry flow
1. User selects an eligible listing.
2. CONNECTA displays the verified information available.
3. User submits an enquiry with consent-aware contact details.
4. CONNECTA creates a unique enquiry ID.
5. The enquiry is routed only to an approved destination.
6. Partner/business outcome may later be recorded as qualified, converted, declined, cancelled or unknown.

An enquiry is never represented as a sale.

## Attribution
Attribution records:
- discovery surface
- listing/offer ID
- campaign ID when applicable
- enquiry ID
- partner/business ID
- timestamps
- consent state
- conversion outcome when evidenced

## Trust rules
- Submitted is not Verified.
- Verified Business is not Official Partner.
- Sponsored is visibly labelled.
- Exclusive CONNECTA Offer requires verified terms.
- Sale/impact claims require evidence.
- No fabricated inventory, prices, discounts, partners, beneficiaries or outcomes.

## Freedom and access
Commercial discovery must not paywall ordinary CONNECTA expression. Users may participate in the social network without purchasing a commercial subscription.

## Implementation status
SOFTWARE PACKAGED. Public route remains NOT_YET_VERIFIED until the physical NODE/EDGE/TLS verification gates pass.