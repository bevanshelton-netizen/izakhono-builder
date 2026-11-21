-- Authenticated organization directory and owner onboarding grants for I-CONNECT.
create or replace function public.ic_list_my_organizations()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_organizations jsonb;
begin
  if v_user_id is null then
    raise exception 'authenticated_user_required' using errcode = '28000';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'organizationId', o.id,
        'name', o.name,
        'slug', o.slug,
        'status', o.status,
        'role', m.role
      ) order by o.name
    ),
    '[]'::jsonb
  )
  into v_organizations
  from public.ic_memberships m
  join public.ic_organizations o on o.id = m.organization_id
  where m.user_id = v_user_id
    and m.status = 'active';

  return jsonb_build_object('organizations', v_organizations);
end;
$function$;

revoke all on function public.ic_list_my_organizations() from public, anon;
grant execute on function public.ic_list_my_organizations() to authenticated;

revoke all on function public.ic_create_owner_organization(text,text,text,text) from public, anon;
grant execute on function public.ic_create_owner_organization(text,text,text,text) to authenticated;
