CREATE UNIQUE INDEX IF NOT EXISTS uq_scheduler_runs_job_scheduled
  ON scheduler_runs(job_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_scheduler_runs_queue
  ON scheduler_runs(status, scheduled_at);
