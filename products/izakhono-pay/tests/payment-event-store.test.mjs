import test from 'node:test';
import assert from 'node:assert/strict';
import { recordPaymentEvent } from '../src/payment-event-store.js';

function fakeDb({ insertError = null, existing = null, lookupError = null } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          calls.push({ sql, args });
          return {
            async run() {
              if (sql.startsWith('INSERT') && insertError) throw insertError;
              return { success: true };
            },
            async first() {
              if (lookupError) throw lookupError;
              return existing;
            }
          };
        }
      };
    }
  };
}

const event = {
  eventId: 'evt_1', provider: 'paystack', eventType: 'charge.success',
  fingerprint: 'sha256-event', intentId: 'pi_1',
  payload: { reference: 'IZP-1' }, verified: true
};

test('new verified webhook event is persisted once', async () => {
  const db = fakeDb();
  assert.equal(await recordPaymentEvent({ db, ...event }), true);
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /^INSERT INTO payment_events/);
});

test('an existing provider fingerprint is an acknowledged replay', async () => {
  const db = fakeDb({ insertError: new Error('UNIQUE constraint failed: payment_events.provider, payment_events.fingerprint'), existing: { id: 'evt_original' } });
  assert.equal(await recordPaymentEvent({ db, ...event }), false);
  assert.equal(db.calls.length, 2);
  assert.match(db.calls[1].sql, /^SELECT id FROM payment_events/);
  assert.deepEqual(db.calls[1].args, ['paystack', 'sha256-event']);
});

test('an insert failure without a durable matching event propagates', async () => {
  const failure = new Error('database is unavailable');
  const db = fakeDb({ insertError: failure, existing: null });
  await assert.rejects(recordPaymentEvent({ db, ...event }), (error) => error === failure);
});

test('a failed replay lookup cannot turn a storage error into a duplicate', async () => {
  const failure = new Error('database is unavailable');
  const db = fakeDb({ insertError: failure, lookupError: new Error('read unavailable') });
  await assert.rejects(recordPaymentEvent({ db, ...event }), (error) => error === failure);
});
