-- IZAKHONO MAIL durable control-plane schema.
-- Applied to the IZAKHONO WebStart Supabase project.

create table if not exists public.iz_mail_messages (
  message_id text primary key,
  tenant_id text not null,
  app_id text not null,
  status text not null default 'queued',
  envelope jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists iz_mail_messages_tenant_created_idx
  on public.iz_mail_messages (tenant_id, created_at desc);
create index if not exists iz_mail_messages_app_created_idx
  on public.iz_mail_messages (app_id, created_at desc);

create table if not exists public.iz_mail_events (
  id text primary key,
  message_id text not null references public.iz_mail_messages(message_id) on delete cascade,
  tenant_id text not null,
  recipient_id text,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists iz_mail_events_message_time_idx
  on public.iz_mail_events (message_id, occurred_at asc);
create index if not exists iz_mail_events_tenant_time_idx
  on public.iz_mail_events (tenant_id, occurred_at desc);

create table if not exists public.iz_mail_idempotency (
  scope text not null,
  key text not null,
  tenant_id text not null,
  fingerprint text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (scope, key)
);

create index if not exists iz_mail_idempotency_tenant_idx
  on public.iz_mail_idempotency (tenant_id, created_at desc);

alter table public.iz_mail_messages enable row level security;
alter table public.iz_mail_events enable row level security;
alter table public.iz_mail_idempotency enable row level security;

revoke all on table public.iz_mail_messages from anon, authenticated;
revoke all on table public.iz_mail_events from anon, authenticated;
revoke all on table public.iz_mail_idempotency from anon, authenticated;

grant all on table public.iz_mail_messages to service_role;
grant all on table public.iz_mail_events to service_role;
grant all on table public.iz_mail_idempotency to service_role;

create policy iz_mail_messages_no_anon_select on public.iz_mail_messages for select to anon using (false);
create policy iz_mail_messages_no_auth_select on public.iz_mail_messages for select to authenticated using (false);
create policy iz_mail_events_no_anon_select on public.iz_mail_events for select to anon using (false);
create policy iz_mail_events_no_auth_select on public.iz_mail_events for select to authenticated using (false);
create policy iz_mail_idempotency_no_anon_select on public.iz_mail_idempotency for select to anon using (false);
create policy iz_mail_idempotency_no_auth_select on public.iz_mail_idempotency for select to authenticated using (false);

comment on table public.iz_mail_messages is 'IZAKHONO MAIL durable message control-plane records';
comment on table public.iz_mail_events is 'IZAKHONO MAIL append-only delivery event ledger';
comment on table public.iz_mail_idempotency is 'IZAKHONO MAIL durable idempotency claims and replay responses';
