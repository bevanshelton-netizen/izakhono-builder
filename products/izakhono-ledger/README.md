# IZAKHONO LEDGER

Entity-scoped double-entry ledger for the IZAKHONO group infrastructure.

This is a financial **recording engine**, not a bank account, payment institution or fund custodian.

## Guarantees in the alpha

- every account belongs to one `entity_id`
- every transaction belongs to one `entity_id`
- every transaction must balance debits and credits
- account currency must match transaction currency
- idempotent transaction references are scoped per entity
- postings are written atomically
- raw card/bank credentials are not stored

## Intended consumers

- IZAKHONO PAY
- future banking software
- DOXA-SURE premium/claims accounting
- ALLEGRO/KORA royalty settlement
- ticketing
- subscriptions
- internal financial reporting

## API

Internal-only, protected with `x-izakhono-ledger-key`.

Create account:
`POST /api/v1/accounts`

Post transaction:
`POST /api/v1/transactions`

Get balance:
`GET /api/v1/accounts/{entity_id}/{account_code}/balance`

## Boundary

A balanced internal ledger is necessary financial infrastructure, but it is not legal proof that money is held, settled or insured. External settlement truth must be reconciled to regulated banks, payment providers and insurers until owner licences and infrastructure permit otherwise.
