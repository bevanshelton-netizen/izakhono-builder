import { createHash, createPublicKey, verify } from "node:crypto";
import { readFile, lstat } from "node:fs/promises";
import { Pool } from "pg";
import { pathToFileURL } from "node:url";

const MIGRATION_ID = "0001_runtime_fabric_deploy";
const MIGRATION_URL = new URL("./migrations/0001_runtime_fabric_deploy.sql", import.meta.url);
const LEDGER_DDL = `
CREATE TABLE IF NOT EXISTS izakhono_runtime_schema_migrations (
  migration_id TEXT PRIMARY KEY,
  checksum_sha256 CHAR(64) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by TEXT NOT NULL,
  approval_id TEXT NOT NULL,
  change_reference TEXT NOT NULL,
  rollback_reference TEXT NOT NULL
)`;

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const nonEmpty = value => typeof value === "string" && value.trim().length > 0;

export function calculateDatabaseFingerprint(row) {
  if (!row || !nonEmpty(row.database_name) || !nonEmpty(row.runtime_role) ||
      !nonEmpty(row.server_address) || !nonEmpty(row.server_version)) {
    throw new TypeError("Database identity response is incomplete.");
  }
  return sha256(Buffer.from([
    row.database_name, row.runtime_role, row.server_address, row.server_version
  ].join("|"), "utf8"));
}

export function validateMigrationApproval({
  approvalBytes,
  signatureBytes,
  publicKeyPem,
  migrationSha256,
  databaseFingerprint,
  databaseId,
  databaseEnvironment,
  databaseOwner,
  migrationRunnerId,
  now = Date.now()
}) {
  let approval;
  try { approval = JSON.parse(Buffer.from(approvalBytes).toString("utf8")); }
  catch { throw new Error("Migration approval JSON is invalid."); }
  const key = createPublicKey(publicKeyPem);
  if (key.asymmetricKeyType !== "ed25519" ||
      !verify(null, Buffer.from(approvalBytes), key, Buffer.from(signatureBytes))) {
    throw new Error("Detached migration approval signature is invalid.");
  }
  const required = [
    approval.approval_id, approval.approved_by, approval.change_reference,
    approval.rollback_reference, approval.runtime_database_id,
    approval.runtime_database_owner, approval.runtime_migration_runner
  ];
  if (approval.version !== 1 || approval.action !== "apply-runtime-fabric-deploy-migration" ||
      approval.migration_id !== MIGRATION_ID ||
      approval.migration_sha256 !== migrationSha256 ||
      approval.runtime_database_id !== databaseId ||
      approval.runtime_database_environment !== databaseEnvironment ||
      approval.runtime_database_owner !== databaseOwner ||
      approval.runtime_migration_runner !== migrationRunnerId ||
      !required.every(nonEmpty)) {
    throw new Error("Signed migration approval does not match this migration, database or runner.");
  }
  if (databaseFingerprint && approval.runtime_database_fingerprint !== databaseFingerprint) {
    throw new Error("Runtime Fabric database fingerprint does not match signed migration approval.");
  }
  if (!/^[0-9a-f]{64}$/.test(approval.runtime_database_fingerprint || "")) {
    throw new Error("Signed migration approval has an invalid database fingerprint.");
  }
  const approvedAt = Date.parse(approval.approved_at);
  const expiresAt = Date.parse(approval.expires_at);
  if (!Number.isFinite(approvedAt) || !Number.isFinite(expiresAt) ||
      approvedAt > now + 5 * 60 * 1000 || expiresAt <= now ||
      expiresAt <= approvedAt || expiresAt - approvedAt > 24 * 60 * 60 * 1000) {
    throw new Error("Migration approval is expired or outside its permitted validity window.");
  }
  return Object.freeze(approval);
}

async function readRegularFile(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o022) !== 0) {
    throw new Error(`${label} must be a regular, non-symlink file not writable by group or other users.`);
  }
  return readFile(path);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!nonEmpty(value) || /replace-with|changeme|todo|tbd|example\.com|\.invalid/i.test(value)) {
    throw new Error(`Required migration configuration is missing: ${name}`);
  }
  return value.trim();
}

async function main() {
  const mode = process.argv[2];
  if (!["--check", "--apply"].includes(mode) || process.argv.length !== 3) {
    throw new Error("Usage: node migrate.mjs --check|--apply");
  }
  const dsn = requiredEnv("IZAKHONO_RUNTIME_DATABASE_URL");
  const databaseId = requiredEnv("IZAKHONO_RUNTIME_DATABASE_ID");
  const databaseEnvironment = requiredEnv("IZAKHONO_RUNTIME_DATABASE_ENVIRONMENT");
  const databaseOwner = requiredEnv("IZAKHONO_RUNTIME_DATABASE_OWNER");
  const migrationRunnerId = requiredEnv("IZAKHONO_MIGRATION_RUNNER_ID");
  const approvalPath = requiredEnv("IZAKHONO_MIGRATION_APPROVAL_FILE");
  const signaturePath = requiredEnv("IZAKHONO_MIGRATION_APPROVAL_SIGNATURE_FILE");
  const publicKeyPath = requiredEnv("IZAKHONO_MIGRATION_OWNER_PUBLIC_KEY_FILE");

  const migrationBytes = await readRegularFile(MIGRATION_URL, "Migration SQL");
  const migrationSql = migrationBytes.toString("utf8");
  const migrationSha256 = sha256(migrationBytes);
  const approvalBytes = await readRegularFile(approvalPath, "Migration approval");
  const signatureBytes = await readRegularFile(signaturePath, "Migration signature");
  const publicKeyPem = await readRegularFile(publicKeyPath, "Owner public key");

  const preliminaryApproval = validateMigrationApproval({
    approvalBytes, signatureBytes, publicKeyPem,
    migrationSha256, databaseId, databaseEnvironment, databaseOwner, migrationRunnerId
  });

  const pool = new Pool({ connectionString: dsn, max: 1, connectionTimeoutMillis: 5000 });
  try {
    const identity = await pool.query(
      "SELECT current_database() AS database_name, current_user AS runtime_role, " +
      "COALESCE(inet_server_addr()::text, 'local-socket') AS server_address, " +
      "current_setting('server_version') AS server_version"
    );
    const fingerprint = calculateDatabaseFingerprint(identity.rows[0]);
    const approval = validateMigrationApproval({
      approvalBytes, signatureBytes, publicKeyPem,
      migrationSha256, databaseFingerprint: fingerprint,
      databaseId, databaseEnvironment, databaseOwner, migrationRunnerId
    });

    if (mode === "--check") {
      const ledger = await pool.query(
        "SELECT to_regclass('public.izakhono_runtime_schema_migrations') AS ledger"
      );
      if (!ledger.rows[0]?.ledger) {
        process.stdout.write(JSON.stringify({ status: "NOT_APPLIED", migration_id: MIGRATION_ID, migration_sha256: migrationSha256, database_fingerprint: fingerprint }) + "\n");
        return;
      }
      const existing = await pool.query(
        "SELECT checksum_sha256 FROM izakhono_runtime_schema_migrations WHERE migration_id = $1",
        [MIGRATION_ID]
      );
      const row = existing.rows[0];
      if (!row) {
        process.stdout.write(JSON.stringify({ status: "NOT_APPLIED", migration_id: MIGRATION_ID, migration_sha256: migrationSha256, database_fingerprint: fingerprint }) + "\n");
      } else if (row.checksum_sha256.trim() !== migrationSha256) {
        throw new Error("Applied migration checksum differs from the reviewed source.");
      } else {
        process.stdout.write(JSON.stringify({ status: "ALREADY_APPLIED", migration_id: MIGRATION_ID, migration_sha256: migrationSha256, database_fingerprint: fingerprint }) + "\n");
      }
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('izakhono-runtime-fabric-migrations'))");
      await client.query(LEDGER_DDL);
      const existing = await client.query(
        "SELECT checksum_sha256 FROM izakhono_runtime_schema_migrations WHERE migration_id = $1 FOR UPDATE",
        [MIGRATION_ID]
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum_sha256.trim() !== migrationSha256) {
          throw new Error("Applied migration checksum differs from the reviewed source.");
        }
        await client.query("COMMIT");
        process.stdout.write(JSON.stringify({ status: "ALREADY_APPLIED", migration_id: MIGRATION_ID, approval_id: approval.approval_id }) + "\n");
        return;
      }
      await client.query(migrationSql);
      await client.query(
        "INSERT INTO izakhono_runtime_schema_migrations " +
        "(migration_id, checksum_sha256, applied_by, approval_id, change_reference, rollback_reference) " +
        "VALUES ($1, $2, $3, $4, $5, $6)",
        [MIGRATION_ID, migrationSha256, migrationRunnerId, approval.approval_id,
         approval.change_reference, approval.rollback_reference]
      );
      await client.query("COMMIT");
      process.stdout.write(JSON.stringify({ status: "APPLIED", migration_id: MIGRATION_ID, approval_id: approval.approval_id, database_fingerprint: fingerprint }) + "\n");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(() => {
    process.stderr.write("DEPLOY migration runner blocked: approval, database binding, migration checksum or transaction gate failed. No success is claimed.\\n");
    process.exitCode = 1;
  });
}
