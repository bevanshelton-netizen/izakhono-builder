/**
 * PostgreSQL-backed implementation of the HOST paid-provisioning store contract.
 * Pass a node-postgres Pool/Client-compatible object exposing query(text, values).
 */
export class PostgresProvisioningStore {
  constructor(pool) {
    if (!pool || typeof pool.query !== 'function') throw new Error('PostgreSQL query client is required');
    this.pool = pool;
  }

  async createOrGetByIdempotencyKey(record) {
    const payment = record.payment;
    if (!payment) throw new Error('Verified payment evidence is required');
    const values = [
      record.id, record.idempotency_key, record.customer_id, record.domain,
      record.state, Boolean(record.public_live), payment.payment_intent_id,
      payment.external_transaction_id, payment.provider, payment.provider_payment_id,
      payment.amount_minor, payment.currency, record.order_amount_minor,
      record.order_currency, JSON.stringify(record),
    ];
    const inserted = await this.pool.query(
      `INSERT INTO iz_host_provisioning_records (
        id, idempotency_key, customer_id, domain, state, public_live,
        payment_intent_id, external_transaction_id, payment_provider,
        provider_payment_id, amount_minor, currency, order_amount_minor,
        order_currency, record
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb
      )
      ON CONFLICT DO NOTHING
      RETURNING record`,
      values,
    );
    if (inserted.rows?.length) return { outcome: 'created', record: inserted.rows[0].record };

    const existing = await this.pool.query(
      'SELECT record FROM iz_host_provisioning_records WHERE idempotency_key = $1 LIMIT 1',
      [record.idempotency_key],
    );
    if (existing.rows?.length) {
      const saved = existing.rows[0].record;
      const same = saved.payment?.payment_intent_id === payment.payment_intent_id &&
        saved.payment?.external_transaction_id === payment.external_transaction_id &&
        saved.payment?.amount_minor === payment.amount_minor &&
        saved.payment?.currency === payment.currency &&
        saved.customer_id === record.customer_id &&
        saved.domain === record.domain;
      return { outcome: same ? 'existing' : 'conflict', record: saved };
    }

    // The payment identity was already consumed under a different checkout key.
    const paymentOwner = await this.pool.query(
      'SELECT record FROM iz_host_provisioning_records WHERE payment_intent_id = $1 OR external_transaction_id = $2 LIMIT 1',
      [payment.payment_intent_id, payment.external_transaction_id],
    );
    if (paymentOwner.rows?.length) return { outcome: 'conflict', record: paymentOwner.rows[0].record };
    throw new Error('Provisioning insert conflicted but no owning record could be resolved');
  }
}
