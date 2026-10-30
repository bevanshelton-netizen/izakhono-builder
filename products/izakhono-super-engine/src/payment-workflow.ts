import type { EngineModuleId } from './types.js';
import type { ServiceBus, ServiceMessage } from './service-bus.js';
import type { IzakhonoPay, PaymentIntent } from './payment-core.js';
import type { IzakhonoPaymentLedger } from './payment-ledger.js';

export interface PaidPaymentEvent {
  paymentIntentId: string;
  externalTransactionId: string;
  merchantId: string;
  amountMinor: number;
  currency: string;
  provider?: string;
  providerPaymentId?: string;
}

export interface ProvisioningJob {
  id: string;
  paymentIntentId: string;
  merchantId: string;
  status: 'queued' | 'completed' | 'failed';
  createdAt: string;
}

export type ProvisioningHandler = (job: ProvisioningJob, event: PaidPaymentEvent) => Promise<void>;

/** Connects confirmed payments to the internal ledger and provisioning fabric. */
export class PaymentWorkflow {
  private readonly processed = new Set<string>();
  private readonly jobs = new Map<string, ProvisioningJob>();

  constructor(
    private readonly payments: IzakhonoPay,
    private readonly ledger: IzakhonoPaymentLedger,
    private readonly bus: ServiceBus,
    private readonly provisioningHandler?: ProvisioningHandler,
  ) {}

  async processConfirmedWebhook(rawBody: string, callbackPath: string, signature: string, merchantId: string): Promise<PaymentIntent> {
    const intent = await this.payments.processWebhook(rawBody, callbackPath, signature);
    if (intent.status !== 'paid') return intent;
    await this.handlePaid(intent, merchantId);
    return intent;
  }

  async handlePaid(intent: PaymentIntent, merchantId: string): Promise<ProvisioningJob | undefined> {
    const key = intent.id;
    if (this.processed.has(key)) return this.jobs.get(key);
    await this.ledger.recordPayment({
      paymentIntentId: intent.id,
      merchantId,
      amountMinor: intent.amountMinor,
      currency: intent.currency,
    });
    const job: ProvisioningJob = {
      id: `provision_${crypto.randomUUID()}`,
      paymentIntentId: intent.id,
      merchantId,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(key, job);
    this.processed.add(key);

    const message: ServiceMessage<PaidPaymentEvent> = {
      id: `evt_${crypto.randomUUID()}`,
      source: 'payments' as EngineModuleId,
      destination: 'provisioning' as EngineModuleId,
      topic: 'payment.paid',
      payload: {
        paymentIntentId: intent.id,
        externalTransactionId: intent.externalTransactionId,
        merchantId,
        amountMinor: intent.amountMinor,
        currency: intent.currency,
        provider: intent.provider,
        providerPaymentId: intent.providerPaymentId,
      },
      createdAt: new Date().toISOString(),
      external: false,
    };
    await this.bus.publish(message);
    if (this.provisioningHandler) {
      try {
        await this.provisioningHandler(job, message.payload);
        job.status = 'completed';
      } catch (error) {
        job.status = 'failed';
        throw error;
      }
    }
    return { ...job };
  }

  getProvisioningJob(paymentIntentId: string): ProvisioningJob | undefined {
    const job = this.jobs.get(paymentIntentId);
    return job ? { ...job } : undefined;
  }
}
