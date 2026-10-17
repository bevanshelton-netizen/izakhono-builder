import assert from 'node:assert/strict';
import { databaseSecurityContract, canVerifyDatabaseRuntime, normalizeDatabaseSecurityPosture, requiredDatabaseSecurityTables } from './services/database-security.mjs';
import { canServeRuntime } from './services/runtime.mjs';

const required = requiredDatabaseSecurityTables();
assert.equal(required.length, 9);

const insecure = normalizeDatabaseSecurityPosture({
  source: 'supabase',
  access_mode: 'backend_only',
  tables: Object.fromEntries(required.map((table) => [table, { rls_enabled: table === 'search_index_events' || table === 'search_index_snapshots' }]))
});
assert.equal(insecure.all_required_rls_enabled, false);
assert.equal(insecure.access_mode_valid, true);
assert.equal(insecure.missing_rls.length, 7);
assert.equal(canVerifyDatabaseRuntime(insecure), false);
assert.equal(canServeRuntime('verified', 'healthy', databaseSecurityContract(insecure)), false);

const missingAccessBoundary = databaseSecurityContract({
  source: 'supabase',
  tables: Object.fromEntries(required.map((table) => [table, { rls_enabled: true }]))
});
assert.equal(missingAccessBoundary.all_required_rls_enabled, true);
assert.equal(missingAccessBoundary.access_mode_valid, false);
assert.equal(missingAccessBoundary.ready_for_verified_runtime, false);
assert.equal(canServeRuntime('verified', 'healthy', missingAccessBoundary), false);

const secure = databaseSecurityContract({
  source: 'supabase',
  access_mode: 'backend_only',
  tables: Object.fromEntries(required.map((table) => [table, { rls_enabled: true }]))
});
assert.equal(secure.all_required_rls_enabled, true);
assert.equal(secure.access_mode_valid, true);
assert.equal(secure.ready_for_verified_runtime, true);
assert.equal(canVerifyDatabaseRuntime(secure), true);
assert.equal(canServeRuntime('verified', 'healthy', secure), true);

console.log('database-security tests passed');
