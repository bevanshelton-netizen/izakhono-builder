import assert from 'node:assert/strict';
import { PostgresProvisioningStore } from './postgres-provisioning-store.mjs';

const record = {
  id: 'prov_1', idempotency_key: 'checkout_1', customer_id: 'customer_1',
  domain: 'example.co.za', state: 'PAYMENT_VERIFIED', public_live: false,
  order_amount_minor: 14900, order_currency: 'ZAR',
  payment: {
    payment_intent_id: 'pay_1', external_transaction_id: 'order_1',
    provider: 'ikhokha', provider_payment_id: 'link_1',
    amount_minor: 14900, currency: 'ZAR',
  },
};

function clientWith(responses) {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      const next = responses.shift();
      if (!next) throw new Error('Unexpected SQL query');
      return next;
    },
  };
}

const createdClient = clientWith([{ rows: [{ record }] }]);
assert.deepEqual(await new PostgresProvisioningStore(createdClient).createOrGetByIdempotencyKey(record), { outcome: 'created', record });
assert.match(createdClient.calls[0].sql, /ON CONFLICT DO NOTHING/);
assert.equal(createdClient.calls[0].values[5], false);

const existingClient = clientWith([{ rows: [] }, { rows: [{ record }] }]);
assert.deepEqual(await new PostgresProvisioningStore(existingClient).createOrGetByIdempotencyKey(record), { outcome: 'existing', record });

const conflicting = { ...record, payment: { ...record.payment, payment_intent_id: 'pay_other', external_transaction_id: 'order_other' } };
const conflictClient = clientWith([{ rows: [] }, { rows: [{ record }] }]);
assert.deepEqual(await new PostgresProvisioningStore(conflictClient).createOrGetByIdempotencyKey(conflicting), { outcome: 'conflict', record });

const consumedElsewhere = clientWith([{ rows: [] }, { rows: [] }, { rows: [{ record }] }]);
assert.deepEqual(await new PostgresProvisioningStore(consumedElsewhere).createOrGetByIdempotencyKey({ ...record, idempotency_key: 'checkout_2' }), { outcome: 'conflict', record });

assert.throws(() => new PostgresProvisioningStore(null), /PostgreSQL query client/);
console.log('IZAKHONO HOST PostgreSQL provisioning store tests: PASS');
