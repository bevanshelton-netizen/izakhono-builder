# CONNECTA Discovery Record API Contract

Status: SOFTWARE PACKAGED  
Public route: NOT_YET_VERIFIED

## Purpose

Define the server-side contract that turns the Benefits, Commerce and Vehicles discovery surfaces into evidence-gated, searchable records without inventing inventory, partners, offers or outcomes.

## Record states

`SUBMITTED -> VERIFICATION_PENDING -> VERIFIED -> ACTIVE -> ENQUIRY -> OUTCOME_PENDING -> EVIDENCED`

Failure/review states: `REJECTED`, `SUSPENDED`, `DISPUTED`, `REVERSED`.

## Core record envelope

```json
{
  "id": "stable-record-id",
  "surface": "benefits|commerce|vehicles",
  "title": "display title",
  "description": "human-readable description",
  "trust_status": "VERIFICATION_PENDING",
  "source_type": "owner|partner|user|import",
  "source_reference": "verified-source-reference",
  "submitted_at": "ISO-8601",
  "verified_at": null,
  "terms_url": null,
  "attribution_id": null
}
```

## Benefits

Required: `category`, `benefit`, `provider`, `starts_at`, `ends_at`, `claim_mode`, `terms_url`, `attribution_id`.

An offer cannot become `ACTIVE` without verified terms, provider identity and validity dates.

## Commerce

Required: `business_id`, `category`, `price_display`, `availability`, `cta_mode`, `enquiry_id`, `campaign_id`.

An enquiry is a lead event, not a sale. A conversion requires evidence and, where applicable, settlement.

## Vehicles

Required: `seller_id`, `make`, `model`, `year`, `price`, `currency`, `mileage`, `transmission`, `fuel`, `body`, `condition`, `stock_reference`, `location`, `enquiry_id`, `campaign_id`.

Partner inventory requires verified source and relationship evidence. `Japan Cars` and other companies must never appear as CONNECTA partners unless an actual agreement has been verified.

## Query contract

Discovery requests should support:

- `surface`
- `q`
- `category`
- `trust_status`
- surface-specific filters
- pagination
- deterministic ordering

Default public discovery ordering is verification-first and then freshness. No behavioral-ad ranking is required for basic discovery.

## Integrity rules

- Submitted is not verified.
- Verified is not necessarily active.
- Enquiry is not a sale.
- A promotion is not active without verified terms.
- A partner is not official without agreement evidence.
- A donation is not settled merely because a payment intent exists.
- An impact claim requires evidence.
- Sponsored placement must be labelled.
- Ordinary expression remains free.

## Implementation boundary

This contract is intentionally storage/API-neutral. The production implementation must use the CONNECTA ENGINE and owned PostgreSQL path first. External infrastructure may be used only as an explicitly documented resilience path.
