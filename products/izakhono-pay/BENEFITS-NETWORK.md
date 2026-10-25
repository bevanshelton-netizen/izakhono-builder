# IZAKHONO BENEFITS™ — Network Operating Model

## Product promise

**PAY → EARN → BENEFIT → RETURN**

IZAKHONO PAY remains the payment orchestration layer. IZAKHONO BENEFITS turns eligible payment events into customer value without treating loyalty points as deposits, cash balances or regulated stored value.

## Components

1. **Customer Benefits Account** — points balance, lifetime earned/redeemed, eligible offers and redemption history.
2. **Merchant Benefits Studio** — campaign creation, eligibility rules, reward type, budget, validity and status.
3. **Benefits Engine** — evaluates payment events against campaign rules and customer eligibility.
4. **Reward Ledger** — append-only earning/redemption events with idempotency keys and auditability.
5. **Redemption Engine** — supports configured discount, voucher and partner-offer redemption types.
6. **Merchant Funding Controls** — campaign budgets, caps and activation states prevent uncontrolled promotional exposure.
7. **FORTRESS Controls** — velocity checks, duplicate-event protection, suspicious redemption detection, account status controls and audit trails.
8. **Network Intelligence** — merchant-funded value, issuance, redemption, repeat-use and campaign performance analytics.

## Payment event flow

`payment.authorized/captured` → `eligibility.evaluate` → `campaign.match` → `budget.check` → `reward.earn` → `customer.notify` → `redeem` → `reconciliation`

Every reward event must carry an idempotency key derived from the payment/merchant/customer event context. Payment money and reward points remain separate ledgers.

## Merchant model

Merchants can fund benefits through promotional budgets. IZAKHONO defines the rules, records the events and exposes reporting. The initial commercial model should prioritize merchant-funded promotions and partner-funded benefits rather than IZAKHONO-funded universal cashback.

## Customer experience

- One IZAKHONO identity across participating products.
- One benefits view across eligible merchants.
- Clear explanation of why a benefit was unlocked.
- No surprise fees or hidden conversion assumptions.
- Explicit campaign terms, expiry and eligibility.
- Security controls before high-value redemption.

## Regulatory guardrails

IZAKHONO must not describe reward points as cash, deposits, guaranteed returns or a bank balance. Any future wallet, stored-value, cashback, remittance, custody, settlement or other regulated capability must be implemented through appropriately authorised partners or after IZAKHONO obtains the required authorisations.

Live payment and benefit availability remains dependent on provider contracts, merchant onboarding, customer eligibility, security validation and applicable law.

## Product surface

The controlled pilot includes a customer benefits experience and merchant Benefits Studio prototype at:

`/products/izakhono-pay/benefits.html`

Production deployment is a separate release gate and must be verified after deployment; a Git commit is not evidence of production deployment.

## North-star metric

**Customer value unlocked per eligible payment**, measured alongside merchant-funded cost, redemption rate, repeat purchase behaviour and fraud/abuse rate.
