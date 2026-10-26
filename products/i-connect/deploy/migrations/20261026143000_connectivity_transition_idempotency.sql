alter table public.ic_connectivity_events add column if not exists idempotency_key text;

update public.ic_connectivity_events
set idempotency_key = nullif(metadata->>'idempotencyKey','')
where idempotency_key is null
  and nullif(metadata->>'idempotencyKey','') is not null;

create unique index if not exists ic_connectivity_events_service_idempotency_key_uidx
  on public.ic_connectivity_events(service_id,idempotency_key)
  where idempotency_key is not null;

create or replace function public.ic_transition_connectivity_service(
  p_service_id uuid,
  p_to_state text,
  p_reason text default null,
  p_provider text default null,
  p_external_reference text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.ic_connectivity_services
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_service public.ic_connectivity_services;
  v_from text;
  v_idempotency_key text;
  v_inserted integer;
begin
  select * into v_service from public.ic_connectivity_services where id = p_service_id for update;
  if not found then raise exception 'connectivity_service_not_found'; end if;

  if auth.uid() is not null and not ic_private.has_role(v_service.organization_id,array['owner','admin','manager']) then
    raise exception 'not_authorized';
  end if;

  v_idempotency_key := nullif(p_metadata->>'idempotencyKey','');
  if v_idempotency_key is not null and exists (
    select 1 from public.ic_connectivity_events
    where service_id = p_service_id and idempotency_key = v_idempotency_key
  ) then
    return v_service;
  end if;

  v_from := v_service.lifecycle_state;
  if not ic_private.valid_connectivity_transition(v_from,p_to_state) then
    raise exception 'invalid_connectivity_transition:%->%',v_from,p_to_state;
  end if;

  update public.ic_connectivity_services
    set lifecycle_state = p_to_state,
        provider = coalesce(p_provider,provider),
        external_subscriber_ref = coalesce(p_external_reference,external_subscriber_ref),
        metadata = coalesce(p_metadata,metadata),
        updated_at = now()
  where id = p_service_id
  returning * into v_service;

  insert into public.ic_connectivity_events(
    service_id,organization_id,from_state,to_state,reason,provider,external_reference,metadata,idempotency_key
  )
  values (
    v_service.id,v_service.organization_id,v_from,p_to_state,p_reason,v_service.provider,
    v_service.external_subscriber_ref,coalesce(p_metadata,'{}'::jsonb),v_idempotency_key
  )
  on conflict (service_id,idempotency_key) where idempotency_key is not null do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 and v_idempotency_key is not null then
    select * into v_service from public.ic_connectivity_services where id = p_service_id;
  end if;

  return v_service;
end;
$function$;
