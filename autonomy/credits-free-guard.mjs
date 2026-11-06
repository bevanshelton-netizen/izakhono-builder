import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policyPath = path.join(root, 'autonomy', 'CREDITS-FREE-POLICY.md');
if (!fs.existsSync(policyPath)) throw new Error('credits-free-policy-missing');

const policy = fs.readFileSync(policyPath, 'utf8');
for (const required of [
  'do not use an artificial credits system',
  'must never check, decrement, reserve, purchase, or require credits',
  'Hercules is not part of the IZAKHONO Builder execution path',
]) {
  if (!policy.toLowerCase().includes(required.toLowerCase())) {
    throw new Error(`credits-free-policy-incomplete:${required}`);
  }
}

// Scan executable native control-plane components only. The manifest and policy
// may describe the prohibition; executable code may not implement a native gate.
const files = [
  path.join(root, 'autonomy', 'native-builder.mjs'),
  path.join(root, 'autonomy', 'builder-adapter.mjs'),
  path.join(root, 'autonomy', 'ai-agent-worker.mjs'),
  path.join(root, 'autonomy', 'runner.mjs'),
  path.join(root, 'autonomy', 'software-node.mjs'),
  path.join(root, 'autonomy', 'workload-scheduler.mjs'),
];

const contextualProhibited = /(?:IZAKHONO|native|internal|execution)[^\n]{0,120}(?:credit|credits|quota|balance|pay[-_ ]?per[-_ ]?action|usage[-_ ]?meter)|(?:credit|credits|quota|balance|pay[-_ ]?per[-_ ]?action|usage[-_ ]?meter)[^\n]{0,120}(?:IZAKHONO|native|internal|execution)/i;
const explicitProhibited = /\b(?:creditBalance|quotaRemaining|usageMeterEnabled|reserveCredits|decrementCredits|checkCredits|payPerAction)\b/i;

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  const executableLines = source.split('\n').filter((line) =>
    !/creditsEnabled\s*!==\s*false|artificialUsageMeter\s*!==\s*false/.test(line)
  ).join('\n');
  if (contextualProhibited.test(executableLines) || explicitProhibited.test(source)) {
    throw new Error(`native-credits-gate-detected:${path.relative(root, file)}`);
  }
}

console.log(JSON.stringify({
  status: 'passed',
  policy: 'credits-free',
  checked: files.filter(fs.existsSync).map((file) => path.relative(root, file)),
}));
