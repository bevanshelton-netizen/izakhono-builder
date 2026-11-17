import { access, readFile } from 'node:fs/promises';

const required=[
  'src/index.js',
  'src/core.js',
  'src/reconciliation.js',
  'public/index.html',
  'public/mock-checkout.html',
  'migrations/0001_core.sql',
  'migrations/0007_reconciliation.sql',
  'ZERO-TOUCH-RECONCILIATION.md',
  'wrangler.jsonc',
];
for(const file of required) await access(new URL(`../${file}`,import.meta.url));

const config=await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8');
if(!config.includes('00000000-0000-0000-0000-000000000000')) throw new Error('Expected fail-closed D1 placeholder before infrastructure provisioning');

const productionConfig=await readFile(new URL('../wrangler.production.jsonc',import.meta.url),'utf8');
if(!productionConfig.includes('"database_name": "izakhono-pay"') || !productionConfig.includes('00000000-0000-0000-0000-000000000000')) throw new Error('Production D1 binding must remain fail-closed until the existing database ID is resolved');
for(const flag of ['"IKHOKHA_ENABLED": "false"','"PAYSTACK_ENABLED": "false"','"PAYFAST_ENABLED": "false"']) {
  if(!productionConfig.includes(flag)) throw new Error('Production payment provider must remain disabled: '+flag);
}
const orderOrchestrator=await readFile(new URL('../../izakhono-business-studio/order-provisioning-orchestrator.ts',import.meta.url),'utf8');
if(orderOrchestrator.includes('payment.verified') || !orderOrchestrator.includes('paymentVerifier.verifyPayment')) throw new Error('Provisioning must require server-side payment verification');

const reconciliation=await readFile(new URL('../src/reconciliation.js',import.meta.url),'utf8');
for(const contract of [
  'deterministicReferenceMatching: true',
  'exactAmountAndCurrencyRequired: true',
  'automaticFuzzyMatching: false',
  'amountOnlyMatching: false',
  'autoSettlement: false',
  'fundCustody: false',
]) {
  if(!reconciliation.includes(contract)) throw new Error(`Reconciliation safety contract missing: ${contract}`);
}

console.log('IZAKHONO PAY layout and zero-touch reconciliation safety contract verified');
