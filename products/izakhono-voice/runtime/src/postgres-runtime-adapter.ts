import { Pool } from "pg";
import { PostgresVoiceCallRegistry } from "./postgres-call-registry.js";
import type { VoiceRuntimeAdapterModule } from "./runtime-contract.js";

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing required runtime environment variable: ${key}`);
  return value;
}

export const createVoiceRuntimeDependencies: VoiceRuntimeAdapterModule["createVoiceRuntimeDependencies"] = async env => {
  const connectionString = required(env, "DATABASE_URL");
  const pool = new Pool({
    connectionString,
    max: Number(env.IZAKHONO_VOICE_DB_POOL_MAX ?? "10"),
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 5_000,
    ssl: env.DATABASE_SSL === "require"
      ? { rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" }
      : undefined,
    application_name: "izakhono-voice-runtime",
  });
  await pool.query("SELECT 1");
  const registry = new PostgresVoiceCallRegistry(pool);

  return {
    callRegistry: registry,
    instructionsForCall: authorization => registry.getTenantInstructions(authorization.tenantId),
    audit: event => registry.recordAudit(event),
  };
};
