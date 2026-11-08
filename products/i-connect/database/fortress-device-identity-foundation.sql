-- FORTRESS device identity foundation v1
create schema if not exists fortress_private;
revoke all on schema fortress_private from public, anon, authenticated;
grant usage on schema fortress_private to service_role;

create table if not exists public.fortress_device_registry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_fingerprint text not null,
  public_key_spki text not null,
  device_label text,
  platform text not null check (platform in ('android','ios','web','other')),
  status text not null default 'active' check (status in ('pending','active','revoked','blocked')),
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  unique (user_id, key_fingerprint)
);
create index if not exists fortress_device_registry_user_status_idx on public.fortress_device_registry(user_id, status);

create table if not exists public.fortress_device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.fortress_device_registry(id) on delete cascade,
  auth_session_id uuid not null unique,
  created_at timestamptz not null default now(),
  last_validated_at timestamptz,
  revoked_at timestamptz
);
create index if not exists fortress_device_sessions_user_device_idx on public.fortress_device_sessions(user_id, device_id);

create table if not exists public.fortress_device_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  auth_session_id uuid not null,
  key_fingerprint text not null,
  challenge_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists fortress_device_challenges_expiry_idx on public.fortress_device_challenges(expires_at) where consumed_at is null;

create table if not exists public.fortress_security_audit (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  device_id uuid references public.fortress_device_registry(id) on delete set null,
  event_type text not null,
  outcome text not null check (outcome in ('allowed','denied','completed','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists fortress_security_audit_user_time_idx on public.fortress_security_audit(user_id, created_at desc);

alter table public.fortress_device_registry enable row level security;
alter table public.fortress_device_sessions enable row level security;
alter table public.fortress_device_challenges enable row level security;
alter table public.fortress_security_audit enable row level security;

revoke all on public.fortress_device_registry from public, anon, authenticated;
revoke all on public.fortress_device_sessions from public, anon, authenticated;
revoke all on public.fortress_device_challenges from public, anon, authenticated;
revoke all on public.fortress_security_audit from public, anon, authenticated;
grant all on public.fortress_device_registry to service_role;
grant all on public.fortress_device_sessions to service_role;
grant all on public.fortress_device_challenges to service_role;
grant all on public.fortress_security_audit to service_role;
grant usage, select on sequence public.fortress_security_audit_id_seq to service_role;

create or replace function public.fortress_auth_session_is_active(p_user_id uuid, p_session_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.sessions s
    where s.user_id = p_user_id and s.id = p_session_id
      and (s.not_after is null or s.not_after > now())
  );
$$;
revoke all on function public.fortress_auth_session_is_active(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fortress_auth_session_is_active(uuid, uuid) to service_role;
