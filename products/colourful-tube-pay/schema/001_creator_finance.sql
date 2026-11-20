-- COLOURFUL TUBE PAY creator-finance schema proposal.
-- REVIEW ONLY: do not apply to a shared or production database before migration review.
-- Monetary amounts use integer minor units. This schema does not store bank credentials or provider secrets.

create schema if not exists ct_pay_private;

create table if not exists ct_pay_private.creator_profiles (
  id uuid primary key,
  platform_user_id uuid not null unique,
  display_name text not null,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected','suspended')),
  payout_eligibility text not null default 'blocked'
    check (payout_eligibility in ('blocked','eligible','review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ct_pay_private.revenue_events (
  id uuid primary key,
  source_reference text not null unique,
  source_type text not null check (source_type in ('advertising','membership','tip','sponsorship','licensing','affiliate','grant','other')),
  provider text,
  currency char(3) not null,
  gross_minor bigint not null check (gross_minor >= 0),
  provider_fee_minor bigint not null default 0 check (provider_fee_minor >= 0),
  refund_minor bigint not null default 0 check (refund_minor >= 0),
  chargeback_minor bigint not null default 0 check (chargeback_minor >= 0),
  tax_reserve_minor bigint not null default 0 check (tax_reserve_minor >= 0),
  distributable_minor bigint not null check (distributable_minor >= 0),
  status text not null default 'pending'
    check (status in ('pending','confirmed','reversed','disputed','reconciled')),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now()
);

create table if not exists ct_pay_private.allocation_policies (
  id uuid primary key,
  policy_name text not null,
  source_type text not null,
  creator_share_bps integer not null check (creator_share_bps between 0 and 10000),
  platform_share_bps integer not null check (platform_share_bps between 0 and 10000),
  effective_from timestamptz not null,
  effective_until timestamptz,
  approval_reference text not null,
  status text not null check (status in ('draft','approved','retired')),
  created_at timestamptz not null default now(),
  check (creator_share_bps + platform_share_bps = 10000),
  check (effective_until is null or effective_until > effective_from)
);

create table if not exists ct_pay_private.creator_allocations (
  id uuid primary key,
  revenue_event_id uuid not null references ct_pay_private.revenue_events(id),
  creator_id uuid not null references ct_pay_private.creator_profiles(id),
  policy_id uuid not null references ct_pay_private.allocation_policies(id),
  currency char(3) not null,
  distributable_minor bigint not null check (distributable_minor >= 0),
  creator_amount_minor bigint not null check (creator_amount_minor >= 0),
  platform_amount_minor bigint not null check (platform_amount_minor >= 0),
  status text not null default 'pending'
    check (status in ('pending','approved','reversed','disputed')),
  created_at timestamptz not null default now(),
  unique (revenue_event_id, creator_id),
  check (creator_amount_minor + platform_amount_minor = distributable_minor)
);

create table if not exists ct_pay_private.ledger_accounts (
  id uuid primary key,
  owner_type text not null check (owner_type in ('creator','platform','provider_clearing','payout_clearing','fee_expense','refund_reserve')),
  owner_id uuid,
  account_code text not null unique,
  currency char(3) not null,
  status text not null default 'open' check (status in ('open','frozen','closed')),
  created_at timestamptz not null default now()
);

create table if not exists ct_pay_private.ledger_transactions (
  id uuid primary key,
  transaction_reference text not null unique,
  transaction_type text not null check (transaction_type in ('collection','allocation','fee','refund','chargeback','payout_hold','payout_release','adjustment','reversal')),
  source_reference text not null,
  status text not null check (status in ('pending','posted','reversed')),
  description text,
  posted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists ct_pay_private.ledger_entries (
  id uuid primary key,
  transaction_id uuid not null references ct_pay_private.ledger_transactions(id),
  account_id uuid not null references ct_pay_private.ledger_accounts(id),
  side text not null check (side in ('debit','credit')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  created_at timestamptz not null default now()
);

create index if not exists ct_pay_ledger_entries_transaction_idx
  on ct_pay_private.ledger_entries(transaction_id);
create index if not exists ct_pay_creator_allocations_creator_idx
  on ct_pay_private.creator_allocations(creator_id, created_at desc);
create index if not exists ct_pay_revenue_events_status_idx
  on ct_pay_private.revenue_events(status, occurred_at desc);

create table if not exists ct_pay_private.payout_requests (
  id uuid primary key,
  creator_id uuid not null references ct_pay_private.creator_profiles(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  beneficiary_reference text not null,
  provider text,
  provider_payout_reference text unique,
  status text not null default 'requested'
    check (status in ('requested','verification_required','under_review','approved','processing','paid','failed','cancelled','reversed')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz,
  reviewer_reference text
);

create table if not exists ct_pay_private.provider_events (
  id uuid primary key,
  provider text not null,
  provider_event_reference text not null,
  event_type text not null,
  payload_digest text not null,
  verification_status text not null check (verification_status in ('verified','rejected')),
  processed_at timestamptz,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_reference)
);

-- Defense in depth: no client access is granted by this proposal.
alter table ct_pay_private.creator_profiles enable row level security;
alter table ct_pay_private.revenue_events enable row level security;
alter table ct_pay_private.allocation_policies enable row level security;
alter table ct_pay_private.creator_allocations enable row level security;
alter table ct_pay_private.ledger_accounts enable row level security;
alter table ct_pay_private.ledger_transactions enable row level security;
alter table ct_pay_private.ledger_entries enable row level security;
alter table ct_pay_private.payout_requests enable row level security;
alter table ct_pay_private.provider_events enable row level security;

comment on schema ct_pay_private is
  'Private COLOURFUL TUBE PAY accounting and creator finance records. No client policies are defined in the initial proposal.';


-- Transaction-level balance enforcement. A transaction may be marked posted only
-- when every currency balances independently and at least two entries exist.
create or replace function ct_pay_private.assert_ledger_transaction_balanced(p_transaction_id uuid)
returns void
language plpgsql
set search_path = pg_catalog, ct_pay_private
as $$
declare
  v_status text;
  v_count bigint;
  v_unbalanced bigint;
begin
  select status into v_status
  from ct_pay_private.ledger_transactions
  where id = p_transaction_id;

  if not found or v_status <> 'posted' then
    return;
  end if;

  select count(*),
         count(*) filter (where debit_total <> credit_total)
    into v_count, v_unbalanced
  from (
    select currency,
           coalesce(sum(amount_minor) filter (where side = 'debit'), 0) as debit_total,
           coalesce(sum(amount_minor) filter (where side = 'credit'), 0) as credit_total
    from ct_pay_private.ledger_entries
    where transaction_id = p_transaction_id
    group by currency
  ) balances;

  if v_count = 0 or v_unbalanced <> 0 then
    raise exception 'Ledger transaction % is not balanced', p_transaction_id
      using errcode = '23514';
  end if;

  if (select count(*) from ct_pay_private.ledger_entries
      where transaction_id = p_transaction_id) < 2 then
    raise exception 'Posted ledger transaction % requires at least two entries', p_transaction_id
      using errcode = '23514';
  end if;
end;
$$;

create or replace function ct_pay_private.check_ledger_balance_from_entry()
returns trigger
language plpgsql
set search_path = pg_catalog, ct_pay_private
as $$
begin
  if tg_op = 'DELETE' then
    perform ct_pay_private.assert_ledger_transaction_balanced(old.transaction_id);
    return old;
  elsif tg_op = 'UPDATE' then
    perform ct_pay_private.assert_ledger_transaction_balanced(old.transaction_id);
    perform ct_pay_private.assert_ledger_transaction_balanced(new.transaction_id);
    return new;
  else
    perform ct_pay_private.assert_ledger_transaction_balanced(new.transaction_id);
    return new;
  end if;
end;
$$;

create or replace function ct_pay_private.check_ledger_balance_from_transaction()
returns trigger
language plpgsql
set search_path = pg_catalog, ct_pay_private
as $$
begin
  perform ct_pay_private.assert_ledger_transaction_balanced(new.id);
  return new;
end;
$$;

create constraint trigger ct_pay_entries_balance_check
after insert or update or delete on ct_pay_private.ledger_entries
deferrable initially deferred
for each row execute function ct_pay_private.check_ledger_balance_from_entry();

create constraint trigger ct_pay_transaction_balance_check
after insert or update on ct_pay_private.ledger_transactions
deferrable initially deferred
for each row execute function ct_pay_private.check_ledger_balance_from_transaction();

-- Posted entries and posted transaction identity are immutable. Corrections
-- must be represented by a separately posted reversal transaction.
create or replace function ct_pay_private.prevent_posted_entry_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, ct_pay_private
as $$
declare
  v_status text;
begin
  select status into v_status
  from ct_pay_private.ledger_transactions
  where id = case when tg_op = 'DELETE' then old.transaction_id else old.transaction_id end;

  if v_status = 'posted' then
    raise exception 'Entries on a posted transaction are immutable; post a reversal'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger ct_pay_entries_immutable
before update or delete on ct_pay_private.ledger_entries
for each row execute function ct_pay_private.prevent_posted_entry_mutation();

create table if not exists ct_pay_private.financial_audit_events (
  id uuid primary key,
  actor_reference text not null,
  action text not null,
  entity_type text not null,
  entity_reference text not null,
  reason text,
  correlation_reference text,
  event_digest text not null,
  occurred_at timestamptz not null default now()
);

alter table ct_pay_private.financial_audit_events enable row level security;


create or replace function ct_pay_private.prevent_posted_transaction_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, ct_pay_private
as $$
begin
  if old.status = 'posted' then
    raise exception 'Posted ledger transactions are immutable; post a reversal'
      using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger ct_pay_transactions_immutable
before update or delete on ct_pay_private.ledger_transactions
for each row execute function ct_pay_private.prevent_posted_transaction_mutation();

create or replace function ct_pay_private.prevent_audit_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, ct_pay_private
as $$
begin
  raise exception 'Financial audit events are append-only'
    using errcode = '55000';
end;
$$;

create trigger ct_pay_audit_events_immutable
before update or delete on ct_pay_private.financial_audit_events
for each row execute function ct_pay_private.prevent_audit_event_mutation();
