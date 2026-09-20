BEGIN;

CREATE TYPE studypal_role AS ENUM (
  'OWNER','LEARNER','PARENT','TEACHER','SCHOOL_ADMIN','SPONSOR_ADMIN','PLATFORM_ADMIN'
);

CREATE TYPE subscription_status AS ENUM (
  'FREE','TRIAL','ACTIVE','PAYMENT_PENDING','PAST_DUE','CANCELLED','SPONSORED','OWNER'
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role studypal_role NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learner_profiles (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT,
  country TEXT,
  curriculum TEXT,
  grade_year TEXT,
  preferred_language TEXT,
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  learning_goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parent_learner_relationships (
  parent_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  learner_id UUID REFERENCES learner_profiles(id) ON DELETE CASCADE,
  relationship_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(parent_user_id, learner_id)
);

CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  organisation_type TEXT NOT NULL CHECK (organisation_type IN ('school','sponsor','ngo','company','government','other')),
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organisation_members (
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role studypal_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(organisation_id, user_id)
);

CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_year TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pricing_plans (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  monthly_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (monthly_price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'ZAR',
  monthly_ai_allowance INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES pricing_plans(id),
  status subscription_status NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  external_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR organisation_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS usage_records (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  learner_id UUID REFERENCES learner_profiles(id) ON DELETE SET NULL,
  plan_code TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_units INTEGER NOT NULL DEFAULT 1 CHECK (request_units > 0),
  provider TEXT,
  model TEXT,
  estimated_cost_micros BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS usage_records_user_time_idx
  ON usage_records(user_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS sponsorships (
  id UUID PRIMARY KEY,
  sponsor_organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  beneficiary_organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  learner_id UUID REFERENCES learner_profiles(id) ON DELETE SET NULL,
  seats INTEGER NOT NULL DEFAULT 1 CHECK (seats > 0),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_reference TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL,
  verified_server_side BOOLEAN NOT NULL DEFAULT false,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_event_hash TEXT
);

CREATE TABLE IF NOT EXISTS learning_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  learner_id UUID REFERENCES learner_profiles(id) ON DELETE SET NULL,
  subject TEXT,
  curriculum TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS progress_records (
  id BIGSERIAL PRIMARY KEY,
  learner_id UUID NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
  subject TEXT,
  topic TEXT,
  activity_type TEXT,
  score_numeric NUMERIC,
  source_session_id UUID REFERENCES learning_sessions(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO pricing_plans (id, code, name, monthly_price_cents, currency, monthly_ai_allowance, active)
VALUES
  ('00000000-0000-0000-0000-000000000001','FREE','Free Starter',0,'ZAR',10,true),
  ('00000000-0000-0000-0000-000000000002','STANDARD','StudyPal Standard',9900,'ZAR',200,true),
  ('00000000-0000-0000-0000-000000000003','OWNER','Owner Access',0,'ZAR',NULL,true)
ON CONFLICT (code) DO NOTHING;

COMMIT;
