import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const connectionString = process.env.HOST_TEST_DATABASE_URL;
if (!connectionString) throw new Error('HOST_TEST_DATABASE_URL is required');
const pool = new pg.Pool({ connectionString });
try {
  const migration = await readFile(new URL('./001_immutable_checkout_orders.sql', import.meta.url), 'utf8');
  await pool.query(migration);
  const suffix = crypto.randomUUID();
  const row = {
    orderId: `ord_${suffix}`, paymentIntentId: `pay_${suffix}`,
    externalTransactionId: `txn_${suffix}`, customerId: `cus_${suffix}`,
    domain: `${suffix}.example.co.za`, amount: 14900, currency: 'ZAR',
    idempotencyKey: `idem_${suffix}`, productId: 'host-starter',
  };
  const insert = () => pool.query(
    `insert into public.iz_checkout_orders
      (order_id,payment_intent_id,external_transaction_id,customer_id,domain,expected_amount_minor,currency,idempotency_key,product_id,created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,
    [row.orderId,row.paymentIntentId,row.externalTransactionId,row.customerId,row.domain,row.amount,row.currency,row.idempotencyKey,row.productId],
  );
  await insert();
  await assert.rejects(insert, /duplicate key|unique constraint/i);
  await assert.rejects(
    () => pool.query('update public.iz_checkout_orders set expected_amount_minor = 1 where order_id = $1', [row.orderId]),
    /immutable/i,
  );
  await assert.rejects(
    () => pool.query('delete from public.iz_checkout_orders where order_id = $1', [row.orderId]),
    /immutable/i,
  );
  const found = await pool.query('select expected_amount_minor,currency from public.iz_checkout_orders where payment_intent_id = $1', [row.paymentIntentId]);
  assert.equal(found.rows[0]?.expected_amount_minor, '14900');
  assert.equal(found.rows[0]?.currency, 'ZAR');
  console.log('Immutable checkout order PostgreSQL integration tests passed');
} finally {
  await pool.end();
}
