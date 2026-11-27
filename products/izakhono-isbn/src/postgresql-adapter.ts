/**
 * PostgreSQL-backed compatibility adapter for the existing registry's D1-shaped
 * query surface. It lets the API migrate without duplicating its domain rules.
 * SQL identifiers remain application-authored; values are always parameterised.
 */
export interface PgQueryResult<Row = Record<string, unknown>> {
  rows: Row[];
  rowCount: number | null;
}
export interface PgClientLike {
  query<Row = Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<PgQueryResult<Row>>;
  release?(): void;
}
export interface PgPoolLike {
  query<Row = Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<PgQueryResult<Row>>;
  connect(): Promise<PgClientLike>;
  end?(): Promise<void>;
}
type D1Result<Row> = { results: Row[]; success: true; meta: { changes: number } };
type Prepared = {
  bind(...values: unknown[]): Prepared;
  all<Row = Record<string, unknown>>(): Promise<D1Result<Row>>;
  first<Row = Record<string, unknown>>(column?: string): Promise<Row | unknown | null>;
  run(): Promise<D1Result<Record<string, unknown>>>;
};

function toPostgres(statement: string): string {
  // Registry SQL contains no question-mark operators or question marks in literals.
  // Reject multi-statement input so the adapter remains a single-statement boundary.
  const sql = statement.trim();
  if (!sql || sql.includes(";")) throw new Error("single_statement_required");
  let index = 0;
  return sql.replace(/\?/g, () => "$" + (++index));
}

export function createPostgresD1Adapter(pool: PgPoolLike) {
  const prepare = (statement: string): Prepared => {
    let values: unknown[] = [];
    const execute = () => pool.query(toPostgres(statement), values);
    const prepared: Prepared = {
      bind(...bound) { values = bound; return prepared; },
      async all<Row>() {
        const result = await execute();
        return { results: result.rows as Row[], success: true, meta: { changes: result.rowCount ?? result.rows.length } };
      },
      async first<Row>(column?: string) {
        const result = await execute();
        const row = result.rows[0] as Record<string, unknown> | undefined;
        if (!row) return null;
        return column ? row[column] ?? null : row as Row;
      },
      async run() {
        const result = await execute();
        return { results: [], success: true, meta: { changes: result.rowCount ?? 0 } };
      }
    };
    return prepared;
  };
  return {
    prepare,
    async batch<T extends Prepared[]>(statements: T) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const results = [];
        for (const statement of statements) results.push(await statement.all());
        await client.query("COMMIT");
        return results;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release?.(); }
    },
    async exec(statement: string) {
      const result = await pool.query(statement);
      return { count: result.rowCount ?? 0, duration: 0 };
    },
    withSession() { return this; },
    async dump() { throw new Error("database_dump_not_supported_by_postgresql_adapter"); },
    async getBookmark() { return null; },
    async close() { await pool.end?.(); }
  };
}
