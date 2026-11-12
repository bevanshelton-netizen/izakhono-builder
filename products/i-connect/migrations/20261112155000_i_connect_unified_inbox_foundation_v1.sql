ALTER TABLE public.ic_channel_connections
  ADD CONSTRAINT ic_channel_connections_org_id_unique UNIQUE (organization_id, id);
ALTER TABLE public.ic_webhook_events
  ADD COLUMN retention_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days');
CREATE TABLE public.ic_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.ic_organizations(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '', email text, phone text, external_reference text,
  lifecycle_status text NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active','blocked','archived','erasure_pending')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ic_contacts_org_id_unique UNIQUE (organization_id, id),
  CONSTRAINT ic_contacts_contact_method_check CHECK (email IS NOT NULL OR phone IS NOT NULL OR external_reference IS NOT NULL OR display_name <> '')
);
CREATE INDEX ic_contacts_org_updated_idx ON public.ic_contacts(organization_id, updated_at DESC);
CREATE INDEX ic_contacts_org_phone_idx ON public.ic_contacts(organization_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX ic_contacts_org_email_idx ON public.ic_contacts(organization_id, lower(email)) WHERE email IS NOT NULL;
CREATE TABLE public.ic_contact_channel_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.ic_organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL, connection_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('whatsapp','instagram','facebook_messenger','telegram','website_chat','email','sms')),
  external_contact_id text NOT NULL, address text, verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, contact_id) REFERENCES public.ic_contacts(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, connection_id) REFERENCES public.ic_channel_connections(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT ic_contact_channel_identity_unique UNIQUE (connection_id, external_contact_id)
);
CREATE INDEX ic_contact_channel_identity_contact_idx ON public.ic_contact_channel_identities(organization_id, contact_id);
CREATE TABLE public.ic_contact_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.ic_organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL, channel text NOT NULL CHECK (channel IN ('whatsapp','instagram','facebook_messenger','telegram','website_chat','email','sms','phone','all')),
  purpose text NOT NULL CHECK (purpose IN ('service_messages','marketing','account_updates','support','analytics')),
  lawful_basis text NOT NULL CHECK (lawful_basis IN ('consent','contract','legal_obligation','legitimate_interests','public_task')),
  status text NOT NULL CHECK (status IN ('granted','withdrawn','expired','rejected')),
  notice_version text, source text NOT NULL, evidence_reference text, captured_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz, withdrawn_at timestamptz, expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, contact_id) REFERENCES public.ic_contacts(organization_id, id) ON DELETE CASCADE,
  CHECK ((status <> 'granted') OR granted_at IS NOT NULL), CHECK ((status <> 'withdrawn') OR withdrawn_at IS NOT NULL)
);
CREATE INDEX ic_contact_consents_lookup_idx ON public.ic_contact_consents(organization_id, contact_id, channel, purpose, created_at DESC);
CREATE TABLE public.ic_inbox_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.ic_organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL, connection_id uuid NOT NULL, queue_id uuid REFERENCES public.ic_contact_queues(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','instagram','facebook_messenger','telegram','website_chat','email','sms')),
  external_thread_id text NOT NULL, subject text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','waiting_customer','waiting_team','closed','archived')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  last_message_at timestamptz, retention_expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, contact_id) REFERENCES public.ic_contacts(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, connection_id) REFERENCES public.ic_channel_connections(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT ic_inbox_thread_external_unique UNIQUE (connection_id, external_thread_id),
  CONSTRAINT ic_inbox_threads_org_id_unique UNIQUE (organization_id, id)
);
CREATE INDEX ic_inbox_threads_org_queue_idx ON public.ic_inbox_threads(organization_id, status, priority, last_message_at DESC);
CREATE INDEX ic_inbox_threads_assignee_idx ON public.ic_inbox_threads(organization_id, assigned_to, status);
CREATE INDEX ic_inbox_threads_contact_idx ON public.ic_inbox_threads(organization_id, contact_id, last_message_at DESC);
CREATE TABLE public.ic_inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.ic_organizations(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL, provider_message_id text,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound','internal_note','system')),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','image','audio','video','document','location','interactive','template','system')),
  body text, delivery_status text NOT NULL DEFAULT 'received' CHECK (delivery_status IN ('received','queued','sent','delivered','read','failed','redacted')),
  provider_timestamp timestamptz, retention_expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'), created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, thread_id) REFERENCES public.ic_inbox_threads(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT ic_inbox_message_provider_unique UNIQUE (thread_id, provider_message_id)
);
CREATE INDEX ic_inbox_messages_thread_created_idx ON public.ic_inbox_messages(organization_id, thread_id, created_at DESC);
ALTER TABLE public.ic_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_contact_channel_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_contact_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_inbox_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_inbox_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY ic_contacts_member_read ON public.ic_contacts FOR SELECT TO authenticated USING (ic_private.is_member(organization_id));
CREATE POLICY ic_contact_identities_member_read ON public.ic_contact_channel_identities FOR SELECT TO authenticated USING (ic_private.is_member(organization_id));
CREATE POLICY ic_contact_consents_member_read ON public.ic_contact_consents FOR SELECT TO authenticated USING (ic_private.is_member(organization_id));
CREATE POLICY ic_inbox_threads_member_read ON public.ic_inbox_threads FOR SELECT TO authenticated USING (ic_private.is_member(organization_id));
CREATE POLICY ic_inbox_messages_member_read ON public.ic_inbox_messages FOR SELECT TO authenticated USING (ic_private.is_member(organization_id));
GRANT SELECT ON public.ic_contacts, public.ic_contact_channel_identities, public.ic_contact_consents, public.ic_inbox_threads, public.ic_inbox_messages TO authenticated;
GRANT ALL ON public.ic_contacts, public.ic_contact_channel_identities, public.ic_contact_consents, public.ic_inbox_threads, public.ic_inbox_messages TO service_role;
CREATE OR REPLACE FUNCTION ic_private.purge_expired_webhook_events()
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE removed_count bigint;
BEGIN
  DELETE FROM public.ic_webhook_events WHERE retention_expires_at <= now();
  GET DIAGNOSTICS removed_count = ROW_COUNT;
  RETURN removed_count;
END; $$;
REVOKE ALL ON FUNCTION ic_private.purge_expired_webhook_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ic_private.purge_expired_webhook_events() TO service_role;
COMMENT ON TABLE public.ic_contacts IS 'Organisation-scoped customer/contact records. Store only necessary personal data.';
COMMENT ON TABLE public.ic_contact_channel_identities IS 'Maps contacts to provider-specific identities within organisation channel connections.';
COMMENT ON TABLE public.ic_contact_consents IS 'Append-only communication permission and lawful-basis evidence. Record each change as a new row.';
COMMENT ON TABLE public.ic_inbox_threads IS 'Organisation-scoped conversations with queue, assignee, priority and explicit retention expiry.';
COMMENT ON TABLE public.ic_inbox_messages IS 'Minimal message records with explicit retention expiry. Avoid storing full provider payloads or unnecessary sensitive content.';
COMMENT ON COLUMN public.ic_webhook_events.retention_expires_at IS 'Default 30-day expiry for signed raw webhook event records; purge with ic_private.purge_expired_webhook_events.';
