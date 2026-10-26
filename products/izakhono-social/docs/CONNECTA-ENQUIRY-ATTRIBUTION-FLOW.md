# CONNECTA Enquiry → Attribution → Outcome Flow

Status: SOFTWARE PACKAGED  
Public route: NOT_YET_VERIFIED

## Purpose

Turn verified Benefits, Commerce and Vehicles discovery records into accountable customer enquiries without confusing an enquiry with a sale.

## Flow

`ACTIVE discovery record → authenticated enquiry → attribution ID → partner/campaign attribution → outcome pending → verified outcome`

## Rules

- Only `ACTIVE` discovery records can receive enquiries.
- An enquiry requires an authenticated CONNECTA account.
- Contact consent is stored explicitly.
- Every enquiry receives a unique `cx-*` attribution ID.
- Campaign attribution is optional but preserved when supplied.
- Partner attribution comes from the verified discovery record; it is never inferred from user text.
- Enquiry ≠ sale.
- Sale/conversion claims require separate evidence and settlement/outcome verification.
- Public discovery exposes only `ACTIVE` records.
- Suspended, rejected, revoked and unverified records cannot receive new public enquiries.

## API

`POST /v1/discovery/:id/enquiries`

Request:

```json
{
  "message": "Please contact me about this listing.",
  "consentToContact": true,
  "campaignId": "optional-campaign-id"
}
```

Response state:

`ENQUIRY_NOT_SALE`

The response contains the enquiry record and its generated attribution ID. It must not state that a purchase, lead qualification, conversion, commission or sale occurred unless separately evidenced.

## Commercial lifecycle

1. Partner/source is verified.
2. Record is created and submitted.
3. Evidence is reviewed.
4. Record becomes `ACTIVE`.
5. User discovers the record.
6. User submits an enquiry with contact consent where applicable.
7. CONNECTA generates attribution.
8. Partner/campaign receives the accountable enquiry reference.
9. Outcome is awaited.
10. Sale or other commercial outcome is verified separately.
11. Reporting can distinguish enquiry, qualified lead, outcome and settled revenue.

## Safety

No unverified partner, inventory, price, promotion, sale or customer outcome may be presented as fact.
