-- Durable webhook idempotency contract.
-- One webhook claim is permitted per provider + external transaction.
-- A separate outcome fingerprint lets exact duplicates succeed while contradictory
-- outcomes are rejected without mutating payment state.

create unique index if not exists iz_payment_webhook_claim_idx
  on iz_payment_events(provider, external_transaction_id)
  where kind = 'webhook.received' and fingerprint like 'webhook:%';

create index if not exists iz_payment_webhook_outcome_idx
  on iz_payment_events(provider, external_transaction_id)
  where kind = 'webhook.received' and fingerprint like 'webhook-outcome:%';
