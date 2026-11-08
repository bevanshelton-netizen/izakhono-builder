-- Every newly provisioned organisation receives exactly one active first owner.
-- The owning customer must be selected by a trusted server-side provisioning workflow.
CREATE TRIGGER IF NOT EXISTS trg_builder_org_create_first_owner
AFTER INSERT ON builder_organisations
BEGIN
  INSERT INTO builder_organisation_memberships
    (id,organisation_id,customer_id,role,status,invited_by_customer_id,created_at,updated_at)
  VALUES (
    'bom_' || lower(hex(randomblob(16))),
    NEW.id,
    NEW.created_by_customer_id,
    'owner',
    'active',
    NEW.created_by_customer_id,
    NEW.created_at,
    NEW.updated_at
  );
END;
