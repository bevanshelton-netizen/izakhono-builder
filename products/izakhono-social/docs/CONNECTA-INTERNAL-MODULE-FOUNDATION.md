# CONNECTA Internal Module Foundation

## Purpose

Turn the CONNECTA ecosystem's internal worlds into real product modules without weakening the platform's verification standard.

## Module sequence

1. CONNECTA Giving — verified fundraising and Good Samaritan support.
2. Adopt-a-Spot — verified NPO/NGO/community adoption.
3. CONNECTA Benefits — verified deals, coupons, competitions, giveaways and opportunities.
4. CONNECTA Commerce — verified businesses, products, services and enquiries.
5. Vehicles — structured vehicle discovery, verified sellers and partner inventory.

## Shared module contract

Every module must expose:

- stable module ID and category
- owner/operator
- lifecycle state
- verification state
- source/evidence metadata
- user-facing terms where applicable
- report/fraud controls
- attribution where commercial activity exists
- audit trail for important state changes
- fallback behavior when a provider or partner is unavailable

## Truth states

`PLANNED` → `CONFIGURED` → `VERIFICATION_PENDING` → `VERIFIED` → `ACTIVE` → `SUSPENDED`

`ACTIVE` must never be inferred from a route existing in the application.

## Commercial rules

Partner, inventory, offer, price, promotion, commission, lead or sales claims require the appropriate agreement, source or settlement evidence. A company name appearing in a category is not evidence of a partnership.

## Giving rules

A campaign can be visible as nominated or pending before verification, but must not be represented as verified, funded, completed or impactful without the relevant evidence. Donation totals are settlement-backed; impact claims are evidence-backed.

## Freedom rule

Ordinary lawful expression remains free. Commercial modules monetize verified value around the network rather than paywalling ordinary speech, ordinary video or ordinary live participation.

## Implementation boundary

This document establishes the shared product contract. It does not claim that payment processors, charities, dealers, airlines, businesses, inventory feeds, offers or external services are currently connected or active.

## Next engineering gate

Implement a shared typed module registry and connect each world route to that registry. Then add module-specific data models and end-to-end tests, followed by verified payment/partner integrations where credentials, agreements and evidence exist.
