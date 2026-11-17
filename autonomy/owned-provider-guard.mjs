import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.join(process.cwd(), 'autonomy', 'engine-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const deploy = manifest.adapters?.deploy || [];
const observe = manifest.adapters?.observe || [];
const builder = manifest.adapters?.builder || [];
const principles = manifest.principles || [];

if (!deploy.includes('izakhono-node')) {
  throw new Error('owned-node-deployment-provider-missing');
}
if (!observe.includes('izakhono-observe')) {
  throw new Error('owned-observability-provider-missing');
}
if (deploy.some((provider) => /vercel/i.test(provider))) {
  throw new Error('vercel-must-not-be-a-core-deployment-provider');
}
if (observe.some((provider) => /vercel/i.test(provider))) {
  throw new Error('vercel-must-not-be-a-core-observability-provider');
}
if (builder.length !== 1 || builder[0] !== 'izakhono-native') {
  throw new Error('core-builder-must-use-izakhono-native-only');
}
if (!principles.some((item) => /vercel is not an execution provider/i.test(item))) {
  throw new Error('owned-provider-policy-principle-missing');
}

console.log(JSON.stringify({
  status: 'passed',
  deployment: deploy,
  observability: observe,
  builder,
  externalVercelDependency: false,
}, null, 2));
