-- iKhokha signed webhook receipt is not payment approval.
-- Persist/deduplicate verified callbacks and defer all payment-state changes until
-- a dedicated authoritative provider-status reconciler verifies identifiers,
-- amount and currency against the stored transaction.
create or replace function public.pay_verify_provider_event(
  p_provider text,
  p_external_event_id text,
  p_signature_verified boolean,
  p_payload_hash text,
  p_event_type text,
  p_payment_id text,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_event_id uuid;
  v_existing uuid;
  v_existing_hash text;
  v_result jsonb;
begin
  if coalesce(trim(p_provider),'')='' then raise exception 'provider required'; end if;
  if p_provider not in ('ikhokha','payfast','stripe') then raise exception 'unsupported provider'; end if;
  if coalesce(trim(p_external_event_id),'')='' then raise exception 'external event id required'; end if;
  if coalesce(trim(p_payload_hash),'')='' then raise exception 'payload hash required'; end if;
  if not coalesce(p_signature_verified,false) then
    return jsonb_build_object('accepted',false,'reason','signature_not_verified');
  end if;

  select id,payload_hash into v_existing,v_existing_hash
  from public.pay_provider_events
  where provider=p_provider and external_event_id=p_external_event_id
  limit 1;

  if v_existing is not null then
    if coalesce(v_existing_hash,'') <> p_payload_hash then
      return jsonb_build_object('accepted',false,'reason','event_payload_conflict','event_id',v_existing);
    end if;
    if p_provider = 'ikhokha' then
      return jsonb_build_object('accepted',true,'duplicate',true,'event_id',v_existing,'processing',jsonb_build_object('status','awaiting_authoritative_reconciliation'));
    end if;
    v_result := public.pay_process_verified_provider_event(v_existing);
    return jsonb_build_object('accepted',true,'duplicate',true,'event_id',v_existing,'processing',v_result);
  end if;

  insert into public.pay_provider_events(provider,external_event_id,event_type,payment_id,signature_verified,payload_hash,status)
  values(p_provider,p_external_event_id,p_event_type,p_payment_id,true,p_payload_hash,'received')
  returning id into v_event_id;

  if p_provider = 'ikhokha' then
    return jsonb_build_object('accepted',true,'duplicate',false,'event_id',v_event_id,'processing',jsonb_build_object('status','awaiting_authoritative_reconciliation'));
  end if;

  v_result := public.pay_process_verified_provider_event(v_event_id);
  return jsonb_build_object('accepted',true,'duplicate',false,'event_id',v_event_id,'processing',v_result);
end;
$function$;
