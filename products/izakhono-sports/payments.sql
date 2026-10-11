-- IZAKHONO SPORTS money layer v1
create table if not exists payment_orders (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations(id),
  campaign_id uuid references sponsor_campaigns(id),
  reference text unique not null,
  purpose text not null,
  amount numeric not null check (amount >= 0),
  currency_code char(3) not null default 'ZAR',
  provider text not null,
  provider_reference text,
  status text not null default 'pending',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  plan_code text not null,
  amount numeric not null check (amount >= 0),
  currency_code char(3) not null default 'ZAR',
  provider text not null,
  provider_reference text,
  status text not null default 'pending',
  current_period_start timestamptz,
  current_period_end timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations(id),
  subscription_id uuid references subscriptions(id),
  payment_order_id uuid references payment_orders(id),
  invoice_number text unique not null,
  amount numeric not null,
  currency_code char(3) not null,
  status text not null default 'issued',
  due_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, event_id)
);

create table if not exists platform_commissions (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references payment_orders(id) on delete cascade,
  rate numeric not null check (rate >= 0 and rate <= 1),
  gross_amount numeric not null,
  commission_amount numeric not null,
  currency_code char(3) not null,
  status text not null default 'accrued',
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_orders_status on payment_orders(status);
create index if not exists idx_payment_orders_org on payment_orders(organisation_id);
create index if not exists idx_subscriptions_org on subscriptions(organisation_id);
create index if not exists idx_webhook_provider_event on payment_webhook_events(provider,event_id);
create index if not exists idx_commissions_order on platform_commissions(payment_order_id);
