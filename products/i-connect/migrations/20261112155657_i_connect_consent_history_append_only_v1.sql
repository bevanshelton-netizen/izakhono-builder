REVOKE UPDATE, DELETE ON TABLE public.ic_contact_consents FROM service_role;
COMMENT ON TABLE public.ic_contact_consents IS 'Append-only communication permission and lawful-basis evidence. Service-role applications may insert and read records but cannot mutate or delete history; changes are recorded as new rows.';
