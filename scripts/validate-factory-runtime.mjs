import fs from 'node:fs';

const runtime = fs.readFileSync('src/runtime.ts', 'utf8');
const bridge = fs.readFileSync('src/factory-superagent.ts', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const required = [
  "url.pathname === '/api/factory/run'",
  "return runFactory(req, env)",
  "'/api/build-anything'",
  "'/api/projects/${encodeURIComponent(projectId)}/autopilot'",
  'public_live: false',
];

for (const marker of required) {
  const source = marker.includes('factory/run') || marker.includes('runFactory') ? runtime : bridge;
  if (!source.includes(marker)) throw new Error(`Missing factory bridge marker: ${marker}`);
}

if (!pkg.scripts?.typecheck?.includes('src/factory-superagent.ts')) {
  throw new Error('Factory bridge is not included in the TypeScript gate.');
}

if (bridge.includes('ADMIN_SECRET') || bridge.includes('OPENROUTER_API_KEY') || bridge.includes('GROQ_API_KEY')) {
  throw new Error('Factory bridge must not embed provider or admin secrets.');
}

console.log('Factory runtime contract: PASS');
console.log('- /api/factory/run route wired');
console.log('- build-anything -> autopilot chain wired');
console.log('- public release remains evidence-gated');
console.log('- bridge is included in TypeScript validation');
console.log('- no known secret names embedded');
