-- Link developer apps to the Builder project lifecycle and preserve evidence-gated state.
ALTER TABLE builder_app_registry ADD COLUMN builder_project_id TEXT;
ALTER TABLE builder_app_registry ADD COLUMN verification_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE builder_app_registry ADD COLUMN monetization_json TEXT NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_builder_app_registry_project
  ON builder_app_registry(builder_project_id);

CREATE INDEX IF NOT EXISTS idx_builder_app_registry_developer_stage
  ON builder_app_registry(developer_id, stage, updated_at DESC);


-- Deployment evidence is distinct from build verification and public-live state.
ALTER TABLE builder_app_registry ADD COLUMN deployment_json TEXT NOT NULL DEFAULT '{}';
