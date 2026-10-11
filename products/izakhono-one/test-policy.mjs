import { evaluatePolicy, isDecision } from './services/policy.mjs';

const cases = [
  [{service:'search',action:'read'}, 'allow'],
  [{service:'search',action:'web_search'}, 'allow'],
  [{service:'commerce',action:'payments',payment:true,verified:false}, 'review'],
  [{service:'cloud',action:'delete',destructive:true,authenticated:false}, 'deny'],
  [{service:'cloud',action:'not_a_capability'}, 'deny'],
  [{service:'unknown',action:'read'}, 'deny']
];

for (const [input, expected] of cases) {
  const result = evaluatePolicy(input);
  if (!isDecision(result.decision)) throw new Error(`invalid decision: ${result.decision}`);
  if (result.decision !== expected) throw new Error(`${input.service}/${input.action}: expected ${expected}, got ${result.decision}`);
}

console.log('IZAKHONO ONE policy test: PASS');
