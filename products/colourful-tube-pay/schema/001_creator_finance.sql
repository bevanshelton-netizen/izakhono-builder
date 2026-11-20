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
