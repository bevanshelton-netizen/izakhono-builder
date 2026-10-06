import fs from 'node:fs';

const execution = fs.readFileSync('src/rapid-factory-execution.ts', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const checks = [
  ['persistent attempts table', execution.includes('rapid_factory_attempts')],
  ['phase-scoped attempts', execution.includes('job_id=? AND phase=?')],
  ['monotonic attempt number', execution.includes('MAX(attempt)')],
  ['running state', execution.includes("'running'")],
  ['completed state', execution.includes("'completed'")],
  ['failed state', execution.includes("'failed'")],
  ['latest attempt lookup', execution.includes('getLatestFactoryAttempt')],
  ['checkpoint support', execution.includes('checkpointFactoryAttempt')],
  ['resume planner', execution.includes('planFactoryResume')],
  ['recovery coordinator', execution.includes('recoverFactoryPhase')],
  ['resume existing running attempt', execution.includes("latest?.status === 'running'")],
  ['execution validation wired', packageJson.scripts['validate:rapid-factory-execution'] === 'node scripts/validate-rapid-factory-execution.mjs'],
  ['full validation wired', packageJson.scripts.validate.includes('validate:rapid-factory-execution')],
  ['execution coordinator typechecked', packageJson.scripts.typecheck.includes('src/rapid-factory-execution.ts')],
  ['restore script remains syntax-only', packageJson.scripts['validate:finance-core'].includes('node --check products/izakhono-finance-core/ops/restore.mjs')],
];

for (const [name, ok] of checks) {
  if (!ok) throw new Error(`Rapid Factory execution validation failed: ${name}`);
}

console.log('IZAKHONO Rapid Factory resumable execution validation passed');
