# FORTRESS INTELLIGENCE™ — END-TO-END INTEGRATION ARCHITECTURE

## Production flow

`Customer → FORTRESS UI/API → Identity Resolution → Provider Router → Evidence Store → Relationship Graph → Risk Rules → Human Review → Case Decision → Audit → Continuous Monitoring`

## Provider strategy

### Tier 1 — South Africa

1. **CIPC APIVerse** — authoritative company data. CIPC exposes OAuth 2.0 APIs for company search/retrieval and a beneficial-ownership API where authorised access is available. Access is subscription/contract controlled.
2. **VerifyNow** — KYC, identity, CIPC, AML/PEP/sanctions and related verification APIs; candidate local integration/reseller partner.
3. **FIC Targeted Financial Sanctions** — official South African sanctions source for local compliance workflows.

### Tier 2 — Global financial-crime intelligence

1. **OpenSanctions** — commercial API/reseller licence for sanctions, PEP and related entity intelligence.
2. Additional licensed providers can be plugged into the same provider interface without changing the customer product.

## Provider interface

Every provider adapter must implement:

- `search(entity)`
- `match(entity)`
- `get_entity(id)`
- `get_sources(id)`
- `health()`
- `usage()`
- `capabilities()`

Provider-specific credentials remain server-side. No customer-facing source key is ever exposed.

## Evidence model

Every signal stores:

- provider
- source dataset
- source URL/reference where permitted
- provider entity ID
- observed_at
- retrieved_at
- match method
- match confidence
- matched attributes
- jurisdiction
- licence/usage class
- evidence hash

## Decision model

FORTRESS never converts a raw provider hit directly into a criminality or guilt statement. It produces:

`signal → match confidence → corroboration → analyst review → disposition`

Possible dispositions:

- false positive
- needs information
- confirmed match
- escalated
- cleared
- unable to determine

## Monitoring

Customers can place entities on a watchlist. A scheduled worker re-screens changed entities and opens a review event when material evidence changes.

## Multi-tenant security

- tenant isolation
- role-based access
- least privilege
- encrypted secrets
- immutable audit events
- retention policies
- export/delete controls
- rate limits
- provider spend limits
- incident logging

## POPIA / privacy gate

Production launch requires documented lawful purpose, data minimisation, retention, data-subject processes, cross-border transfer controls where applicable, processor/operator contracts and customer responsibilities. The product must not be marketed as a substitute for the customer's statutory compliance decisions.

## Commercial gate

No provider data is redistributed until the applicable commercial licence/reseller agreement expressly permits the intended product use. OpenSanctions specifically states that commercial use requires a data licence; VerifyNow states that resale of platform access requires a signed reseller agreement. 
