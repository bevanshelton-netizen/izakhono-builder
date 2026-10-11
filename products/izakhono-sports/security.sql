-- IZAKHONO SPORTS security and audit foundation v1
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text unique not null,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),
  organisation_id uuid references organisations(id),
  action text not null,
  resource_type text not null,
  resource_id text,
  request_id text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_user on sessions(user_id);
create index if not exists idx_sessions_expiry on sessions(expires_at);
create index if not exists idx_api_keys_org on api_keys(organisation_id);
create index if not exists idx_audit_org_created on audit_logs(organisation_id, created_at desc);
create index if not exists idx_audit_resource on audit_logs(resource_type, resource_id);
