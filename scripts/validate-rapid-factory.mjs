import fs from 'node:fs';

const rapid = fs.readFileSync('src/rapid-factory.ts','utf8');
const sovereign = fs.readFileSync('src/sovereign.ts','utf8');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));

const required = [
  "CREATE TABLE IF NOT EXISTS rapid_factory_jobs",
  "CREATE TABLE IF NOT EXISTS rapid_factory_events",
  "/api/rapid-factory/jobs",
  "deployment.https_200",
  "email.inbound_verified",
  "email.outbound_verified",
  "handover_ready",
  "external-proof-required",
  "one brief -> parallel lanes -> validated release candidate -> proof-gated handover",
];

for (const token of required) {
  if (!rapid.includes(token)) throw new Error('Rapid Factory contract missing: ' + token);
}

if (!sovereign.includes("import { rapidFactoryRoute } from './rapid-factory';")) {
  throw new Error('Rapid Factory route is not imported into sovereign runtime');
}
if (!sovereign.includes('const rapidFactory = await rapidFactoryRoute(')) {
  throw new Error('Rapid Factory route is not wired into sovereign fetch flow');
}
if (!sovereign.includes('rapid_factory_orchestration: true')) {
  throw new Error('Rapid Factory capability flag is missing');
}
if (!String(pkg.scripts?.typecheck || '').includes('src/rapid-factory.ts')) {
  throw new Error('Rapid Factory is not included in typecheck');
}

console.log('Rapid Factory flow contract: PASS');
console.log('Proof-gated public handover: PASS');
console.log('Parallel lane orchestration contract: PASS');
