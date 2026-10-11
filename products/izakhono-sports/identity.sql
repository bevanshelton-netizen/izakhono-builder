-- IZAKHONO SPORTS identity & tenant provisioning v1
create table if not exists provisioning_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null,
  organisation_name text not null,
  organisation_type text not null check (organisation_type in ('club','academy','school','league','federation','venue','agency','sponsor','media','other')),
  country_code char(2),
  currency_code char(3) not null default 'ZAR',
  status text not null default 'pending' check (status in ('pending','provisioned','cancelled')),
  created_at timestamptz not null default now(),
  provisioned_at timestamptz
);

create table if not exists organisation_invitations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  email text not null,
  role text not null,
  token_hash text unique not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_provisioning_email on provisioning_requests(email);
create index if not exists idx_provisioning_status on provisioning_requests(status);
create index if not exists idx_org_invites_email on organisation_invitations(email);
create index if not exists idx_org_invites_expiry on organisation_invitations(expires_at);
