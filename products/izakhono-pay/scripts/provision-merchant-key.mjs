import { createHash, randomBytes } from 'node:crypto';

const slug = String(process.argv[2] || '').trim().toLowerCase();
if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug)) {
  console.error('Usage: node scripts/provision-merchant-key.mjs <merchant-slug>');
  process.exit(1);
}

const secret = `izp_live_${randomBytes(32).toString('base64url')}`;
const hash = createHash('sha256').update(secret).digest('hex');

console.log('\nStore this key once in the merchant server secret store; it will not be recoverable from the database:\n');
console.log(secret);
console.log('\nApply only the hash to IZAKHONO PAY after the merchant has passed its launch gates:\n');
console.log(`UPDATE merchant_apps SET api_key_hash='${hash}', status='active', updated_at=CURRENT_TIMESTAMP WHERE slug='${slug}' AND status IN ('staged','active');`);
console.log('\nNever commit the plaintext key.\n');
