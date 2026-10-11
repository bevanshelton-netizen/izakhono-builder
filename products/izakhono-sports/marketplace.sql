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
