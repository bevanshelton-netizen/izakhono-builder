-- IZAKHONO Super Engine portable Postgres payment fabric.
-- Provider credentials never belong in these tables.

create table if not exists iz_payment_intents (
  id text primary key,
  external_transaction_id text not null unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  description text,
  status text not null check (status in ('created','pending','paid','failed','cancelled','refunded')),
  provider text,
  provider_payment_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists iz_payment_intents_status_idx on iz_payment_intents(status);

create table if not exists iz_payment_events (
  id text primary key,
  kind text not null check (kind in ('webhook.received','payment.paid','payment.failed','payment.cancelled','payment.refunded','refund.requested','receipt.issued')),
  payment_intent_id text not null references iz_payment_intents(id),
  external_transaction_id text not null,
  provider text not null,
  fingerprint text not null unique,
  created_at timestamptz not null,
  recorded_at timestamptz not null default now()
);

create index if not exists iz_payment_events_payment_idx on iz_payment_events(payment_intent_id);

create table if not exists iz_payment_state_events (
  id bigint generated always as identity primary key,
  payment_intent_id text not null references iz_payment_intents(id),
  from_status text not null,
  to_status text not null,
  reason text not null,
  created_at timestamptz not null
);

create index if not exists iz_payment_state_events_payment_idx on iz_payment_state_events(payment_intent_id, created_at);

create table if not exists iz_fulfillment_jobs (
  id text primary key,
  payment_intent_id text not null unique references iz_payment_intents(id),
  merchant_id text not null,
  service_id text not null,
  status text not null check (status in ('queued','running','completed','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists iz_settlement_batches (
  id text primary key,
  merchant_id text not null,
  currency char(3) not null,
  amount_minor bigint not null check (amount_minor > 0),
  transaction_references jsonb not null,
  status text not null check (status in ('pending','settled','failed')),
  created_at timestamptz not null,
  settled_at timestamptz
);

create index if not exists iz_settlement_pending_idx on iz_settlement_batches(merchant_id, currency, status);

create table if not exists iz_reconciliation_records (
  id text primary key,
  provider text not null,
  external_transaction_id text not null unique,
  expected_amount_minor bigint not null,
  observed_amount_minor bigint not null,
  currency char(3) not null,
  matched boolean not null,
  reason text,
  created_at timestamptz not null
);

create table if not exists iz_payment_ledger_accounts (
  id text primary key,
  merchant_id text,
  currency char(3) not null,
  account_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists iz_payment_ledger_entries (
  id text primary key,
  transaction_id text not null,
  account_id text not null references iz_payment_ledger_accounts(id),
  direction text not null check (direction in ('debit','credit')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  reference text not null,
  created_at timestamptz not null default now()
);

create index if not exists iz_payment_ledger_tx_idx on iz_payment_ledger_entries(transaction_id);

-- Enable RLS for Supabase deployments. The service-role adapter remains server-side.
alter table iz_payment_intents enable row level security;
alter table iz_payment_events enable row level security;
alter table iz_payment_state_events enable row level security;
alter table iz_fulfillment_jobs enable row level security;
alter table iz_settlement_batches enable row level security;
alter table iz_reconciliation_records enable row level security;
alter table iz_payment_ledger_accounts enable row level security;
alter table iz_payment_ledger_entries enable row level security;
