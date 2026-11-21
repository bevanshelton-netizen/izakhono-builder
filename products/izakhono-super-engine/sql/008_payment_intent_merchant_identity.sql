-- Bind every durable payment intent and fulfillment job to one immutable merchant.
-- Existing records are deliberately not assigned a guessed merchant. If any exist,
-- this migration aborts and requires an operator-reviewed, evidence-backed backfill.
alter table iz_payment_intents
  add column if not exists merchant_id text;

alter table iz_payment_intents
  add column if not exists service_id text;

do $$
begin
  if exists (select 1 from iz_payment_intents where merchant_id is null or btrim(merchant_id) = '' or service_id is null or btrim(service_id) = '') then
    raise exception 'Payment merchant identity migration blocked: existing payment intents require an evidence-backed merchant mapping';
  end if;
  if exists (
    select 1
    from iz_fulfillment_jobs f
    left join iz_payment_intents p on p.id = f.payment_intent_id
    where p.id is null or p.merchant_id is null or p.service_id is null or f.merchant_id <> p.merchant_id or f.service_id <> p.service_id
  ) then
    raise exception 'Payment merchant identity migration blocked: existing fulfillment ownership does not match its payment intent';
  end if;
end $$;

alter table iz_payment_intents
  alter column merchant_id set not null,
  alter column service_id set not null;

create unique index if not exists iz_payment_intents_id_merchant_service_uq
  on iz_payment_intents(id, merchant_id, service_id);

alter table iz_fulfillment_jobs
  drop constraint if exists iz_fulfillment_jobs_payment_intent_id_fkey;

alter table iz_fulfillment_jobs
  drop constraint if exists iz_fulfillment_jobs_payment_intent_merchant_fkey;

alter table iz_fulfillment_jobs
  add constraint iz_fulfillment_jobs_payment_intent_merchant_fkey
  foreign key (payment_intent_id, merchant_id, service_id)
  references iz_payment_intents(id, merchant_id, service_id);
