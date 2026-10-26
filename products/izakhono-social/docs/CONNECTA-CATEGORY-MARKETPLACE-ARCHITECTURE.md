# CONNECTA Category & Marketplace Architecture

## Product decision
CONNECTA is not only a general social feed. It is a **discoverable category network**: users can publish into clear verticals, and every category has a dedicated discovery surface so relevant posts, communities, organisations, products and opportunities can be found without searching the entire network.

The first-class commercial category is **Vehicles**, designed to support vehicle discovery, dealer/partner marketing, enquiries and attributed sales while preserving CONNECTA's free-expression charter.

## Category model

Each category is a stable platform taxonomy record with:

- `slug` — immutable machine identifier.
- `name` — customer-facing name.
- `description` — discovery explanation.
- `icon` — UI symbol.
- `parent_slug` — optional hierarchy for subcategories.
- `status` — active/hidden/retired.
- `sort_order` — deterministic navigation order.
- `commercial_enabled` — whether approved partners can publish commercial inventory/offers.
- `moderation_profile` — category-specific safety rules without changing the global Community Standards.

Recommended top-level categories:

1. Vehicles
2. Property
3. Jobs & Careers
4. Business & Services
5. Shopping & Products
6. Technology
7. Sports
8. Music & Entertainment
9. Education & Training
10. News & Community
11. Travel & Hospitality
12. Food & Lifestyle
13. Agriculture
14. Finance & Opportunities
15. Government & Public Services
16. Faith & Culture
17. Arts & Creativity
18. Health & Wellness
19. Events
20. General Conversation

The taxonomy is extensible. Categories must not become paywalls for ordinary speech.

## Vehicles: dedicated discovery

`/vehicles` becomes a category hub with:

- latest vehicle posts;
- vehicles for sale;
- dealer/partner listings;
- new arrivals;
- used vehicles;
- imports;
- commercial vehicles;
- motorcycles;
- parts & accessories;
- vehicle services;
- finance/insurance offers where legally permitted;
- location and make/model filters;
- verified dealer identity;
- enquiry CTA;
- attribution to the original partner/listing;
- report/fraud controls.

A vehicle post is indexed by category plus structured attributes such as make, model, year, price, mileage, transmission, fuel, body type, condition and stock/reference ID when supplied. This makes **all vehicle-related posts discoverable from the Vehicles hub** without relying on hashtags alone.

## Partner commerce model

CONNECTA can enter commercial agreements with approved companies (for example, vehicle dealers such as Japan Cars) under a standard partner framework. The framework should support:

- approved partner profile;
- partner verification/KYB requirements;
- authorised catalogue/inventory feed;
- tracked campaign links and enquiry IDs;
- product/listing ownership and attribution;
- lead routing to the partner;
- consent-aware contact capture;
- sales status reporting;
- commission or referral terms recorded in the commercial agreement;
- campaign start/end dates;
- suspension/revocation controls;
- dispute and fraud handling;
- transparent sponsored/partner labelling.

CONNECTA should **not imply a commercial relationship exists until an agreement is signed and verified**. The product supports the agreement and integration; it does not fabricate a partnership.

## Code-to-market sales engine

The platform should convert approved partner inventory into a repeatable distribution loop:

`Partner onboarding → inventory import → listing validation → category indexing → audience discovery → campaign distribution → enquiry/lead → partner handoff → sale outcome → attribution → reporting`

A partner should be able to provide a feed/API/CSV or use a CONNECTA partner dashboard. CONNECTA then generates:

- product/listing cards;
- category placement;
- campaign creatives from approved assets;
- tracked CTA links;
- enquiry forms;
- referral IDs;
- campaign analytics;
- conversion reports.

No deceptive claims, fake scarcity, undisclosed paid placement or fabricated sales results.

## Monetisation

CONNECTA monetises **commercial value around the network**, not basic speech. Possible revenue lines:

- partner subscriptions;
- listing/catalogue services;
- qualified lead fees;
- referral/commission agreements;
- campaign packages;
- creator/partner collaborations;
- commerce tools;
- analytics and reporting;
- enterprise integrations/API;
- verified business services.

Ordinary users remain free to discuss, post and share content. Commercial controls are applied to partner inventory and regulated transactions, not ordinary expression.

## Safety and trust

Commercial listings must support:

- verified partner identity;
- clear seller identity;
- accurate pricing/availability status;
- report listing;
- anti-fraud review;
- prohibited-goods controls;
- consumer-protection notices where applicable;
- audit trail for material listing changes;
- removal/suspension without deleting unrelated lawful speech.

## Initial implementation sequence

1. Seed category taxonomy.
2. Add category to post creation and post persistence.
3. Add category feeds and `/category/[slug]` discovery routes.
4. Add structured Vehicles listing fields.
5. Add partner organisation records and verification state.
6. Add campaign/attribution records.
7. Add enquiry capture and partner routing.
8. Add partner dashboard and reporting.
9. Add commercial agreement records and activation gates.
10. Add automated catalogue ingestion and campaign generation.
11. Add end-to-end tests for category discovery, partner attribution and lead flow.

**Invariant:** category discovery improves relevance; it must never become a mechanism for restricting ordinary lawful expression.
