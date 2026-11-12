ALTER TABLE public.ic_contact_consents ALTER COLUMN contact_id DROP NOT NULL;
ALTER TABLE public.ic_contact_consents DROP CONSTRAINT ic_contact_consents_organization_id_contact_id_fkey;
ALTER TABLE public.ic_contact_consents
  ADD CONSTRAINT ic_contact_consents_contact_fk
  FOREIGN KEY (organization_id, contact_id)
  REFERENCES public.ic_contacts(organization_id, id)
  ON DELETE SET NULL (contact_id);
COMMENT ON COLUMN public.ic_contact_consents.contact_id IS 'Nullable after a verified contact-erasure request; organisation-scoped permission evidence remains without retaining the deleted contact key.';
