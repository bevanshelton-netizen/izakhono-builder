import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policyPath = path.join(root, 'autonomy', 'CREDITS-FREE-POLICY.md');
if (!fs.existsSync(policyPath)) throw new Error('credits-free-policy-missing');

const files = [
  path.join(root, 'autonomy', 'engine-manifest.json'),
  path.join(root, 'autonomy', 'native-builder.mjs'),
  path.join(root, 'autonomy', 'builder-adapter.mjs'),
  path.join(root, 'autonomy', 'ai-agent-worker.mjs'),
];

const prohibited = /(?:IZAKHONO|native|internal)[^\n]{0,80}(?:credit|credits|quota|balance|pay[-_ ]?per[-_ ]?action|usage[-_ ]?meter)|(?:credit|credits|quota|balance|pay[-_ ]?per[-_ ]?action|usage[-_ ]?meter)[^\n]{0,80}(?:IZAKHONO|native|internal)/i;

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  if (prohibited.test(text)) throw new Error(`native-credits-gate-detected:${path.relative(root, file)}`);
}

console.log(JSON.stringify({ status: 'passed', policy: 'credits-free', checked: files.map((file) => path.relative(root, file)) }));
