# CashFlow Guardian — Revenue Model

## Business #1
CashFlow Guardian is the first commercial proof product for the IZAKHONO Business Creation Engine.

## Customer
South African small businesses that need better visibility over invoices, receivables, commitments and collections.

## Initial pricing hypothesis
- Founder launch: R299/month
- Optional activation/setup: R499 once-off
- Future Pro tier: R599/month
- Future AI automation add-on: R149/month
- Enterprise pricing: custom

These are **pricing hypotheses**, not guaranteed revenue.

## Money loop
1. Acquire a qualified business.
2. Activate the account.
3. Capture invoices/receivables.
4. Convert the customer to paid subscription.
5. Track verified payment/collection events.
6. Reduce churn through useful alerts and automation.
7. Upsell automation and higher tiers.

## Revenue events
Only count revenue after a real payment provider or verified financial record confirms the transaction.

Required event fields:
- customer_id
- product_id
- plan_id
- amount
- currency
- provider
- provider_transaction_id
- paid_at
- status

## MVP success gates
- Product usable end-to-end without manual engineering intervention.
- First real business activated.
- First real subscription/payment received.
- Verified revenue event stored.
- Customer retention/usage measured.

## North-star metric
**Businesses successfully activated and generating verified customer revenue through IZAKHONO.**
