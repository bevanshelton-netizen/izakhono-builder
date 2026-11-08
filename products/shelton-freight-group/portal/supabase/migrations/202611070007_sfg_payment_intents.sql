-- SHELTON FREIGHT GROUP — payment intents and provider event ledger
begin;

create table if not exists public.sfg_payment_intents (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.sfg_financial_documents(id) on delete restrict,
  customer_id uuid not null references public.sfg_customers(id) on delete restrict,
  provider text not null check (provider in ('ikhokha')),
  external_transaction_id text not null unique,
  provider_paylink_id text unique,
  checkout_url text,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null check (currency='ZAR'),
  payment_status text not null default 'pending'
    check (payment_status in ('pending','paid','failed','cancelled','expired','review_required')),
  provider_response_code text,
  provider_message text,
  paid_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sfg_payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_key text not null unique,
  external_transaction_id text,
  provider_paylink_id text,
  event_status text,
  response_code text,
  signature_verified boolean not null default false,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_result text
);

create index if not exists sfg_payment_intents_document_idx on public.sfg_payment_intents(document_id,created_at desc);
create index if not exists sfg_payment_intents_customer_idx on public.sfg_payment_intents(customer_id,created_at desc);
create index if not exists sfg_payment_events_external_idx on public.sfg_payment_provider_events(external_transaction_id);

alter table public.sfg_payment_intents enable row level security;
alter table public.sfg_payment_provider_events enable row level security;
revoke all on public.sfg_payment_intents from anon,authenticated;
revoke all on public.sfg_payment_provider_events from anon,authenticated;
grant all on public.sfg_payment_intents to service_role;
grant all on public.sfg_payment_provider_events to service_role;

create or replace function public.sfg_touch_payment_intent_updated_at()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin new.updated_at=now(); return new; end;
$$;
drop trigger if exists sfg_payment_intent_updated_at on public.sfg_payment_intents;
create trigger sfg_payment_intent_updated_at before update on public.sfg_payment_intents
for each row execute function public.sfg_touch_payment_intent_updated_at();

create unique index if not exists sfg_financial_entries_payment_reference_uidx
  on public.sfg_financial_entries(payment_reference)
  where payment_reference is not null;

create or replace function public.sfg_confirm_ikhokha_payment(
  p_intent_id uuid,
  p_event_id uuid,
  p_external_transaction_id text,
  p_paylink_id text,
  p_provider_status text,
  p_response_code text
)
returns text
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_intent public.sfg_payment_intents%rowtype;
  v_event public.sfg_payment_provider_events%rowtype;
  v_document public.sfg_financial_documents%rowtype;
  v_received numeric(14,2);
begin
  select * into v_event from public.sfg_payment_provider_events
  where id = p_event_id
    and provider = 'ikhokha'
    and signature_verified = true
    and external_transaction_id is not distinct from p_external_transaction_id
    and provider_paylink_id is not distinct from p_paylink_id
    and event_status is not distinct from p_provider_status
    and response_code is not distinct from p_response_code
  for update;
  if not found then raise exception 'Verified matching iKhokha event not found'; end if;

  select * into v_intent from public.sfg_payment_intents
  where id=p_intent_id for update;
  if not found then raise exception 'Payment intent not found'; end if;
  if v_intent.external_transaction_id<>p_external_transaction_id
     or v_intent.provider_paylink_id<>p_paylink_id then
    raise exception 'Payment identifiers do not match';
  end if;

  select * into v_document
  from public.sfg_financial_documents
  where id=v_intent.document_id
  for update;
  if not found then raise exception 'Linked financial document not found'; end if;
  if v_document.document_type<>'customer_invoice'
     or v_document.customer_id is distinct from v_intent.customer_id then
    raise exception 'Payment intent customer/document mismatch';
  end if;
  if v_document.currency<>'ZAR' or v_intent.currency<>v_document.currency then
    raise exception 'Payment currency does not match invoice currency';
  end if;
  if v_intent.amount<=0 or v_intent.amount>v_document.amount then
    raise exception 'Payment amount is outside the invoice amount range';
  end if;

  if p_provider_status='SUCCESS' and p_response_code='00' then
    if v_intent.payment_status='paid' then
      update public.sfg_payment_provider_events
      set processed_at=now(),processing_result='duplicate_already_paid'
      where id=p_event_id;
      return 'already_paid';
    end if;
    if v_intent.payment_status<>'pending' then
      update public.sfg_payment_intents set payment_status='review_required' where id=v_intent.id;
      update public.sfg_payment_provider_events
      set processed_at=now(),processing_result='success_event_for_non_pending_intent'
      where id=p_event_id;
      return 'review_required';
    end if;

    select coalesce(sum(
      case when entry_type='payment_received' then amount
           when entry_type='refund_issued' then -amount
           else 0 end
    ),0)::numeric(14,2)
    into v_received
    from public.sfg_financial_entries
    where document_id=v_document.id;
    if v_received + v_intent.amount > v_document.amount then
      update public.sfg_payment_intents set payment_status='review_required' where id=v_intent.id;
      update public.sfg_payment_provider_events
      set processed_at=now(),processing_result='invoice_overpayment_blocked'
      where id=p_event_id;
      return 'review_required';
    end if;

    insert into public.sfg_financial_entries(
      document_id,entry_type,amount,transaction_date,payment_method,payment_reference,notes
    ) values (
      v_intent.document_id,'payment_received',v_intent.amount,current_date,'iKhokha',
      v_intent.external_transaction_id,'Confirmed by signed iKhokha payment callback'
    ) on conflict (payment_reference) where payment_reference is not null do nothing;

    update public.sfg_payment_intents
    set payment_status='paid',paid_at=now(),provider_response_code=p_response_code
    where id=v_intent.id;
    update public.sfg_payment_provider_events
    set processed_at=now(),processing_result='payment_confirmed'
    where id=p_event_id;
    return 'paid';
  elsif p_provider_status='FAILURE' then
    update public.sfg_payment_intents
    set payment_status='failed',provider_response_code=p_response_code
    where id=v_intent.id and payment_status='pending';
    update public.sfg_payment_provider_events
    set processed_at=now(),processing_result='payment_failed'
    where id=p_event_id;
    return 'failed';
  else
    update public.sfg_payment_intents set payment_status='review_required'
    where id=v_intent.id and payment_status='pending';
    update public.sfg_payment_provider_events
    set processed_at=now(),processing_result='unknown_status_review'
    where id=p_event_id;
    return 'review_required';
  end if;
end;
$$;

revoke all on function public.sfg_confirm_ikhokha_payment(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.sfg_confirm_ikhokha_payment(uuid,uuid,text,text,text,text) to service_role;

commit;
