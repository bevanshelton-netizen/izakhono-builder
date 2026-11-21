import type { PaymentIntent } from './payment-core.js';
import type { ServiceBus, ServiceMessage } from './service-bus.js';

export type FulfillmentStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface FulfillmentJob {
  id: string;
  paymentIntentId: string;
  merchantId: string;
  serviceId: string;
  status: FulfillmentStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FulfillmentStore {
  create(job: FulfillmentJob): Promise<FulfillmentJob>;
  getByPaymentIntent(paymentIntentId: string): Promise<FulfillmentJob | undefined>;
  update(id: string, patch: Partial<FulfillmentJob>): Promise<FulfillmentJob>;
}

export class MemoryFulfillmentStore implements FulfillmentStore {
  private readonly jobs = new Map<string, FulfillmentJob>();
  async create(job: FulfillmentJob): Promise<FulfillmentJob> {
    const existing = await this.getByPaymentIntent(job.paymentIntentId);
    if (existing) return existing;
    this.jobs.set(job.id, { ...job });
    return { ...job };
  }
  async getByPaymentIntent(paymentIntentId: string): Promise<FulfillmentJob | undefined> {
    const job = [...this.jobs.values()].find((item) => item.paymentIntentId === paymentIntentId);
    return job ? { ...job } : undefined;
  }
  async update(id: string, patch: Partial<FulfillmentJob>): Promise<FulfillmentJob> {
    const current = this.jobs.get(id);
    if (!current) throw new Error(`Unknown fulfillment job: ${id}`);
    if ((patch.merchantId !== undefined && patch.merchantId !== current.merchantId) || (patch.serviceId !== undefined && patch.serviceId !== current.serviceId) || (patch.paymentIntentId !== undefined && patch.paymentIntentId !== current.paymentIntentId)) throw new Error('Fulfillment ownership and payment binding are immutable');
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.jobs.set(id, updated);
    return { ...updated };
  }
}

export interface ProvisionerHandler {
  provision(input: { job: FulfillmentJob; payment: PaymentIntent }): Promise<void>;
}

export interface PaymentFulfillmentConfig { serviceId: string; }

export class PaymentFulfillment {
  constructor(private readonly store: FulfillmentStore, private readonly provisioner: ProvisionerHandler) {}
  async enqueue(payment: PaymentIntent, config: PaymentFulfillmentConfig): Promise<FulfillmentJob> {
    if (payment.status !== 'paid') throw new Error('Only paid payments can be fulfilled');
    if (!payment.merchantId?.trim() || !config.serviceId?.trim()) throw new Error('Trusted payment merchant and service IDs are required');
    const existing = await this.store.getByPaymentIntent(payment.id);
    if (existing) {
      if (existing.merchantId !== payment.merchantId || existing.serviceId !== config.serviceId) throw new Error('Existing fulfillment ownership does not match canonical payment intent');
      return existing;
    }
    const now = new Date().toISOString();
    return this.store.create({ id: `fulfill_${crypto.randomUUID()}`, paymentIntentId: payment.id, merchantId: payment.merchantId, serviceId: config.serviceId, status: 'queued', attempts: 0, createdAt: now, updatedAt: now });
  }
  async execute(job: FulfillmentJob, payment: PaymentIntent): Promise<FulfillmentJob> {
    if (payment.status !== 'paid' || !payment.merchantId?.trim()) throw new Error('Fulfillment requires a canonically paid payment with merchant identity');
    if (job.paymentIntentId !== payment.id || job.merchantId !== payment.merchantId) throw new Error('Fulfillment job does not belong to the supplied payment intent');
    const persisted = await this.store.getByPaymentIntent(payment.id);
    if (!persisted || persisted.id !== job.id || persisted.merchantId !== payment.merchantId || persisted.serviceId !== job.serviceId) throw new Error('Persisted fulfillment ownership does not match payment intent');
    const running = await this.store.update(persisted.id, { status: 'running', attempts: persisted.attempts + 1 });
    try {
      await this.provisioner.provision({ job: running, payment });
      return this.store.update(persisted.id, { status: 'completed', lastError: undefined });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Provisioning failed';
      return this.store.update(persisted.id, { status: 'failed', lastError: message });
    }
  }
}

export function createPaymentPaidMessage(payment: PaymentIntent): ServiceMessage<{ paymentIntentId: string; externalTransactionId: string; amountMinor: number; currency: string }> {
  return { id: `evt_payment_paid_${payment.id}`, source: 'payments', destination: 'provisioning', topic: 'payment.paid', payload: { paymentIntentId: payment.id, externalTransactionId: payment.externalTransactionId, amountMinor: payment.amountMinor, currency: payment.currency }, createdAt: new Date().toISOString(), external: false };
}

export function registerPaymentFulfillment(bus: ServiceBus, store: FulfillmentStore, provisioner: ProvisionerHandler, configResolver: (payment: PaymentIntent) => PaymentFulfillmentConfig, paymentResolver: (paymentIntentId: string) => Promise<PaymentIntent | undefined>): () => void {
  const fulfillment = new PaymentFulfillment(store, provisioner);
  return bus.subscribe('provisioning', async (message) => {
    if (message.topic !== 'payment.paid') return;
    const payment = await paymentResolver(message.payload.paymentIntentId);
    if (!payment) throw new Error('Payment intent not found for fulfillment event');
    const eventMerchantId = (message.payload as { merchantId?: unknown }).merchantId;
    if (eventMerchantId !== payment.merchantId) throw new Error('Payment event merchant does not match canonical payment intent');
    const job = await fulfillment.enqueue(payment, configResolver(payment));
    if (job.status !== 'completed') await fulfillment.execute(job, payment);
  });
}
