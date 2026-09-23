-- Make the CEO Growth Engine a standing requirement for every existing Builder project.
-- D1/SQLite JSON1 migration; idempotent.

UPDATE builder_projects
SET modules_json = json_insert(
      CASE WHEN json_valid(modules_json) THEN modules_json ELSE '[]' END,
      '$[#]',
      'growth'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM json_each(CASE WHEN json_valid(builder_projects.modules_json) THEN builder_projects.modules_json ELSE '[]' END)
  WHERE json_each.value = 'growth'
);
