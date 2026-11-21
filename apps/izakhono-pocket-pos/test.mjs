import fs from'node:fs';
const w=fs.readFileSync(new URL('./src/worker.mjs',import.meta.url),'utf8');
const m=fs.readFileSync(new URL('./migrations/0001_pocketpos.sql',import.meta.url),'utf8');
const p=fs.readFileSync(new URL('./public/index.html',import.meta.url),'utf8');
const must=['/api/auth/login','/api/bootstrap','/api/sales','/api/payments/ikpay/session','/api/payments/ikhokha/webhook','PBKDF2','210000','IK-SIGN','idempotency-key','/api/admin/merchants','/api/devices/enrol'];
for(const x of must)if(!w.includes(x))throw Error('missing '+x);
for(const t of['pp_merchants','pp_staff','pp_sessions','pp_sales','pp_payment_events','pp_audit_log','pp_devices'])if(!m.includes(t))throw Error('missing table '+t);
const forbidden=[
 /<input[^>]+name=["']?(?:cardnumber|card_number|pan|cvv|cvc)/i,
 /<input[^>]+id=["']?(?:cardnumber|card_number|pan|cvv|cvc)/i,
 /placeholder=["'][^"']*(?:card number|cvv|cvc)/i
];
for(const re of forbidden)if(re.test(p))throw Error('frontend must not collect raw card data: '+re);
console.log('PocketPOS contract checks passed');