-- IZAKHONO SUPER CLOUD control-plane foundation

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS cloud_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cloud_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cloud_tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS cloud_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES cloud_projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('development','preview','staging','production','custom')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug)
);

CREATE TABLE IF NOT EXISTS cloud_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country_code CHAR(2),
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','provisioning','ready','degraded','offline')),
  capacity_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cloud_workloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES cloud_environments(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('container','vm','job','worker','database','storage','mail','media','ai','network')),
  desired_state TEXT NOT NULL DEFAULT 'running' CHECK (desired_state IN ('stopped','running','suspended')),
  provider_adapter TEXT NOT NULL DEFAULT 'owned',
  region_id UUID REFERENCES cloud_regions(id),
  spec_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment_id, slug)
);

CREATE TABLE IF NOT EXISTS cloud_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES cloud_projects(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES cloud_environments(id) ON DELETE CASCADE,
  workload_id UUID REFERENCES cloud_workloads(id) ON DELETE SET NULL,
  source_ref TEXT,
  source_sha TEXT,
  image_ref TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','building','deploying','healthy','failed','rolled_back')),
  health_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cloud_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cloud_tenants(id) ON DELETE CASCADE,
  project_id UUID REFERENCES cloud_projects(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','failed')),
  tls_status TEXT NOT NULL DEFAULT 'pending' CHECK (tls_status IN ('pending','active','expired','failed')),
  dns_provider TEXT NOT NULL DEFAULT 'owned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cloud_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES cloud_tenants(id) ON DELETE SET NULL,
  project_id UUID REFERENCES cloud_projects(id) ON DELETE SET NULL,
  actor_id TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('debug','info','warning','error','critical')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cloud_workloads_environment_idx ON cloud_workloads(environment_id);
CREATE INDEX IF NOT EXISTS cloud_deployments_project_idx ON cloud_deployments(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cloud_events_tenant_idx ON cloud_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cloud_events_type_idx ON cloud_events(event_type, created_at DESC);
