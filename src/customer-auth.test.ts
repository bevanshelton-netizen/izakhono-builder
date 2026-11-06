import assert from 'node:assert/strict';
import {
  createEmailVerificationToken,
  consumeEmailVerificationToken,
  hashCustomerPassword,
  validateCustomerPassword,
  verifyCustomerPassword,
} from './customer-auth';

class VerificationDB {
  token: { customerId: string; hash: string; expiresAt: string; usedAt: string | null } | null = null;
  customer = { id: 'customer_test', status: 'pending_verification', verifiedAt: null as string | null };

  prepare(sql: string) {
    let values: unknown[] = [];
    const self = this;
    return {
      bind(...args: unknown[]) { values = args; return this; },
      async run() {
        if (sql.startsWith('INSERT INTO builder_email_verification_tokens')) {
          self.token = {
            customerId: String(values[1]),
            hash: String(values[2]),
            expiresAt: String(values[3]),
            usedAt: null,
          };
        } else if (sql.includes("UPDATE builder_customers SET status='active'")) {
          if (self.customer.id === values[2] && self.customer.status === 'pending_verification') {
            self.customer.status = 'active';
            self.customer.verifiedAt = String(values[0]);
          }
        }
        return {};
      },
      async first<T>() {
        if (sql.includes('UPDATE builder_email_verification_tokens')) {
          if (self.token && self.token.hash === values[1] && !self.token.usedAt && self.token.expiresAt > String(values[2])) {
            self.token.usedAt = String(values[0]);
            return { customer_id: self.token.customerId } as T;
          }
          return null;
        }
        if (sql.includes('SELECT id FROM builder_customers')) {
          return self.customer.status === 'active' && self.customer.verifiedAt === values[1]
            ? { id: self.customer.id } as T
            : null;
        }
        return null;
      },
    };
  }
}

async function testEmailVerification() {
  const db = new VerificationDB();
  const now = new Date('2026-11-06T10:00:00.000Z');
  const issued = await createEmailVerificationToken(db as any, 'customer_test', now);
  assert.match(issued.token, /^[a-f0-9]{64}$/);
  assert.notEqual(db.token?.hash, issued.token);
  assert.equal(issued.expiresAt, '2026-11-06T10:30:00.000Z');
  assert.equal(await consumeEmailVerificationToken(db as any, issued.token, now), 'customer_test');
  assert.equal(db.customer.status, 'active');
  assert.equal(await consumeEmailVerificationToken(db as any, issued.token, now), null);

  const expiredDb = new VerificationDB();
  const expired = await createEmailVerificationToken(expiredDb as any, 'customer_test', now);
  assert.equal(
    await consumeEmailVerificationToken(expiredDb as any, expired.token, new Date(now.getTime() + 31 * 60_000)),
    null,
  );
}

async function main() {
  await testEmailVerification();
  assert.throws(() => validateCustomerPassword('short'));
  assert.throws(() => validateCustomerPassword('x'.repeat(129)));
  const password = 'IZAKHONO-Customer-Password-2026!';
  const hash = await hashCustomerPassword(password);
  assert.match(hash, /^pbkdf2-sha256\\$310000\\$/);
  assert.equal(await verifyCustomerPassword(password, hash), true);
  assert.equal(await verifyCustomerPassword('incorrect-password', hash), false);
  assert.equal(await verifyCustomerPassword(password, 'legacy-plaintext'), false);
  console.log('customer auth and email verification tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
