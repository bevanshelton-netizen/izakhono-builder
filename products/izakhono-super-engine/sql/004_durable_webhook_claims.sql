-- Durable webhook claim contract for multi-instance processing.
-- This table is intentionally separate from provider-specific event schemas.
-- One external transaction can have exactly one claimed webhook outcome.

create table if not exists iz_payment_webhook_claims (
  provider text not null,
  external_transaction_id text not null,
  outcome_fingerprint text not null,
  payment_intent_id text not null references iz_payment_intents(id),
  created_at timestamptz not null default now(),
  primary key (provider, external_transaction_id)
);

create index if not exists iz_payment_webhook_claim_payment_idx
  on iz_payment_webhook_claims(payment_intent_id);

alter table iz_payment_webhook_claims enable row level security;
