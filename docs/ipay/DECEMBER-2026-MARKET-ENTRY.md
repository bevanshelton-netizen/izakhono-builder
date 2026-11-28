# I-PAY December 2026 Market-Entry Scope

**Status:** Proposed product and operating boundary. This document is not a legal opinion, regulatory approval, licence, or evidence that any partner arrangement is in place.

## Market position

I-PAY is a merchant-facing payment acceptance and orchestration software platform. It provides one integration and operating surface for merchants to initiate, monitor, reconcile, and report on payments processed by appropriately authorised third-party providers.

I-PAY is not represented as a bank, card scheme, card issuer, acquirer, clearing participant, settlement bank, or independent payment-system operator.

## Initial operating model

For the December 2026 controlled-launch target:

1. A merchant contracts with I-PAY for the software/platform service and separately enters any required payment-processing or acquiring agreement with the relevant authorised provider.
2. Payment instructions are routed to an authorised provider through that provider's approved integration.
3. The provider (or its appointed regulated participants) performs the regulated acquiring, processing, clearing and settlement functions for which it is authorised.
4. Settlement is made by the provider directly to the merchant's nominated account under the provider's agreement. I-PAY does not receive, pool, safeguard, hold, or redistribute merchant or payer funds.
5. I-PAY records provider references, payment state, webhook evidence, reconciliation data and platform audit events. The platform must not represent an initiated or redirected payment as successful until provider-side confirmation has been verified.
6. I-PAY earns disclosed software/platform fees. Any transaction-linked fee, referral, revenue-share, or payment-facilitation arrangement requires specific partner and legal review before it is offered.

This model is a risk-reduction design, not a conclusion that I-PAY is exempt from registration or authorisation. Classification depends on the actual activity, contracts, fund flows, technical control, and applicable current directives.

## December launch scope

### Include in the controlled MVP

- South African merchant onboarding for software access, with appropriate business verification and risk review.
- Hosted checkout and payment links.
- Merchant API credentials, scoped permissions, rotation and revocation.
- Payment intents with idempotency and explicit lifecycle states.
- One proven, contractually approved South African payment-provider integration for the first live pilot.
- Verified server-to-server provider notifications and signature/authenticity checks.
- Refund initiation only through the authorised provider's supported flow and permissions.
- Merchant dashboard, transaction search, downloadable reporting and reconciliation.
- Append-only audit trail, tenant isolation, environment separation, monitoring, incident response and support procedures.
- Clear disclosure of the actual payment provider and the party responsible for processing and settlement.

### Do not include in the first live release

- I-PAY-issued cards, stored-value wallets, e-money, or customer balances.
- I-PAY holding, pooling, safeguarding, or redistributing payer or merchant funds.
- Independent acquiring, clearing, settlement, or direct participation in payment-system infrastructure.
- A proprietary card network or claims that I-PAY is Visa, Mastercard, American Express, or a debit-card scheme.
- Cross-border payment facilitation, offshore merchant acquiring, FX conversion, or international settlement.
- Unapproved payment aggregation, sub-merchant onboarding, or payout functionality.
- Unsupported claims of instant settlement, guaranteed authorisation, or universal card acceptance.

These exclusions may be reconsidered only after a separate legal, partner, risk, and technical approval.

## Regulatory and partner gate

Before any live transaction, obtain written advice from qualified South African payments counsel and written confirmation from the relevant acquiring/payment partner on I-PAY's exact role. Map the complete funds flow, instruction flow, data flow, contractual relationships, fee model, and control of payment credentials.

Confirm with the South African Reserve Bank (SARB), or through the applicable formal channel, whether the proposed activities require registration, authorisation, designation, or other approval under the National Payment System framework and current directives. Do not rely on historic PASA guidance without checking the post-2026 transition of authorisation and registration functions to SARB and the relevant functions transferred to PayInc.

The review must specifically assess whether I-PAY's activities constitute or trigger any of the following: third-party payment provider activity; system-operator activity; acquiring or payment-facilitation activity; payment instruction initiation; handling or control of funds; and any Financial Intelligence Centre, consumer-protection, privacy, cybersecurity, PCI DSS, or card-scheme obligations applicable to the actual model.

A partner's licence or authorisation does not automatically cover I-PAY. Obtain written confirmation of sponsorship, permitted activities, onboarding responsibilities, transaction limits, dispute and refund responsibilities, settlement responsibilities, audit rights, security requirements, and termination/continuity arrangements.

## Release gates

No live-money launch until all gates are evidenced:

- [ ] Legal classification and written counsel opinion for the exact operating model.
- [ ] Written partner approval and executed agreements for the exact I-PAY role and integration.
- [ ] SARB/other required registration or authorisation confirmed complete, or written advice documenting why none is required for the defined activity.
- [ ] Confirmed funds-flow diagram showing no I-PAY custody or control of funds in the initial model.
- [ ] Merchant terms, privacy notice, fee disclosures, refund/dispute disclosures and support escalation approved.
- [ ] KYC/business verification, sanctions/AML allocation, fraud monitoring and suspicious-activity escalation responsibilities agreed and tested as applicable.
- [ ] Tenant isolation, least-privilege access, secrets management, webhook verification, idempotency, durable audit persistence and reconciliation independently tested.
- [ ] PCI scope documented; no raw card data stored or logged by I-PAY. Hosted/tokenised provider components used where appropriate.
- [ ] Sandbox end-to-end tests, failure/retry tests, duplicate-event tests, refund tests and reconciliation tests pass.
- [ ] Incident response, operational monitoring, backups, recovery and merchant support runbooks exercised.
- [ ] Pilot merchants explicitly approved by the partner and I-PAY risk owner; transaction limits and rollback/kill switch agreed.
- [ ] Production infrastructure and deployment have been verified on the approved hosting environment.

A December 2026 market-entry target means a controlled, partner-backed pilot only if every applicable gate is satisfied. If a gate is not satisfied, continue in sandbox/demo mode and move the live-money date rather than bypassing the gate.

## Product delivery priorities

1. Close the existing I-PAY Alpha CI and customer-brand pull requests after review and required checks.
2. Resolve the secure persistence and tenant/environment isolation gates before production use.
3. Prove one provider integration end-to-end in sandbox, including signed notifications, idempotency, ledger consistency, refunds and reconciliation.
4. Secure and document the acquiring/payment partner relationship and regulatory classification.
5. Run a small, capped merchant pilot only after the release gates above are signed off.
6. Add further rails (cards, EFT/instant bank payments and other methods) as partner integrations, not as claims that I-PAY itself operates those schemes or rails.

## Public positioning

Suggested wording:

> I-PAY helps businesses accept and manage digital payments through one merchant platform. Connect to supported payment providers, use hosted checkout or APIs, and manage payment activity, refunds and reconciliation from one place.

Only name or display a payment method, network, provider, or settlement promise when the relevant live partner integration and commercial permission exist. Do not imply universal Visa, Mastercard, American Express, debit-card, or instant-EFT acceptance before those rails are contracted, enabled, and tested.

## Source-of-truth references

- SARB, National Payment System regulation: https://www.sarb.co.za/en/home/what-we-do/payments-and-settlements/regulation
- SARB, Payments and Settlements / access to the NPS: https://www.resbank.co.za/en/home/what-we-do/payments-and-settlements
- SARB, PSMB transition (2026): https://www.southafricanreservebank.co.za/en/home/what-we-do/payments-and-settlements/psmb
- SARB, cross-border payment facilitator regulatory approach (23 June 2026): https://resbank.co.za/en/home/publications/publication-detail-pages/media-releases/2026/cross-border-regulation
- National Payment System Act 78 of 1998: https://www.gov.za/documents/national-payment-system-act

Re-check current laws, directives, regulator guidance and partner requirements at the time of launch. This document is an engineering/product control, not legal advice.
