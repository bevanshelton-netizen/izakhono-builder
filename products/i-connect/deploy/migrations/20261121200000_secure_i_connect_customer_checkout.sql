-- Customer-owned I-CONNECT checkout intents and state reads.
-- SECURITY DEFINER is paired with auth.uid() ownership checks and narrow EXECUTE grants.

create or replace function public.ic_prepare_checkout_intent_for_customer(
  p_product_code text,
  p_customer_name text default null,
  p_customer_email text default null,
  p_requested_slug text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_product public.ic_product_catalog%rowtype;
  v_id uuid;
  v_ref text;
begin
  if v_user_id is null then
    raise exception 'authenticated_user_required' using errcode = '28000';
  end if;
  if nullif(btrim(p_product_code), '') is null
     or nullif(btrim(p_customer_name), '') is null
     or length(btrim(p_customer_name)) > 160
     or nullif(btrim(p_customer_email), '') is null
     or length(btrim(p_customer_email)) > 254
     or btrim(p_customer_email) !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
     or (p_requested_slug is not null and length(btrim(p_requested_slug)) > 80) then
    raise exception 'invalid_checkout_details' using errcode = '22023';
  end if;

  select * into v_product
    from public.ic_product_catalog
   where code = btrim(p_product_code) and active = true
   limit 1;
  if not found then raise exception 'PRODUCT_NOT_AVAILABLE'; end if;

  v_ref := 'IZ-' || upper(replace(btrim(p_product_code), '_', '-')) || '-' || substr(gen_random_uuid()::text,1,12);
  insert into public.ic_checkout_intents(
    product_id, customer_name, customer_email, requested_slug,
    amount, currency, status, external_reference, metadata
  ) values (
    v_product.id, btrim(p_customer_name), lower(btrim(p_customer_email)),
    nullif(btrim(p_requested_slug), ''),
    v_product.price, v_product.currency, 'created', v_ref,
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('created_by',v_user_id,'checkout_channel','customer_api')
  ) returning id into v_id;

  return jsonb_build_object(
    'intent_id', v_id,
    'external_reference', v_ref,
    'product_code', v_product.code,
    'product_name', v_product.name,
    'amount', v_product.price,
    'currency', v_product.currency,
    'status', 'created',
    'payment_ready', false,
    'reason', 'Payment provider connection must be configured before a live checkout session can be created.'
  );
end;
$function$;

create or replace function public.ic_checkout_state_for_customer(p_checkout_intent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_owner text;
begin
  if v_user_id is null then
    raise exception 'authenticated_user_required' using errcode = '28000';
  end if;
  select metadata->>'created_by'
    into v_owner
    from public.ic_checkout_intents
   where id = p_checkout_intent_id;
  if not found then
    return jsonb_build_object('state','not_found','message','Checkout intent not found.');
  end if;
  if v_owner is distinct from v_user_id::text then
    raise exception 'checkout_intent_not_owned' using errcode = '42501';
  end if;
  return public.ic_customer_checkout_state(p_checkout_intent_id) - 'external_reference';
end;
$function$;

revoke all on function public.ic_prepare_checkout_intent_for_customer(text,text,text,text,jsonb) from public, anon;
revoke all on function public.ic_checkout_state_for_customer(uuid) from public, anon;
grant execute on function public.ic_prepare_checkout_intent_for_customer(text,text,text,text,jsonb) to authenticated;
grant execute on function public.ic_checkout_state_for_customer(uuid) to authenticated;
