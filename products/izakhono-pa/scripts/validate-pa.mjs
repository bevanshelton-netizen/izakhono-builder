import fs from 'node:fs';
const files=['products/izakhono-pa/src/index.ts','products/izakhono-pa/public/index.html','products/izakhono-pa/public/app.js','products/izakhono-pa/wrangler.jsonc','migrations/0006_pa_commercial_core.sql'];
for(const f of files){if(!fs.existsSync(f))throw new Error(`Missing ${f}`)}
const src=fs.readFileSync('products/izakhono-pa/src/index.ts','utf8');
for(const needle of ['/api/whatsapp/webhook','WHATSAPP_VERIFY_TOKEN','WHATSAPP_ACCESS_TOKEN','WHATSAPP_BRIEF_TEMPLATE_NAME','PA_ADMIN_SECRET','pa_audit_events']){if(!src.includes(needle))throw new Error(`Missing control: ${needle}`)}
if(/EAA[A-Za-z0-9]{20,}/.test(src))throw new Error('Possible Meta token committed');
const sql=fs.readFileSync('migrations/0006_pa_commercial_core.sql','utf8');
for(const table of ['pa_tenants','pa_contacts','pa_tasks','pa_messages','pa_briefs','pa_audit_events']){if(!sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`))throw new Error(`Missing table ${table}`)}
console.log('IZAKHONO Executive PA validation passed');
