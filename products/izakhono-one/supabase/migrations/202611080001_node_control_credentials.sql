grant usage on schema one to service_role;
grant select, insert, update on table one.node_registry to service_role;
grant insert on table one.node_events to service_role;

create table if not exists one.node_control_credentials (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  label text not null default 'shelton-freight-group',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists one.node_agent_credentials (
  node_id text primary key references one.node_registry(node_id) on delete cascade,
  token_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table one.node_control_credentials enable row level security;
alter table one.node_agent_credentials enable row level security;

revoke all on table one.node_control_credentials from anon, authenticated;
revoke all on table one.node_agent_credentials from anon, authenticated;

grant select, insert, update on table one.node_control_credentials to service_role;
grant select, insert, update on table one.node_agent_credentials to service_role;
