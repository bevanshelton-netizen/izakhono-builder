-- ALLEGRO VIBEZ sovereign-first data model
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'creator',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS creator_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  country TEXT DEFAULT 'South Africa',
  genre TEXT DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS releases (
  id UUID PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  release_type TEXT NOT NULL DEFAULT 'single',
  artwork_url TEXT,
  audio_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS rights_records (
  id UUID PRIMARY KEY,
  release_id UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ownership_pct NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  publishing_status TEXT NOT NULL DEFAULT 'self_declared',
  evidence_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  creator_id UUID REFERENCES users(id),
  provider TEXT NOT NULL,
  provider_reference TEXT,
  type TEXT NOT NULL,
  amount_minor BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_reference)
);

CREATE TABLE IF NOT EXISTS royalty_ledger (
  id UUID PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES users(id),
  release_id UUID REFERENCES releases(id),
  transaction_id UUID REFERENCES transactions(id),
  amount_minor BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  entry_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  creator_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  available_minor BIGINT NOT NULL DEFAULT 0,
  pending_minor BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES users(id),
  amount_minor BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  provider TEXT,
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
