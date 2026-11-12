CREATE TABLE IF NOT EXISTS public.ic_outbound_message_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.ic_organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL, thread_id uuid, connection_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','instagram','facebook_messenger','telegram','website_chat','email','sms')),
  purpose text NOT NULL CHECK (purpose IN ('service_messages','marketing','account_updates','support')),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','template')),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 10000),
  status text NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval','approved','rejected','cancelled')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz, review_note text,
  permission_record_id uuid REFERENCES public.ic_contact_consents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ic_outbound_drafts_contact_fk FOREIGN KEY (organization_id,contact_id) REFERENCES public.ic_contacts(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT ic_outbound_drafts_thread_fk FOREIGN KEY (organization_id,thread_id) REFERENCES public.ic_inbox_threads(organization_id,id) ON DELETE SET NULL,
  CONSTRAINT ic_outbound_drafts_connection_fk FOREIGN KEY (organization_id,connection_id) REFERENCES public.ic_channel_connections(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT ic_outbound_drafts_review_check CHECK ((status='pending_approval' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR (status<>'pending_approval' AND (status='cancelled' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))))
);
CREATE INDEX IF NOT EXISTS ic_outbound_drafts_queue_idx ON public.ic_outbound_message_drafts(organization_id,status,created_at DESC);
ALTER TABLE public.ic_outbound_message_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ic_outbound_message_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ic_outbound_message_drafts TO service_role;
COMMENT ON TABLE public.ic_outbound_message_drafts IS 'Outbound message drafts and human approval records only. No delivery worker or provider send is enabled by this table.';
CREATE OR REPLACE FUNCTION public.ic_create_outbound_message_draft(p_organization_id uuid,p_contact_id uuid,p_thread_id uuid,p_connection_id uuid,p_channel text,p_purpose text,p_message_type text,p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_user uuid:=auth.uid(); v_role text; v_id uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
 SELECT role INTO v_role FROM public.ic_memberships WHERE organization_id=p_organization_id AND user_id=v_user AND status='active';
 IF v_role IS NULL OR v_role NOT IN ('owner','admin','manager','agent') THEN RAISE EXCEPTION 'membership_required'; END IF;
 IF p_channel NOT IN ('whatsapp','instagram','facebook_messenger','telegram','website_chat','email','sms') OR p_purpose NOT IN ('service_messages','marketing','account_updates','support') OR p_message_type NOT IN ('text','template') OR p_body IS NULL OR length(btrim(p_body)) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'invalid_draft'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.ic_contacts c WHERE c.id=p_contact_id AND c.organization_id=p_organization_id AND c.lifecycle_status='active') THEN RAISE EXCEPTION 'contact_unavailable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.ic_channel_connections c WHERE c.id=p_connection_id AND c.organization_id=p_organization_id AND c.provider=p_channel AND c.status='active') THEN RAISE EXCEPTION 'channel_not_active'; END IF;
 IF p_thread_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ic_inbox_threads t WHERE t.id=p_thread_id AND t.organization_id=p_organization_id AND t.contact_id=p_contact_id AND t.connection_id=p_connection_id) THEN RAISE EXCEPTION 'thread_mismatch'; END IF;
 IF v_role='agent' AND p_thread_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ic_inbox_threads t WHERE t.id=p_thread_id AND t.assigned_to=v_user) THEN RAISE EXCEPTION 'thread_assignment_required'; END IF;
 INSERT INTO public.ic_outbound_message_drafts(organization_id,contact_id,thread_id,connection_id,channel,purpose,message_type,body,created_by) VALUES(p_organization_id,p_contact_id,p_thread_id,p_connection_id,p_channel,p_purpose,p_message_type,btrim(p_body),v_user) RETURNING id INTO v_id;
 INSERT INTO public.ic_audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES(p_organization_id,v_user,'outbound.draft_created','outbound_message_draft',v_id::text,jsonb_build_object('channel',p_channel,'purpose',p_purpose,'message_type',p_message_type,'body_length',length(btrim(p_body))));
 RETURN v_id;
END; $$;
CREATE OR REPLACE FUNCTION public.ic_review_outbound_message_draft(p_organization_id uuid,p_draft_id uuid,p_decision text,p_review_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_user uuid:=auth.uid(); v_role text; v_draft public.ic_outbound_message_drafts%ROWTYPE; v_permission jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
 SELECT role INTO v_role FROM public.ic_memberships WHERE organization_id=p_organization_id AND user_id=v_user AND status='active';
 IF v_role IS NULL OR v_role NOT IN ('owner','admin','manager') THEN RAISE EXCEPTION 'manager_required'; END IF;
 IF p_decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
 SELECT * INTO v_draft FROM public.ic_outbound_message_drafts WHERE id=p_draft_id AND organization_id=p_organization_id FOR UPDATE;
 IF NOT FOUND OR v_draft.status<>'pending_approval' THEN RAISE EXCEPTION 'draft_not_pending'; END IF;
 IF v_draft.created_by=v_user THEN RAISE EXCEPTION 'maker_cannot_approve'; END IF;
 IF p_decision='approve' THEN
  v_permission:=public.ic_check_communication_permission(p_organization_id,v_draft.contact_id,v_draft.channel,v_draft.purpose);
  IF COALESCE((v_permission->>'permitted')::boolean,false)=false THEN RETURN jsonb_build_object('reviewed',false,'reason','permission_check_failed','permission',v_permission); END IF;
  UPDATE public.ic_outbound_message_drafts SET status='approved',reviewed_by=v_user,reviewed_at=now(),review_note=NULLIF(left(coalesce(p_review_note,''),1000),''),permission_record_id=NULLIF(v_permission->>'consent_record_id','')::uuid,updated_at=now() WHERE id=p_draft_id;
 ELSE
  UPDATE public.ic_outbound_message_drafts SET status='rejected',reviewed_by=v_user,reviewed_at=now(),review_note=NULLIF(left(coalesce(p_review_note,''),1000),''),updated_at=now() WHERE id=p_draft_id;
 END IF;
 INSERT INTO public.ic_audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES(p_organization_id,v_user,'outbound.draft_'||p_decision,'outbound_message_draft',p_draft_id::text,jsonb_build_object('purpose',v_draft.purpose,'channel',v_draft.channel));
 RETURN jsonb_build_object('reviewed',true,'status',CASE WHEN p_decision='approve' THEN 'approved' ELSE 'rejected' END,'delivery_enabled',false);
END; $$;
REVOKE ALL ON FUNCTION public.ic_create_outbound_message_draft(uuid,uuid,uuid,uuid,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.ic_review_outbound_message_draft(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ic_create_outbound_message_draft(uuid,uuid,uuid,uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ic_review_outbound_message_draft(uuid,uuid,text,text) TO authenticated;
COMMENT ON FUNCTION public.ic_review_outbound_message_draft(uuid,uuid,text,text) IS 'Human approval with current permission re-check and maker-checker separation. Approval never sends a message.';