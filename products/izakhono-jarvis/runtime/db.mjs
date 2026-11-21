// PostgreSQL-backed compatibility adapter for the existing J.A.R.V.I.S. D1-shaped route modules.
// Only the explicitly reviewed SQL constructs used by these routes are translated.
export function translateJarvisSql(sql) {
  if (typeof sql !== "string" || !sql.trim()) throw new TypeError("SQL statement is required");
  let translated = sql
    .replace(/json_each\s*\(\s*([^)]+)\s*\)\s+(\w+)/gi,
      "jsonb_array_elements_text(($1)::jsonb) AS $2(value)")
    .replace(/datetime\s*\(\s*([^)]+)\s*\)/gi, "($1)::timestamptz");
  let index = 0;
  translated = translated.replace(/\?/g, () => "$" + (++index));
  return translated;
}

export function createJarvisPostgresAdapter(pool) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("A PostgreSQL pool is required");
  return {
    prepare(sql) {
      const statement = { sql, values: [] };
      const bound = {
        bind(...values) { statement.values = values; return bound; },
        async all() {
          const result = await pool.query(translateJarvisSql(statement.sql), statement.values);
          return { results: result.rows || [] };
        },
        async first() {
          const result = await pool.query(translateJarvisSql(statement.sql), statement.values);
          return result.rows?.[0] ?? null;
        },
        async run() {
          const result = await pool.query(translateJarvisSql(statement.sql), statement.values);
          return { meta: { changes: Number(result.rowCount || 0) } };
        },
      };
      return {
        bind: bound.bind,
        all: bound.all,
        first: bound.first,
        run: bound.run,
      };
    },
  };
}
