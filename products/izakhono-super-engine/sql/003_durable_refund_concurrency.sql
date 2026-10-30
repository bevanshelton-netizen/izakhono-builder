-- Durable refund concurrency contract.
-- A payment intent may have only one non-terminal refund operation at a time.
-- The reservation is created before provider execution and completed/fails explicitly.

create table if not exists iz_payment_refund_operations (
  id text primary key,
  payment_intent_id text not null references iz_payment_intents(id),
  refund_id text not null unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  status text not null check (status in ('requested','processing','succeeded','failed')),
  provider_refund_id text,
  reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists iz_payment_refund_active_idx
  on iz_payment_refund_operations(payment_intent_id)
  where status in ('requested','processing');

create index if not exists iz_payment_refund_payment_idx
  on iz_payment_refund_operations(payment_intent_id, created_at);

create unique index if not exists iz_payment_refund_provider_idx
  on iz_payment_refund_operations(provider_refund_id)
  where provider_refund_id is not null;

alter table iz_payment_refund_operations enable row level security;

-- Atomic state transition for payment lifecycle operations. The expected current
-- status is part of the UPDATE predicate, so stale concurrent workers cannot win.
create or replace function iz_transition_payment_state(
  p_payment_intent_id text,
  p_expected_status text,
  p_new_status text
)
returns iz_payment_intents
language plpgsql
security invoker
set search_path = public
as $$
declare
  result iz_payment_intents;
begin
  if p_expected_status is null or p_new_status is null then
    raise exception 'Payment transition statuses are required';
  end if;

  update iz_payment_intents
     set status = p_new_status,
         updated_at = now()
   where id = p_payment_intent_id
     and status = p_expected_status
  returning * into result;

  if not found then
    raise exception 'Payment state transition rejected: expected %, payment changed concurrently', p_expected_status;
  end if;

  return result;
end;
$$;

revoke all on function iz_transition_payment_state(text, text, text) from public;
