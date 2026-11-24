import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  calculateDatabaseFingerprint,
  validateMigrationApproval
} from "./migrate.mjs";

const now = Date.parse("2026-11-24T08:00:00.000Z");
const migrationSha256 = "b".repeat(64);
const databaseRow = {
  database_name: "runtime_fabric",
  runtime_role: "izakhono_migration_owner",
  server_address: "10.0.0.12",
  server_version: "16.4"
};
const databaseFingerprint = calculateDatabaseFingerprint(databaseRow);
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
const approval = {
  version: 1,
  action: "apply-runtime-fabric-deploy-migration",
  approval_id: "approval-runtime-fabric-001",
  migration_id: "0001_runtime_fabric_deploy",
  migration_sha256: migrationSha256,
  runtime_database_fingerprint: databaseFingerprint,
  runtime_database_id: "runtime-fabric-production-01",
  runtime_database_environment: "production",
  runtime_database_owner: "IZAKHONO Africa (Pty) Ltd",
  runtime_migration_runner: "NODE01-approved-migration-runner",
  approved_by: "Infrastructure Owner",
  approved_at: "2026-11-24T07:00:00.000Z",
  expires_at: "2026-11-24T10:00:00.000Z",
  change_reference: "CHG-2026-1124-001",
  rollback_reference: "RBK-2026-1124-001"
};
const approvalBytes = Buffer.from(JSON.stringify(approval));
const signatureBytes = sign(null, approvalBytes, privateKey);
const expected = {
  approvalBytes,
  signatureBytes,
  publicKeyPem,
  migrationSha256,
  databaseFingerprint,
  databaseId: approval.runtime_database_id,
  databaseEnvironment: "production",
  databaseOwner: approval.runtime_database_owner,
  migrationRunnerId: approval.runtime_migration_runner,
  now
};

test("accepts a detached Ed25519 approval bound to exact migration, database and runner", () => {
  const verified = validateMigrationApproval(expected);
  assert.equal(verified.approval_id, approval.approval_id);
});

test("rejects tampered signatures, migration checksums and database fingerprints", () => {
  assert.throws(() => validateMigrationApproval({
    ...expected, signatureBytes: Buffer.from("tampered")
  }), /signature/);
  assert.throws(() => validateMigrationApproval({
    ...expected, migrationSha256: "c".repeat(64)
  }), /does not match/);
  assert.throws(() => validateMigrationApproval({
    ...expected, databaseFingerprint: "d".repeat(64)
  }), /fingerprint/);
});

test("rejects expired, wrong-environment and wrong-runner approvals", () => {
  const expired = { ...approval, expires_at: "2026-11-24T07:59:00.000Z" };
  const expiredBytes = Buffer.from(JSON.stringify(expired));
  const expiredSignature = sign(null, expiredBytes, privateKey);
  assert.throws(() => validateMigrationApproval({
    ...expected, approvalBytes: expiredBytes, signatureBytes: expiredSignature
  }), /expired/);

  assert.throws(() => validateMigrationApproval({
    ...expected, databaseEnvironment: "staging"
  }), /does not match/);
  assert.throws(() => validateMigrationApproval({
    ...expected, migrationRunnerId: "unapproved-runner"
  }), /does not match/);
});

test("database fingerprint is stable across migration-owner and runtime roles", () => {
  const migrationOwner = calculateDatabaseFingerprint({
    database_name: "runtime_fabric",
    runtime_role: "izakhono_migration_owner",
    server_address: "10.0.0.12",
    server_version: "16.4"
  });
  const runtimeRole = calculateDatabaseFingerprint({
    database_name: "runtime_fabric",
    runtime_role: "izakhono_deploy_runtime",
    server_address: "10.0.0.12",
    server_version: "16.4"
  });
  assert.equal(migrationOwner, runtimeRole);
});
