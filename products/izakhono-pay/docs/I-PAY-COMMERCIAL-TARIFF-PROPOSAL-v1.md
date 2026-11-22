# I-PAY™ Merchant Tariff — Proposed V1

**Status: PROPOSAL ONLY — NOT ACTIVE OR BINDING**

This document records the initial commercial direction for I-PAY. It must not be treated as an active tariff, merchant offer, quotation or promise of processing availability.

## Subscription plans

| Plan | Proposed monthly subscription | Intended merchant |
|---|---:|---|
| I-PAY Starter | R0 | Entrepreneurs, freelancers and small businesses |
| I-PAY Business | R199 | Growing teams and SMEs |
| I-PAY Professional | R699 | High-volume and multi-location businesses |
| I-PAY Enterprise | Custom | Platforms, marketplaces and corporate groups |

## Indicative South African processing targets

| Plan | Local card target |
|---|---:|
| Starter | 2.75% + R1 |
| Business | 2.50% + R1 |
| Professional | 2.25% + R1 |
| Enterprise | Negotiated |

These targets are subject to actual acquiring, scheme, fraud, dispute, settlement, tax and operational costs. They must not be activated in production until contribution-margin analysis is approved.

## Separate schedules required

Do not infer or reuse local card rates for:

- Instant EFT / pay-by-bank
- International cards
- FX conversion and FX spread
- Cross-border settlement
- Merchant payouts and instant payouts
- Refunds and disputes
- Chargebacks
- Wallet services
- Additional API usage
- White-label and enterprise services

Each schedule requires partner cost evidence, country eligibility, legal review and transparent merchant disclosure.

## Unit-economics requirements

For each merchant, provider, payment method and country, calculate:

1. Gross processing revenue.
2. Acquirer and scheme costs.
3. Provider fixed transaction charges.
4. Refund and dispute costs.
5. Fraud and loss provision.
6. Infrastructure cost allocation.
7. Support and servicing cost allocation.
8. Subscription revenue.
9. Gross contribution and contribution margin.

The Cost Intelligence Engine must distinguish variable transaction costs from allocated fixed infrastructure costs. Owned infrastructure should lower avoidable technology costs over time, but must not be used to assume that regulated external rails are free.

## Activation gates

Before publishing or activating any tariff:

- Obtain written wholesale pricing from each relevant partner.
- Confirm scheme and acquiring charges and all pass-through costs.
- Model normal, low-ticket, high-ticket, refund and chargeback scenarios.
- Validate minimum contribution margins.
- Complete legal, tax and disclosure review.
- Configure versioned tariffs with effective dates.
- Test fee calculation, rounding, refunds and reconciliation.
- Obtain commercial approval and retain an audit record.

Until those gates pass, the figures remain indicative planning targets only.
