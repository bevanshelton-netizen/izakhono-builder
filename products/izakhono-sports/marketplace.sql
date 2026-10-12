-- IZAKHONO SPORTS Sponsorship Marketplace v2
create table if not exists marketplace_offers (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references sponsorship_inventory(id),
  campaign_id uuid not null references sponsor_campaigns(id),
  proposed_value numeric not null check (proposed_value >= 0),
  currency_code char(3) not null,
  message text,
  status text not null default 'submitted' check (status in ('submitted','countered','accepted','rejected','withdrawn','expired')),
  decision_message text,
  created_by uuid references users(id),
  decided_by uuid references users(id),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists idx_marketplace_offers_inventory on marketplace_offers(inventory_id);
create index if not exists idx_marketplace_offers_campaign on marketplace_offers(campaign_id);
create index if not exists idx_marketplace_offers_status on marketplace_offers(status);

create table if not exists sponsorship_contracts (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid unique not null references marketplace_offers(id),
  inventory_id uuid not null references sponsorship_inventory(id),
  campaign_id uuid not null references sponsor_campaigns(id),
  owner_organisation_id uuid not null references organisations(id),
  sponsor_organisation_id uuid not null references organisations(id),
  contracted_value numeric not null check (contracted_value >= 0),
  currency_code char(3) not null,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','active','completed','cancelled')),
  terms jsonb not null default '{}',
  signed_by_owner uuid references users(id),
  signed_by_sponsor uuid references users(id),
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sponsorship_contracts_campaign on sponsorship_contracts(campaign_id);
create index if not exists idx_sponsorship_contracts_status on sponsorship_contracts(status);
