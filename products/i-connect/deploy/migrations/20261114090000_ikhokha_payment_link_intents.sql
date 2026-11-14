-- I-CONNECT / IZAKHONO PAY: single-use iKhokha payment-link intent
create table if not exists public.pay_ikhokha_payment_link_intents (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.pay_payment_transactions(id),
  provider_connection_id uuid not null references public.pay_provider_connections(id),
  external_transaction_id text not null unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  state text not null default 'prepared' check (state in ('prepared','creating','created','manual_review')),
  paylink_id text unique,
  paylink_url text,
  request_payload_hash text,
  provider_response_code text,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_provider_at timestamptz,
  constraint pay_ikhokha_link_created_fields check (
    state <> 'created' or (paylink_id is not null and paylink_url is not null and provider_response_code = '00')
  )
);
alter table public.pay_ikhokha_payment_link_intents enable row level security;
revoke all on public.pay_ikhokha_payment_link_intents from anon, authenticated;
grant select, insert, update, delete on public.pay_ikhokha_payment_link_intents to service_role;

create or replace function public.pay_ikhokha_prepare_payment_link(p_transaction_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  t public.pay_payment_transactions%rowtype;
  pc public.pay_provider_connections%rowtype;
  i public.pay_ikhokha_payment_link_intents%rowtype;
  minor numeric;
begin
  select * into t from public.pay_payment_transactions where id=p_transaction_id for update;
  if not found then raise exception 'transaction_not_found'; end if;
  if t.status not in ('created','pending') then raise exception 'transaction_not_eligible'; end if;
  if t.merchant_account_id is null then raise exception 'merchant_account_missing'; end if;
  select * into pc from public.pay_provider_connections
   where provider='ikhokha' and merchant_account_id=t.merchant_account_id
     and status in ('ready','active') order by created_at desc limit 1;
  if not found then raise exception 'ikhokha_connection_not_ready'; end if;
  if coalesce((pc.capabilities->>'checkout')::boolean,false) is not true then
    raise exception 'ikhokha_checkout_capability_not_confirmed';
  end if;
  minor := t.amount * 100;
  if minor <> trunc(minor) or minor <= 0 or minor > 9007199254740991 then
    raise exception 'transaction_amount_not_valid_minor_units';
  end if;
  insert into public.pay_ikhokha_payment_link_intents
    (transaction_id,provider_connection_id,external_transaction_id,amount_minor,currency)
  values (t.id,pc.id,t.external_reference,minor::bigint,upper(t.currency))
  on conflict (transaction_id) do nothing;
  select * into i from public.pay_ikhokha_payment_link_intents where transaction_id=t.id for update;
  if i.provider_connection_id <> pc.id or i.external_transaction_id <> t.external_reference
     or i.amount_minor <> minor::bigint or i.currency <> upper(t.currency) then
    raise exception 'immutable_payment_intent_mismatch';
  end if;
  update public.pay_payment_transactions set provider_connection_id=pc.id where id=t.id and provider_connection_id is null;
  if t.provider_connection_id is not null and t.provider_connection_id <> pc.id then
    raise exception 'transaction_provider_connection_mismatch';
  end if;
  return jsonb_build_object('intent_id',i.id,'transaction_id',i.transaction_id,
    'external_transaction_id',i.external_transaction_id,'amount_minor',i.amount_minor,
    'currency',i.currency,'state',i.state);
end; $$;

create or replace function public.pay_ikhokha_claim_payment_link(p_intent_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare i public.pay_ikhokha_payment_link_intents%rowtype;
begin
  select * into i from public.pay_ikhokha_payment_link_intents where id=p_intent_id for update;
  if not found then raise exception 'payment_link_intent_not_found'; end if;
  if i.state <> 'prepared' then
    return jsonb_build_object('claimed',false,'state',i.state,'reason','intent_not_claimable');
  end if;
  update public.pay_ikhokha_payment_link_intents set state='creating',updated_at=now() where id=i.id;
  return jsonb_build_object('claimed',true,'intent_id',i.id,'transaction_id',i.transaction_id,
    'external_transaction_id',i.external_transaction_id,'amount_minor',i.amount_minor,
    'currency',i.currency,'provider_connection_id',i.provider_connection_id);
end; $$;

create or replace function public.pay_ikhokha_finalize_payment_link(
  p_intent_id uuid,p_paylink_id text,p_paylink_url text,p_response_code text,p_request_payload_hash text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare i public.pay_ikhokha_payment_link_intents%rowtype;
begin
  select * into i from public.pay_ikhokha_payment_link_intents where id=p_intent_id for update;
  if not found then raise exception 'payment_link_intent_not_found'; end if;
  if i.state <> 'creating' then raise exception 'payment_link_intent_not_creating'; end if;
  if p_response_code <> '00' or nullif(btrim(p_paylink_id),'') is null
     or p_paylink_url !~ '^https://securepay[.]ikhokha[.]red/' then
    update public.pay_ikhokha_payment_link_intents
      set state='manual_review',failure_code='provider_response_invalid',updated_at=now()
      where id=i.id;
    raise exception 'provider_payment_link_response_invalid';
  end if;
  update public.pay_ikhokha_payment_link_intents
    set state='created',paylink_id=p_paylink_id,paylink_url=p_paylink_url,
        provider_response_code=p_response_code,request_payload_hash=p_request_payload_hash,
        created_provider_at=now(),updated_at=now()
    where id=i.id;
  update public.pay_payment_transactions
    set provider_payment_id=p_paylink_id,
        provider_status='payment_link_created',
        status='pending',
        metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
          'ikhokha_paylink_id',p_paylink_id,'ikhokha_paylink_url',p_paylink_url,
          'ikhokha_intent_id',i.id,'ikhokha_intent_currency',i.currency,
          'ikhokha_intent_amount_minor',i.amount_minor
        ),
        updated_at=now()
    where id=i.transaction_id and (provider_payment_id is null or provider_payment_id=p_paylink_id);
  if not found then raise exception 'transaction_paylink_persistence_conflict'; end if;
  return jsonb_build_object('state','created','intent_id',i.id,'paylink_id',p_paylink_id);
end; $$;

create or replace function public.pay_ikhokha_mark_link_manual_review(p_intent_id uuid,p_failure_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  update public.pay_ikhokha_payment_link_intents
    set state='manual_review',failure_code=left(coalesce(p_failure_code,'unknown_failure'),120),updated_at=now()
    where id=p_intent_id and state='creating';
  return jsonb_build_object('state','manual_review','intent_id',p_intent_id);
end; $$;

revoke all on function public.pay_ikhokha_prepare_payment_link(uuid) from public,anon,authenticated;
revoke all on function public.pay_ikhokha_claim_payment_link(uuid) from public,anon,authenticated;
revoke all on function public.pay_ikhokha_finalize_payment_link(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.pay_ikhokha_mark_link_manual_review(uuid,text) from public,anon,authenticated;
grant execute on function public.pay_ikhokha_prepare_payment_link(uuid) to service_role;
grant execute on function public.pay_ikhokha_claim_payment_link(uuid) to service_role;
grant execute on function public.pay_ikhokha_finalize_payment_link(uuid,text,text,text,text) to service_role;
grant execute on function public.pay_ikhokha_mark_link_manual_review(uuid,text) to service_role;
