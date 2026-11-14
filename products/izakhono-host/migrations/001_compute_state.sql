-- IZAKHONO HOST compute fabric state.
-- The single JSONB aggregate is locked transactionally by every manager instance.
-- This prevents competing workers/managers from claiming the same lease.
CREATE TABLE IF NOT EXISTS izakhono_compute_state (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO izakhono_compute_state (id, payload)
VALUES (1, '{"version":1,"nodes":[],"jobs":[],"audit":[]}'::jsonb)
ON CONFLICT (id) DO NOTHING;
