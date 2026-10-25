-- IZAKHONO PAY™ Customer Benefits / Rewards v1
-- Purpose: give customers a durable rewards balance without turning points into a deposit,
-- stored-value wallet, or guaranteed cash-equivalent. Monetary redemption is disabled by
-- default at the data layer and should only be enabled where legally and commercially approved.

create table if not exists public.pay_reward_accounts (
  id uuid primary key default gen_random_uuid(),
  customer_ref text not null unique,
  status text not null default 'active' check (status in ('active','suspended','closed')),
  points_balance bigint not null default 0 check (points_balance >= 0),
  lifetime_earned bigint not null default 0 check (lifetime_earned >= 0),
  lifetime_redeemed bigint not null default 0 check (lifetime_redeemed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pay_reward_campaigns (
  id uuid primary key default gen_random_uuid(),
  merchant_ref text,
  name text not null,
  benefit_type text not null default 'points' check (benefit_type in ('points','discount','voucher','partner_offer')),
  points_per_unit numeric(18,6) not null default 1 check (points_per_unit >= 0),
  min_transaction_amount numeric(18,2) not null default 0 check (min_transaction_amount >= 0),
  currency text not null default 'ZAR',
  starts_at timestamptz,
  ends_at timestamptz,
  max_points_per_customer bigint,
  active boolean not null default true,
  terms text,
  created_at timestamptz not null default now()
);

create table if not exists public.pay_reward_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.pay_reward_accounts(id),
  transaction_ref text not null,
  entry_type text not null check (entry_type in ('earn','redeem','expire','adjustment')),
  points bigint not null check (points <> 0),
  transaction_amount numeric(18,2),
  currency text,
  merchant_ref text,
  campaign_id uuid references public.pay_reward_campaigns(id),
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists pay_reward_ledger_earn_idempotency
  on public.pay_reward_ledger(account_id, transaction_ref, entry_type)
  where entry_type = 'earn';
create index if not exists pay_reward_ledger_account_created
  on public.pay_reward_ledger(account_id, created_at desc);
create index if not exists pay_reward_campaign_active
  on public.pay_reward_campaigns(active, starts_at, ends_at);

create table if not exists public.pay_reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.pay_reward_accounts(id),
  points bigint not null check (points > 0),
  benefit_type text not null check (benefit_type in ('discount','voucher','partner_offer')),
  benefit_value numeric(18,2),
  currency text,
  merchant_ref text,
  reference text not null unique,
  status text not null default 'requested' check (status in ('requested','issued','used','cancelled','expired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.pay_reward_earn(
  p_customer_ref text,
  p_transaction_ref text,
  p_points bigint,
  p_transaction_amount numeric default null,
  p_currency text default null,
  p_merchant_ref text default null,
  p_campaign_id uuid default null,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.pay_reward_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.pay_reward_accounts;
begin
  if coalesce(trim(p_customer_ref),'') = '' or coalesce(trim(p_transaction_ref),'') = '' or p_points <= 0 then
    raise exception 'invalid_reward_earn_request';
  end if;

  insert into public.pay_reward_accounts(customer_ref)
  values (trim(p_customer_ref))
  on conflict (customer_ref) do nothing;

  select * into v_account from public.pay_reward_accounts where customer_ref = trim(p_customer_ref) for update;
  if v_account.status <> 'active' then
    raise exception 'reward_account_not_active';
  end if;

  begin
    insert into public.pay_reward_ledger(account_id, transaction_ref, entry_type, points,
      transaction_amount, currency, merchant_ref, campaign_id, description, metadata)
    values (v_account.id, p_transaction_ref, 'earn', p_points, p_transaction_amount,
      upper(p_currency), p_merchant_ref, p_campaign_id, p_description, coalesce(p_metadata,'{}'::jsonb));
  exception when unique_violation then
    select * into v_account from public.pay_reward_accounts where id = v_account.id;
    return v_account;
  end;

  update public.pay_reward_accounts
     set points_balance = points_balance + p_points,
         lifetime_earned = lifetime_earned + p_points,
         updated_at = now()
   where id = v_account.id
  returning * into v_account;

  return v_account;
end;
$$;

create or replace function public.pay_reward_redeem(
  p_customer_ref text,
  p_reference text,
  p_points bigint,
  p_benefit_type text,
  p_benefit_value numeric default null,
  p_currency text default null,
  p_merchant_ref text default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.pay_reward_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.pay_reward_accounts;
  v_redemption public.pay_reward_redemptions;
begin
  if coalesce(trim(p_customer_ref),'') = '' or coalesce(trim(p_reference),'') = '' or p_points <= 0 then
    raise exception 'invalid_reward_redemption';
  end if;
  if p_benefit_type not in ('discount','voucher','partner_offer') then
    raise exception 'unsupported_benefit_type';
  end if;

  select * into v_account from public.pay_reward_accounts
   where customer_ref = trim(p_customer_ref) for update;
  if not found or v_account.status <> 'active' then
    raise exception 'reward_account_not_active';
  end if;
  if v_account.points_balance < p_points then
    raise exception 'insufficient_reward_points';
  end if;

  insert into public.pay_reward_ledger(account_id, transaction_ref, entry_type, points,
    currency, merchant_ref, description, metadata)
  values (v_account.id, p_reference, 'redeem', -p_points, upper(p_currency), p_merchant_ref,
    'IZAKHONO PAY rewards redemption', coalesce(p_metadata,'{}'::jsonb));

  update public.pay_reward_accounts
     set points_balance = points_balance - p_points,
         lifetime_redeemed = lifetime_redeemed + p_points,
         updated_at = now()
   where id = v_account.id;

  insert into public.pay_reward_redemptions(account_id, points, benefit_type, benefit_value,
    currency, merchant_ref, reference, metadata)
  values (v_account.id, p_points, p_benefit_type, p_benefit_value, upper(p_currency),
    p_merchant_ref, p_reference, coalesce(p_metadata,'{}'::jsonb))
  returning * into v_redemption;

  return v_redemption;
end;
$$;

-- No direct anonymous/client table access. Server-side payment/rewards services should call
-- the security-definer functions after authenticating the customer and enforcing merchant policy.
alter table public.pay_reward_accounts enable row level security;
alter table public.pay_reward_campaigns enable row level security;
alter table public.pay_reward_ledger enable row level security;
alter table public.pay_reward_redemptions enable row level security;

revoke all on public.pay_reward_accounts from anon, authenticated;
revoke all on public.pay_reward_campaigns from anon, authenticated;
revoke all on public.pay_reward_ledger from anon, authenticated;
revoke all on public.pay_reward_redemptions from anon, authenticated;

comment on table public.pay_reward_accounts is 'IZAKHONO PAY customer loyalty balance; not a deposit or cash wallet.';
comment on table public.pay_reward_ledger is 'Immutable-ish rewards accounting ledger; entries are never updated in normal operation.';
comment on table public.pay_reward_campaigns is 'Merchant/partner-funded customer benefit rules.';
