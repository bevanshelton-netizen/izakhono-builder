import fs from 'node:fs';

const execution = fs.readFileSync('src/rapid-factory-execution.ts', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const checks = [
  ['persistent attempts table', execution.includes('rapid_factory_attempts')],
  ['phase-scoped attempts', execution.includes('job_id=? AND phase=?')],
  ['monotonic attempt number', execution.includes('MAX(attempt)')],
  ['running state', execution.includes("status='running'")],
  ['completed state', execution.includes("status='completed'")],
  ['failed state', execution.includes("status='failed'")],
  ['latest attempt lookup', execution.includes('getLatestFactoryAttempt')],
  ['execution validation wired', packageJson.scripts['validate:rapid-factory-execution'] === 'node scripts/validate-rapid-factory-execution.mjs'],
  ['full validation wired', packageJson.scripts.validate.includes('validate:rapid-factory-execution')],
  ['restore script remains syntax-only', packageJson.scripts['validate:finance-core'].includes('node --check products/izakhono-finance-core/ops/restore.mjs')],
];

for (const [name, ok] of checks) {
  if (!ok) throw new Error(`Rapid Factory execution validation failed: ${name}`);
}

console.log('IZAKHONO Rapid Factory execution-attempt validation passed');
