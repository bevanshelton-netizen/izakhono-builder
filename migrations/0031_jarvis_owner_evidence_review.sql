-- Owner review state is separate from execution state: completed work remains completed while evidence is reviewed.
ALTER TABLE jarvis_orchestration_steps ADD COLUMN owner_verification TEXT NOT NULL DEFAULT 'pending' CHECK (owner_verification IN ('pending','verified','rejected'));
ALTER TABLE jarvis_orchestration_steps ADD COLUMN owner_review_note TEXT;
ALTER TABLE jarvis_orchestration_steps ADD COLUMN reviewed_at TEXT;
