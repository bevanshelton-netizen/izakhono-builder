import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const registry = JSON.parse(await readFile(join(root, 'registry.json'), 'utf8'));
const required = {
  search: ['web_search','local_discovery','content_discovery'],
  connecta: ['profiles','feed','communities','messaging'],
  ai: ['reasoning','generation','automation'],
  cloud: ['storage','documents','workspace'],
  commerce: ['catalog','orders','payments'],
  nav: ['navigation','safety','fleet','offline'],
  fortress: ['identity','policy','audit','threat_detection']
};
const missing = [];
for (const [slug, capabilities] of Object.entries(required)) {
  const found = registry.services.find(s => s.slug === slug);
  if (!found) missing.push(`${slug}:registry`);
  if (!capabilities.length) missing.push(`${slug}:capabilities`);
}
if (missing.length) {
  console.error(`IZAKHONO ONE CONTRACT CHECK FAILED: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('IZAKHONO ONE CONTRACT CHECK: PASS');
console.log(`PARALLEL_PILLARS=${Object.keys(required).length}`);
