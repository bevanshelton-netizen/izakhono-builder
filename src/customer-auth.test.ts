import assert from 'node:assert/strict';
import { hashCustomerPassword, validateCustomerPassword, verifyCustomerPassword } from './customer-auth';

async function main() {
  assert.throws(() => validateCustomerPassword('short'));
  assert.throws(() => validateCustomerPassword('x'.repeat(129)));
  const password = 'IZAKHONO-Customer-Password-2026!';
  const hash = await hashCustomerPassword(password);
  assert.match(hash, /^pbkdf2-sha256\$310000\$/);
  assert.equal(await verifyCustomerPassword(password, hash), true);
  assert.equal(await verifyCustomerPassword('incorrect-password', hash), false);
  assert.equal(await verifyCustomerPassword(password, 'legacy-plaintext'), false);
  console.log('customer auth password tests passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
