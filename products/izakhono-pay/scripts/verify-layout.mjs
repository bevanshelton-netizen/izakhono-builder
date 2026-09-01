import { access, readFile } from 'node:fs/promises';
const required=['src/index.js','src/core.js','public/index.html','public/mock-checkout.html','migrations/0001_core.sql','wrangler.jsonc'];
for(const file of required) await access(new URL(`../${file}`,import.meta.url));
const config=await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8');
if(!config.includes('00000000-0000-0000-0000-000000000000')) throw new Error('Expected fail-closed D1 placeholder before infrastructure provisioning');
console.log('IZAKHONO PAY layout verified');
