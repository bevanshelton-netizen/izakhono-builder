-- Prevent the legacy iKhokha retry RPC from treating a signed webhook as payment proof.
-- The webhook callback omits authoritative amount/currency; only a future dedicated
-- status reconciler may move a transaction to paid or release fulfilment.
create or replace function public.pay_retry_ikhokha_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_event public.pay_provider_events%rowtype;
begin
  select * into v_event
  from public.pay_provider_events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'provider event not found';
  end if;
  if v_event.provider <> 'ikhokha' then
    raise exception 'provider is not ikhokha';
  end if;
  if not coalesce(v_event.signature_verified,false) then
    raise exception 'event signature not verified';
  end if;
  if v_event.status = 'processed' then
    return jsonb_build_object('status','already_processed','event_id',p_event_id);
  end if;

  return jsonb_build_object(
    'status','awaiting_authoritative_reconciliation',
    'event_id',p_event_id,
    'fulfilment_released',false,
    'reason','legacy_retry_disabled_until_authoritative_status_lookup'
  );
end;
$function$;
