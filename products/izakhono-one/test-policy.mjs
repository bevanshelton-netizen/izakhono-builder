import { evaluatePolicy } from './services/policy.mjs';

const cases = [
  [{service:'search',action:'read'}, 'allow'],
  [{service:'commerce',action:'payments',payment:true,verified:false}, 'review'],
  [{service:'cloud',action:'delete',destructive:true,authenticated:false}, 'deny'],
  [{service:'unknown',action:'read'}, 'deny']
];
for (const [input, expected] of cases) {
  const result = evaluatePolicy(input);
  if (result.decision !== expected) throw new Error(`${input.service}/${input.action}: expected ${expected}, got ${result.decision}`);
}
console.log('IZAKHONO ONE policy test: PASS');
