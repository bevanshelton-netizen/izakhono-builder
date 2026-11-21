-- Restrict the exposed identity schema to service_role and keep evidence private.
begin;
do $$ declare t text; begin
 foreach t in array array['subjects','verification_cases','evidence','subject_relationships','screenings','consent_grants','decisions','audit_events'] loop
  execute format('drop policy if exists identity_service_role_all on identity.%I',t);
  execute format('create policy identity_service_role_all on identity.%I for all to service_role using (true) with check (true)',t);
 end loop;
end $$;
alter role authenticator set pgrst.db_schemas = 'public,graphql_public,storage,identity';
notify pgrst, 'reload config';
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('identity-evidence','identity-evidence',false,10485760,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
commit;
