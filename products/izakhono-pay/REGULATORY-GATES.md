# IZAKHONO PAY Regulatory Gates

## Core rule

IZAKHONO PAY must not enable a payment activity merely because the code exists. A capability is enabled only when the applicable legal, regulatory, banking, compliance, security and operational gates have been satisfied for the relevant country and product.

## South Africa launch boundary

The initial production model is payment orchestration using licensed/authorised payment providers and banking partners. IZAKHONO PAY does not hold customer funds, issue e-money, operate a stored-value wallet, acquire directly, clear/settle directly, or conduct cross-border remittance until the required approvals, registrations, sponsorships or authorisations are in place.

## Capability gates

### Merchant checkout / orchestration
- Use regulated providers for custody and settlement.
- Do not store raw card data.
- Verify provider webhooks and reconcile every payment.
- Confirm whether System Operator / TPPP or successor SARB authorisation requirements apply before serving external merchants.

### Stored-value wallet / e-money
- Disabled by default.
- No real customer wallet balance may be created until the applicable e-money/payment-instrument framework, prudential conditions and required authorisation or bank-partner structure are satisfied.
- Customer funds must be safeguarded according to the approved legal structure.

### Person-to-person transfers / remittance
- Disabled by default.
- Requires legal classification, AML/CFT controls, KYC, sanctions screening, transaction monitoring, reporting and any remittance or payment-activity authorisation required in each jurisdiction.

### Merchant acquiring
- Direct acquiring is disabled unless authorised and operationally approved.
- Until then, acquiring remains with licensed banks/acquirers/payment providers.

### Cross-border payments
- Disabled for unsupported corridors.
- Each corridor must pass exchange-control, sanctions, AML/CFT, local licensing, settlement and partner due-diligence checks.

### External merchant onboarding
- No public merchant onboarding until the regulatory classification and required SARB/other-country approvals are confirmed.
- Merchant KYC/KYB, beneficial ownership, sanctions/PEP screening and risk-tiering must be implemented before activation.

## Financial-crime controls

Before any activity that makes IZAKHONO PAY an accountable institution or otherwise subject to FIC Act obligations, the platform must have the required registration and compliance programme in place, including customer due diligence, beneficial-ownership checks, sanctions/PEP screening, transaction monitoring, record keeping, regulatory reporting, compliance governance and staff training.

## FORTRESS role

SHELTON FORTRESS supplies an additional trust and security layer for merchant, customer, API and infrastructure activity. It does not replace statutory compliance, regulated-provider controls, PCI obligations, SARB/FSCA/FIC requirements, bank sponsorship, or independent security review.

## Release gate

Any feature in the categories below must remain `disabled` or `sandbox_only` until a documented regulatory decision is attached to the release:
- hold customer money
- issue e-money or stored value
- enable P2P transfers
- enable cross-border remittance
- settle money for third-party merchants
- direct acquiring
- payment initiation where authorisation is required
- operate a payment scheme
- onboard external merchants at scale

A production release may not override these gates through a UI flag alone.

## Evidence required to move a capability to live

1. Written legal/regulatory classification for the feature and jurisdiction.
2. Required SARB/other regulator authorisation, registration, exemption or sponsoring-bank confirmation.
3. FIC/AML/CFT readiness where applicable.
4. Banking/acquiring/settlement agreements in force.
5. Security and privacy review completed.
6. Tested reconciliation, refunds, disputes and incident-response flows.
7. Production credentials stored only in approved secret stores.
8. Executive sign-off that the documented gates are satisfied.

## Strategy

Build ahead of regulation technically, but never switch regulated functionality on ahead of approval. This allows IZAKHONO PAY to move quickly while staying within the law.
