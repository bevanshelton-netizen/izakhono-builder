import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import pg from 'pg';
import { PostgresProvisioningStore } from './postgres-provisioning-store.mjs';

const connectionString = process.env.HOST_TEST_DATABASE_URL;
if (!connectionString) throw new Error('HOST_TEST_DATABASE_URL is required for the PostgreSQL integration test');
const pool = new pg.Pool({ connectionString, max: 4 });
const table = 'iz_host_provisioning_records';
const migration = await fs.readFile(new URL('../../migrations/001_host_provisioning_records.sql', import.meta.url), 'utf8');
const store = new PostgresProvisioningStore(pool);

const base = {
  id: 'prov_integration_1', idempotency_key: 'checkout_integration_1',
  customer_id: 'customer_integration_1', domain: 'integration.example.co.za',
  state: 'PAYMENT_VERIFIED', public_live: false,
  order_amount_minor: 14900, order_currency: 'ZAR',
  payment: {
    payment_intent_id: 'pay_integration_1', external_transaction_id: 'order_integration_1',
    provider: 'ikhokha', provider_payment_id: 'paylink_integration_1',
    amount_minor: 14900, currency: 'ZAR',
  },
};
try {
  await pool.query(migration);
  await pool.query(`DELETE FROM ${table} WHERE idempotency_key LIKE 'checkout_integration_%' OR payment_intent_id LIKE 'pay_integration_%'`);

  const first = await store.createOrGetByIdempotencyKey(base);
  assert.equal(first.outcome, 'created');
  assert.equal(first.record.state, 'PAYMENT_VERIFIED');
  assert.equal(first.record.public_live, false);

  const duplicate = await store.createOrGetByIdempotencyKey(base);
  assert.equal(duplicate.outcome, 'existing');
  assert.equal(duplicate.record.id, base.id);

  const conflictingCheckout = {
    ...base,
    id: 'prov_integration_2',
    payment: { ...base.payment, payment_intent_id: 'pay_integration_2', external_transaction_id: 'order_integration_2' },
  };
  const conflict = await store.createOrGetByIdempotencyKey(conflictingCheckout);
  assert.equal(conflict.outcome, 'conflict');

  const reusedPayment = {
    ...base,
    id: 'prov_integration_3',
    idempotency_key: 'checkout_integration_3',
  };
  const paymentConflict = await store.createOrGetByIdempotencyKey(reusedPayment);
  assert.equal(paymentConflict.outcome, 'conflict');

  await assert.rejects(() => pool.query(
    `UPDATE ${table} SET amount_minor = 100 WHERE idempotency_key = $1`,
    [base.idempotency_key],
  ), /iz_host_payment_order_match/);

  console.log('IZAKHONO HOST PostgreSQL integration test: PASS');
} finally {
  await pool.query(`DELETE FROM ${table} WHERE idempotency_key LIKE 'checkout_integration_%' OR payment_intent_id LIKE 'pay_integration_%'`).catch(() => {});
  await pool.end();
}
