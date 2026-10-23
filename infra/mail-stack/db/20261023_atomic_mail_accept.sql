-- IZAKHONO MAIL atomic acceptance boundary.
-- Inserts the durable message, queued event and idempotency claim and
-- publishes the PGMQ delivery job in the same Postgres transaction.

create schema if not exists izakhono_mail;

revoke all on schema izakhono_mail from public, anon, authenticated;
grant usage on schema izakhono_mail to service_role;

drop function if exists izakhono_mail.accept_and_enqueue(text, text, text, text, text, text, jsonb, jsonb, jsonb, timestamptz);

create or replace function izakhono_mail.accept_and_enqueue(
  p_scope text,
  p_idempotency_key text,
  p_fingerprint text,
  p_message_id text,
  p_event_id text,
  p_tenant_id text,
  p_app_id text,
  p_kind text,
  p_envelope jsonb,
  p_metadata jsonb,
  p_accepted_at timestamptz
)
returns table (
  inserted boolean,
  message_id text,
  event_id text,
  fingerprint text,
  response jsonb,
  queue_msg_id bigint
)
language plpgsql
set search_path = public, pg_catalog, pgmq, izakhono_mail
as $$
declare
  existing public.iz_mail_idempotency%rowtype;
  response_payload jsonb;
  queue_id bigint;
begin
  select * into existing
    from public.iz_mail_idempotency
   where scope = p_scope and key = p_idempotency_key
   for update;

  if found then
    return query
      select false,
             null::text,
             null::text,
             existing.fingerprint,
             existing.response,
             null::bigint;
    return;
  end if;

  response_payload := jsonb_build_object(
    'message_id', p_message_id,
    'event_id', p_event_id,
    'status', 'queued',
    'accepted_at', p_accepted_at
  );

  insert into public.iz_mail_messages (
    message_id, tenant_id, app_id, status, envelope, metadata, created_at, updated_at
  ) values (
    p_message_id, p_tenant_id, p_app_id, 'queued', coalesce(p_envelope, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb), p_accepted_at, p_accepted_at
  );

  insert into public.iz_mail_events (
    id, message_id, tenant_id, type, data, occurred_at
  ) values (
    p_event_id, p_message_id, p_tenant_id, 'mail.queued',
    jsonb_build_object('app_id', p_app_id), p_accepted_at
  );

  insert into public.iz_mail_idempotency (
    scope, key, tenant_id, fingerprint, response, created_at
  ) values (
    p_scope, p_idempotency_key, p_tenant_id, p_fingerprint, response_payload, p_accepted_at
  );

  select pgmq.send(
    'izakhono_mail_outbox',
    jsonb_build_object(
      'message_id', p_message_id,
      'event_id', p_event_id,
      'tenant_id', p_tenant_id,
      'app_id', p_app_id,
      'kind', coalesce(p_kind, 'transactional'),
      'envelope', coalesce(p_envelope, '{}'::jsonb),
      'accepted_at', p_accepted_at
    ),
    0
  ) into queue_id;

  return query
    select true,
           p_message_id,
           p_event_id,
           p_fingerprint,
           response_payload,
           queue_id;
end;
$$;

grant execute on function izakhono_mail.accept_and_enqueue(text, text, text, text, text, text, text, text, jsonb, jsonb, timestamptz) to service_role;
