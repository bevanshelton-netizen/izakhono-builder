-- Register IZAKHONO FLOW as a first-class Builder portfolio product.
-- Idempotent: safe to re-run.

INSERT OR IGNORE INTO builder_projects
(id,name,slug,category,description,modules_json,status)
VALUES
(
  'prj_portfolio_izakhono_flow',
  'IZAKHONO FLOW',
  'izakhono-flow',
  'business',
  'Owned portfolio workflow orchestration across CRM, Revenue, Pay, Tasks, SUPER AI and platform fulfilment with strict entity/platform isolation.',
  '["auth","admin","analytics","ai","growth"]',
  'building'
);

UPDATE builder_projects
SET description = 'Owned portfolio workflow orchestration across CRM, Revenue, Pay, Tasks, SUPER AI and platform fulfilment with strict entity/platform isolation.',
    modules_json = '["auth","admin","analytics","ai","growth"]',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'izakhono-flow';
