-- CONNECTA monetization foundation.
-- Additive only. Payment processing remains provider-agnostic and must be completed
-- through an approved payment partner before any charge is captured.
-- Never use payment, subscription or commerce records for behavioural profiling.

create table if not exists monetization_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  audience text not null check (audience in ('consumer','creator','business','enterprise')),
  billing_interval text not null check (billing_interval in ('monthly','annual','one_time')),
  currency char(3) not null default 'ZAR',
  amount_minor bigint not null check (amount_minor >= 0),
  platform_fee_bps integer not null default 0 check (platform_fee_bps between 0 and 10000),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists account_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  plan_id uuid not null references monetization_plans(id) on delete restrict,
  status text not null check (status in ('pending','active','past_due','paused','cancelled','expired')),
  provider text,
  provider_customer_ref text,
  provider_subscription_ref text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists account_subscriptions_active_uidx
  on account_subscriptions(account_id, plan_id)
  where status in ('pending','active','past_due','paused');

create index if not exists account_subscriptions_account_idx
  on account_subscriptions(account_id, created_at desc);

create table if not exists creator_memberships (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references accounts(id) on delete cascade,
  subscriber_id uuid not null references accounts(id) on delete cascade,
  title text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'ZAR',
  billing_interval text not null check (billing_interval in ('monthly','annual')),
  status text not null check (status in ('pending','active','paused','cancelled','expired')),
  provider text,
  provider_subscription_ref text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (creator_id <> subscriber_id)
);

create index if not exists creator_memberships_creator_status_idx
  on creator_memberships(creator_id, status, created_at desc);

create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete set null,
  kind text not null check (kind in ('subscription','creator_membership','tip','commerce','event','promotion','storage','enterprise')),
  status text not null check (status in ('pending','authorized','paid','failed','refunded','partially_refunded','cancelled')),
  currency char(3) not null,
  gross_minor bigint not null check (gross_minor >= 0),
  platform_fee_minor bigint not null default 0 check (platform_fee_minor >= 0 and platform_fee_minor <= gross_minor),
  recipient_minor bigint not null default 0 check (recipient_minor >= 0 and recipient_minor <= gross_minor),
  provider text,
  provider_transaction_ref text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_transactions_account_created_idx
  on payment_transactions(account_id, created_at desc);
create index if not exists payment_transactions_status_created_idx
  on payment_transactions(status, created_at desc);

create table if not exists creator_payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references accounts(id) on delete restrict,
  currency char(3) not null,
  gross_minor bigint not null check (gross_minor >= 0),
  platform_fee_minor bigint not null default 0 check (platform_fee_minor >= 0 and platform_fee_minor <= gross_minor),
  payout_minor bigint not null check (payout_minor >= 0 and payout_minor <= gross_minor),
  status text not null check (status in ('pending','eligible','processing','paid','failed','reversed')),
  provider text,
  provider_payout_ref text,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists creator_payouts_creator_status_idx
  on creator_payouts(creator_id, status, created_at desc);

create table if not exists commerce_offers (
  id uuid primary key default gen_random_uuid(),
  seller_account_id uuid references accounts(id) on delete cascade,
  business_id uuid references businesses(id) on delete cascade,
  title text not null,
  description text not null default '',
  currency char(3) not null default 'ZAR',
  price_minor bigint not null check (price_minor >= 0),
  status text not null default 'draft' check (status in ('draft','active','paused','sold_out','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (seller_account_id is not null or business_id is not null)
);

create index if not exists commerce_offers_seller_status_idx
  on commerce_offers(seller_account_id, status, created_at desc);
create index if not exists commerce_offers_business_status_idx
  on commerce_offers(business_id, status, created_at desc);

create table if not exists entitlement_grants (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  entitlement_code text not null,
  source_type text not null check (source_type in ('plan','subscription','membership','promotion','admin')),
  source_id uuid,
  state text not null default 'active' check (state in ('active','revoked','expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists entitlement_grants_account_state_idx
  on entitlement_grants(account_id, entitlement_code, state, starts_at desc);

insert into monetization_plans (code, name, audience, billing_interval, currency, amount_minor, metadata)
values
  ('consumer_plus', 'CONNECTA Plus', 'consumer', 'monthly', 'ZAR', 4900, '{"positioning":"premium consumer experience"}'),
  ('consumer_pro', 'CONNECTA Pro', 'consumer', 'monthly', 'ZAR', 14900, '{"positioning":"advanced creator and power-user tools"}'),
  ('business', 'CONNECTA Business', 'business', 'monthly', 'ZAR', 39900, '{"positioning":"verified business and community tools"}')
on conflict (code) do update set
  name=excluded.name,
  audience=excluded.audience,
  billing_interval=excluded.billing_interval,
  currency=excluded.currency,
  amount_minor=excluded.amount_minor,
  metadata=excluded.metadata,
  updated_at=now();

comment on table payment_transactions is
  'Provider-agnostic financial transaction ledger. No card, bank or secret payment credentials belong here.';
comment on table creator_payouts is
  'Creator revenue-share ledger. Actual payout execution requires an approved payment provider and applicable compliance controls.';
comment on table entitlement_grants is
  'Feature-access state derived from commercial purchases or grants; never use as behavioural profiling.';
