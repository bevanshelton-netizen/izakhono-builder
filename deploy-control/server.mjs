import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { Pool } from "pg";
import { createDeployApiHandler } from "./api.mjs";
import { createFortressAccessTokenVerifier } from "./fortress-verifier.mjs";

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim() || /replace-with|changeme|todo|tbd|example\.com|\.invalid/i.test(value.trim())) {
    throw new Error(`Required DEPLOY configuration is missing: ${name}`);
  }
  return value.trim();
}

const databaseUrl = required("IZAKHONO_RUNTIME_DATABASE_URL");
const introspectionUrl = required("FORTRESS_DEPLOY_INTROSPECTION_URL");
const introspectionSecret = required("FORTRESS_DEPLOY_INTROSPECTION_SECRET");
const approvalDatabaseFingerprint = required("DEPLOY_CONTROL_APPROVAL_DATABASE_FINGERPRINT");
const approvalMigrationSha256 = required("DEPLOY_CONTROL_APPROVAL_MIGRATION_SHA256");
const approvalFortressEndpoint = required("DEPLOY_CONTROL_APPROVAL_FORTRESS_ENDPOINT");
const issuer = process.env.FORTRESS_SESSION_ISSUER || "https://fortress.izakhono.internal";
const audience = process.env.FORTRESS_DEPLOY_AUDIENCE || "izakhono-deploy";
const host = process.env.DEPLOY_API_HOST || "127.0.0.1";
const port = Number(process.env.DEPLOY_API_PORT || 8090);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("DEPLOY_API_PORT must be an integer between 1 and 65535.");
}
if (!/^https:\/\//.test(issuer) || !audience.trim() ||
    !/^[0-9a-f]{64}$/.test(approvalDatabaseFingerprint) ||
    !/^[0-9a-f]{64}$/.test(approvalMigrationSha256) ||
    approvalFortressEndpoint !== introspectionUrl) {
  throw new Error("FORTRESS issuer/audience or signed DEPLOY activation binding is invalid.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 8,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  application_name: "izakhono-deploy-control"
});
const verifyAccessToken = createFortressAccessTokenVerifier({
  introspectionUrl,
  introspectionSecret,
  timeoutMs: 5000
});
const handler = createDeployApiHandler({
  pool,
  verifyAccessToken,
  issuer,
  audience
});

const server = createServer(async (incoming, outgoing) => {
  try {
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of incoming) {
      totalBytes += chunk.length;
      if (totalBytes > 256 * 1024) {
        outgoing.statusCode = 413;
        outgoing.setHeader("content-type", "application/json; charset=utf-8");
        outgoing.setHeader("cache-control", "no-store");
        outgoing.end('{"error":"REQUEST_TOO_LARGE"}');
        return;
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (value !== undefined && !["connection", "transfer-encoding", "upgrade"].includes(name.toLowerCase())) {
        headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
    }
    const method = incoming.method || "GET";
    const init = { method, headers };
    if (!["GET", "HEAD"].includes(method) && body.length) init.body = body;
    const request = new Request(new URL(incoming.url || "/", "http://127.0.0.1"), init);
    const response = await handler(request);
    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => outgoing.setHeader(name, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.statusCode = 500;
    outgoing.setHeader("content-type", "application/json; charset=utf-8");
    outgoing.setHeader("cache-control", "no-store");
    outgoing.end('{"error":"INTERNAL_ERROR"}');
  }
});

async function start() {
  // Read-only startup gates: the authoritative Runtime Fabric tables must
  // already exist, and the separate FORTRESS introspection secret must work.
  await pool.query("SELECT 1");
  const schema = await pool.query(
    "SELECT current_database() AS database_name, current_user AS runtime_role, " +
    "COALESCE(inet_server_addr()::text, 'local-socket') AS server_address, " +
    "current_setting('server_version') AS server_version, " +
    "pg_get_userbyid(runtime.relowner) AS runtime_owner, " +
    "pg_get_userbyid(audit.relowner) AS audit_owner, " +
    "pg_get_userbyid(ledger.relowner) AS migration_owner, " +
    "has_table_privilege(current_user, ledger.oid, 'SELECT') AS migration_ledger_select, " +
    "(SELECT checksum_sha256 FROM izakhono_runtime_schema_migrations WHERE migration_id = '0001_runtime_fabric_deploy') AS applied_migration_sha256, " +
    "has_table_privilege(current_user, runtime.oid, 'SELECT') AS runtime_select, " +
    "has_table_privilege(current_user, runtime.oid, 'INSERT') AS runtime_insert, " +
    "has_table_privilege(current_user, runtime.oid, 'UPDATE') AS runtime_update, " +
    "has_table_privilege(current_user, audit.oid, 'SELECT') AS audit_select, " +
    "has_table_privilege(current_user, audit.oid, 'INSERT') AS audit_insert, " +
    "has_table_privilege(current_user, audit.oid, 'UPDATE') AS audit_update, " +
    "has_table_privilege(current_user, audit.oid, 'DELETE') AS audit_delete, " +
    "has_table_privilege(current_user, audit.oid, 'TRUNCATE') AS audit_truncate, " +
    "EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = audit.oid " +
    "AND t.tgname = 'fortress_audit_events_no_mutation' AND t.tgenabled IN ('O','A') " +
    "AND NOT t.tgisinternal) AS audit_append_only_trigger " +
    "FROM pg_class runtime CROSS JOIN pg_class audit CROSS JOIN pg_class ledger " +
    "WHERE runtime.oid = to_regclass('public.izakhono_runtime_deployments') " +
    "AND audit.oid = to_regclass('public.fortress_audit_events') " +
    "AND ledger.oid = to_regclass('public.izakhono_runtime_schema_migrations')"
  );
  const role = schema.rows[0];
  const actualDatabaseFingerprint = role
    ? createHash("sha256").update([
        role.database_name, role.server_address, role.server_version
      ].join("|"), "utf8").digest("hex")
    : "";
  if (!role ||
      actualDatabaseFingerprint !== approvalDatabaseFingerprint ||
      role.runtime_role === role.runtime_owner || role.runtime_role === role.audit_owner ||
      role.runtime_role === role.migration_owner || !role.migration_ledger_select ||
      String(role.applied_migration_sha256 || "").trim() !== approvalMigrationSha256 ||
      !role.runtime_select || !role.runtime_insert || !role.runtime_update ||
      !role.audit_select || !role.audit_insert || role.audit_update ||
      role.audit_delete || role.audit_truncate || !role.audit_append_only_trigger) {
    throw new Error("Runtime DB role separation, least-privilege grants or append-only FORTRESS audit gate failed; DEPLOY will not start.");
  }
  const fingerprintMaterial = [
    role.database_name, role.runtime_role, role.server_address, role.server_version
  ].join("|");
  const actualFingerprint = createHash("sha256").update(fingerprintMaterial, "utf8").digest("hex");
  if (actualFingerprint !== approvalDatabaseFingerprint) {
    throw new Error("Runtime Fabric database fingerprint does not match signed owner approval.");
  }
  await verifyAccessToken("startup.invalid.probe");
  server.listen(port, host, () => {
    process.stdout.write(`IZAKHONO DEPLOY listening on ${host}:${port}\n`);
  });
}

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

start().catch(async () => {
  await pool.end().catch(() => {});
  process.stderr.write("IZAKHONO DEPLOY startup blocked: configuration, database schema or FORTRESS introspection gate failed.\n");
  process.exit(1);
});
