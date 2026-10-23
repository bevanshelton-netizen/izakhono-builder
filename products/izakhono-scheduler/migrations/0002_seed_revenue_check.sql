INSERT INTO scheduler_jobs
  (id,name,prompt,cron,timezone,enabled,next_run_at,created_at,updated_at)
VALUES
  (
    'daily-izakhono-revenue-execution-check',
    'Daily IZAKHONO Revenue Execution Check',
    'Run the daily IZAKHONO revenue execution check. Review current commercial priorities, identify the highest-value actions that can generate or accelerate revenue, assess progress and blockers, and produce a concise CEO execution plan. Prioritize ready-to-sell products, customer acquisition, payments, follow-ups, fulfillment, and removal of operational blockers. Do not expand the idea list unless it directly supports revenue execution.',
    '0 8 * * *',
    'Africa/Johannesburg',
    1,
    NULL,
    datetime('now'),
    datetime('now')
  )
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,
  prompt=excluded.prompt,
  cron=excluded.cron,
  timezone=excluded.timezone,
  enabled=excluded.enabled,
  updated_at=datetime('now');
