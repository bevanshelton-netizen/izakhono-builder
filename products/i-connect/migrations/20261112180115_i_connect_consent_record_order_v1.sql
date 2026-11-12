ALTER TABLE public.ic_contact_consents ADD COLUMN recorded_order bigint GENERATED ALWAYS AS IDENTITY;
CREATE INDEX ic_contact_consents_latest_idx ON public.ic_contact_consents(organization_id,contact_id,purpose,recorded_order DESC);
CREATE OR REPLACE FUNCTION public.ic_check_communication_permission(
  p_organization_id uuid,p_contact_id uuid,p_channel text,p_purpose text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_contact_status text; v_consent public.ic_contact_consents%ROWTYPE;
BEGIN
  IF p_channel NOT IN ('whatsapp','instagram','facebook_messenger','telegram','website_chat','email','sms','phone') THEN RETURN jsonb_build_object('permitted',false,'reason','unsupported_channel'); END IF;
  IF p_purpose NOT IN ('service_messages','marketing','account_updates','support','analytics') THEN RETURN jsonb_build_object('permitted',false,'reason','unsupported_purpose'); END IF;
  SELECT lifecycle_status INTO v_contact_status FROM public.ic_contacts WHERE organization_id=p_organization_id AND id=p_contact_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('permitted',false,'reason','contact_not_found'); END IF;
  IF v_contact_status <> 'active' THEN RETURN jsonb_build_object('permitted',false,'reason','contact_not_active'); END IF;
  SELECT * INTO v_consent FROM public.ic_contact_consents c
  WHERE c.organization_id=p_organization_id AND c.contact_id=p_contact_id AND c.purpose=p_purpose AND c.channel IN (p_channel,'all')
  ORDER BY c.recorded_order DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('permitted',false,'reason','no_permission_record'); END IF;
  IF v_consent.status <> 'granted' THEN RETURN jsonb_build_object('permitted',false,'reason','permission_not_granted','record_status',v_consent.status); END IF;
  IF v_consent.expires_at IS NOT NULL AND v_consent.expires_at <= now() THEN RETURN jsonb_build_object('permitted',false,'reason','permission_expired'); END IF;
  IF p_purpose='marketing' AND v_consent.lawful_basis <> 'consent' THEN RETURN jsonb_build_object('permitted',false,'reason','marketing_requires_explicit_consent'); END IF;
  RETURN jsonb_build_object('permitted',true,'reason','current_permission_record','lawful_basis',v_consent.lawful_basis,'consent_record_id',v_consent.id,'channel',v_consent.channel,'purpose',v_consent.purpose);
END; $$;
COMMENT ON COLUMN public.ic_contact_consents.recorded_order IS 'Monotonic append order used to resolve the latest consent, including multiple records created in one transaction.';
