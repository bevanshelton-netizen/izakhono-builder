/**
 * Provider-neutral persistence boundary for IZAKHONO publishing services.
 *
 * The domain/service layer must depend on this contract, not on D1, Cloudflare,
 * node-postgres, or a specific hosting vendor. Adapters must use parameterised
 * queries, enforce transaction boundaries, and never expose raw driver errors.
 *
 * This is an interface contract only. No production adapter is wired yet.
 */
export type SqlPrimitive = string | number | boolean | null | Date | Uint8Array;
export type SqlRow = Record<string, unknown>;

export interface QueryResult<Row extends SqlRow = SqlRow> {
  rows: Row[];
  rowCount: number;
}

export interface RegistryTransaction {
  query<Row extends SqlRow = SqlRow>(
    statement: string,
    parameters?: readonly SqlPrimitive[]
  ): Promise<QueryResult<Row>>;
  execute(
    statement: string,
    parameters?: readonly SqlPrimitive[]
  ): Promise<{ rowCount: number }>;
}

export interface RegistryDatabase extends RegistryTransaction {
  transaction<T>(work: (tx: RegistryTransaction) => Promise<T>): Promise<T>;
  close?(): Promise<void>;
}

export interface RegistryDatabaseHealth {
  engine: "postgresql" | "sqlite";
  connected: boolean;
  schemaVersion: string | null;
}

/**
 * Adapter acceptance requirements:
 * - parameter binding must be positional and injection-safe;
 * - transactions must commit atomically or roll back completely;
 * - connection/pool limits and timeouts must be bounded;
 * - health checks must not reveal credentials, connection strings or topology;
 * - driver exceptions must be translated to stable domain errors;
 * - migration execution must be separate from application request handling.
 */
