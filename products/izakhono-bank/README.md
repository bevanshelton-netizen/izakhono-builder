# IZAKHONO BANK™ — Banking Infrastructure Programme

## Mission
Build the technology, controls, operating model and regulatory evidence required for IZAKHONO to become a fully fledged bank, while keeping all regulated deposit-taking and live banking functions disabled until the required authorisations and partner permissions exist.

## Operating principle
**Build the bank before we call it a bank.**

The platform is being engineered in pre-authorisation sandbox mode first. It must be capable of moving to partner-powered operation and ultimately authorised operation without rebuilding the core.

## Core architecture

- Customer & identity layer — IZAKHONO ID
- Core account/product layer — customers, accounts, products, limits
- Double-entry ledger — immutable transaction and entry model
- Payment layer — IZAKHONO PAY orchestration
- Cards & wallets — partner-powered first, owned capabilities later
- Compliance — KYC/KYB, AML, sanctions, transaction monitoring, cases
- Fraud & security — FORTRESS
- Pay-Back engine — threshold rewards and customer value return
- Treasury & liquidity — future controlled module
- Lending — future credit lifecycle module
- Reconciliation & settlement — controlled operational layer
- Regulatory evidence — readiness/control register
- Audit — append-only operational and governance evidence

## Operating states

1. `pre_authorisation_sandbox`
2. `partner_powered`
3. `authorised`

No state transition may enable regulated deposit-taking merely because software is complete.

## First system modules

The Supabase financial platform now contains:

- `bank_institutions`
- `bank_products`
- `bank_customers`
- `bank_accounts`
- `bank_ledger_transactions`
- `bank_ledger_entries`
- `bank_compliance_cases`
- `bank_limits`
- `bank_payback_rules`
- `bank_payback_events`
- `bank_regulatory_readiness`

All banking tables are RLS-enabled and currently restricted to `service_role`; there is no public client access to the financial core.

## Regulatory workstream

The South African Prudential Authority assesses banking applicants on matters including resources, ownership, governance, risk management/internal controls, information/accounting systems, legal structure and prudential requirements. The PA also provides a pre-application consultation route. The programme therefore treats regulatory readiness as an engineering workstream, not a document-writing exercise.

## Build sequence

### Track A — Core banking
- Account lifecycle
- Product engine
- Double-entry posting
- Limits
- Fees
- Interest engine
- Statements
- Reconciliation

### Track B — Customer banking
- Digital onboarding
- KYC/KYB
- Customer profile
- Account dashboard
- Cards
- Wallets
- Transfers
- Beneficiaries

### Track C — Risk & compliance
- AML
- Sanctions
- Transaction monitoring
- Fraud
- Case management
- Suspicious activity workflows
- Audit evidence

### Track D — Payments
- IZAKHONO PAY
- Provider orchestration
- Webhooks
- Idempotency
- Refunds
- Disputes
- Settlement
- Pay-Back rewards

### Track E — Bank readiness
- Governance
- Capital plan
- Liquidity framework
- IT governance
- Operational resilience
- Customer protection
- Regulatory reporting
- Independent assurance
- PA pre-application pack

## Non-negotiable safety rule
Software readiness is not regulatory authorisation. Live deposits, regulated banking services and other controlled financial activities remain disabled until the appropriate legal, regulatory, contractual and operational gates are verified.
