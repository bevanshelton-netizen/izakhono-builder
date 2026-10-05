import fs from 'node:fs';

const factory = fs.readFileSync('src/rapid-factory.ts', 'utf8');
const persistence = fs.readFileSync('src/rapid-factory-persistence.ts', 'utf8');

const checks = [
  ['persistent idempotency table', persistence.includes('rapid_factory_idempotency')],
  ['SHA-256 request hashing', persistence.includes('SHA-256')],
  ['atomic idempotency claim', persistence.includes('INSERT OR IGNORE')],
  ['replay storage', persistence.includes("status='completed'") && persistence.includes('response_body')],
  ['job binding', persistence.includes('bindFactoryIdempotencyJob')],
  ['Idempotency-Key header', factory.includes("Idempotency-Key")],
  ['request replay', factory.includes("claim.kind === 'replay'")],
  ['hash conflict protection', factory.includes("claim.kind === 'conflict'")],
  ['in-progress protection', factory.includes("claim.kind === 'in_progress'")],
  ['deployment proof remains machine verified', factory.includes("Deployment proof must be established by /verify-deployment")],
];

for (const [name, ok] of checks) {
  if (!ok) throw new Error(`Rapid Factory persistence check failed: ${name}`);
}

console.log('IZAKHONO Rapid Factory persistence validation passed');
