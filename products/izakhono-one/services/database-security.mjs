const requiredTables = Object.freeze([
  'service_registry',
  'service_events',
  'audit_events',
  'service_contracts',
  'policy_decisions',
  'service_runtime_state',
  'runtime_events',
  'search_index_snapshots',
  'search_index_events'
]);

export function requiredDatabaseSecurityTables() {
  return [...requiredTables];
}

export function normalizeDatabaseSecurityPosture(input = {}) {
  const tables = input.tables && typeof input.tables === 'object' ? input.tables : {};
  const rls = Object.fromEntries(requiredTables.map((table) => [table, Boolean(tables[table]?.rls_enabled ?? tables[table])])) ;
  const missing = requiredTables.filter((table) => !rls[table]);
  return {
    source: String(input.source || 'unknown'),
    checked_at: input.checked_at || null,
    tables: rls,
    all_required_rls_enabled: missing.length === 0,
    missing_rls: missing
  };
}

export function canVerifyDatabaseRuntime(input = {}) {
  const posture = normalizeDatabaseSecurityPosture(input);
  return posture.all_required_rls_enabled;
}

export function databaseSecurityContract(input = {}) {
  const posture = normalizeDatabaseSecurityPosture(input);
  return {
    required_tables: [...requiredTables],
    source: posture.source,
    checked_at: posture.checked_at,
    all_required_rls_enabled: posture.all_required_rls_enabled,
    missing_rls: [...posture.missing_rls],
    ready_for_verified_runtime: posture.all_required_rls_enabled
  };
}
