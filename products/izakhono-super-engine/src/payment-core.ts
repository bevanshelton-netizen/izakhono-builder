export type PaymentStatus = 'created' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export interface PaymentIntent {
  id: string;
  externalTransactionId: string;
  amountMinor: number;
  currency: string;
  description?: string;
  status: PaymentStatus;
  provider?: string;
  providerPaymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentInput {
  externalTransactionId: string;
  amountMinor: number;
  currency: 'ZAR' | string;
  description?: string;
  requesterUrl: string;
  callbackUrl: string;
  successPageUrl: string;
  failurePageUrl: string;
  cancelUrl?: string;
  mode?: 'live';
}

export interface PaymentLink {
  paymentIntentId: string;
  provider: string;
  providerPaymentId: string;
  url: string;
}

export interface PaymentWebhook {
  provider: string;
  providerPaymentId: string;
  externalTransactionId: string;
  status: 'SUCCESS' | 'FAILURE';
  responseCode: string;
}

export interface PaymentProvider {
  readonly id: string;
  createPaymentLink(input: CreatePaymentInput): Promise<PaymentLink>;
  verifyWebhook(rawBody: string, callbackPath: string, signature: string): Promise<boolean>;
  parseWebhook(rawBody: string): PaymentWebhook;
}

export interface PaymentStore {
  save(intent: PaymentIntent): Promise<void>;
  getByExternalTransactionId(externalTransactionId: string): Promise<PaymentIntent | undefined>;
  update(id: string, patch: Partial<PaymentIntent>): Promise<PaymentIntent>;
}

export class MemoryPaymentStore implements PaymentStore {
  private readonly intents = new Map<string, PaymentIntent>();

  async save(intent: PaymentIntent): Promise<void> {
    this.intents.set(intent.id, { ...intent });
  }

  async getByExternalTransactionId(externalTransactionId: string): Promise<PaymentIntent | undefined> {
    const intent = [...this.intents.values()].find((item) => item.externalTransactionId === externalTransactionId);
    return intent ? { ...intent } : undefined;
  }

  async update(id: string, patch: Partial<PaymentIntent>): Promise<PaymentIntent> {
    const current = this.intents.get(id);
    if (!current) throw new Error(`Unknown payment intent: ${id}`);
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.intents.set(id, updated);
    return { ...updated };
  }
}

export class IzakhonoPay {
  constructor(private readonly store: PaymentStore, private readonly provider: PaymentProvider) {}

  async createPayment(input: CreatePaymentInput): Promise<{ intent: PaymentIntent; link: PaymentLink }> {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Payment amount must be a positive integer in minor currency units');
    if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error('Currency must be an ISO 4217 code');
    if (!input.externalTransactionId.trim()) throw new Error('External transaction ID is required');
    if (await this.store.getByExternalTransactionId(input.externalTransactionId)) throw new Error('Duplicate external transaction ID');

    const now = new Date().toISOString();
    const intent: PaymentIntent = {
      id: `pay_${crypto.randomUUID()}`,
      externalTransactionId: input.externalTransactionId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      description: input.description,
      status: 'created',
      provider: this.provider.id,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.save(intent);
    try {
      const link = await this.provider.createPaymentLink(input);
      const updated = await this.store.update(intent.id, { status: 'pending', providerPaymentId: link.providerPaymentId });
      return { intent: updated, link: { ...link, paymentIntentId: intent.id } };
    } catch (error) {
      await this.store.update(intent.id, { status: 'failed' });
      throw error;
    }
  }

  async processWebhook(rawBody: string, callbackPath: string, signature: string): Promise<PaymentIntent> {
    if (!(await this.provider.verifyWebhook(rawBody, callbackPath, signature))) throw new Error('Invalid payment webhook signature');
    const webhook = this.provider.parseWebhook(rawBody);
    const intent = await this.store.getByExternalTransactionId(webhook.externalTransactionId);
    if (!intent) throw new Error('Unknown payment transaction');
    const status: PaymentStatus = webhook.status === 'SUCCESS' && webhook.responseCode === '00' ? 'paid' : 'failed';
    return this.store.update(intent.id, { status, providerPaymentId: webhook.providerPaymentId });
  }
}

export interface IKhokhaConfig {
  appId: string;
  appSecret: string;
  entityId: string;
  externalEntityId?: string;
  baseUrl?: string;
}

/** iK Pay API adapter. Credentials must remain server-side; never expose appSecret to clients. */
export class IKhokhaProvider implements PaymentProvider {
  readonly id = 'ikhokha';
  private readonly baseUrl: string;

  constructor(private readonly config: IKhokhaConfig, private readonly fetcher: typeof fetch = fetch) {
    this.baseUrl = config.baseUrl ?? 'https://api.ikhokha.com';
  }

  async createPaymentLink(input: CreatePaymentInput): Promise<PaymentLink> {
    const path = '/public-api/v1/api/payment';
    const body = JSON.stringify({
      entityID: this.config.entityId,
      externalEntityID: this.config.externalEntityId,
      amount: input.amountMinor,
      currency: input.currency,
      requesterUrl: input.requesterUrl,
      mode: input.mode ?? 'live',
      description: input.description,
      externalTransactionID: input.externalTransactionId,
      urls: {
        callbackUrl: input.callbackUrl,
        successPageUrl: input.successPageUrl,
        failurePageUrl: input.failurePageUrl,
        cancelUrl: input.cancelUrl,
      },
    });
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'IK-APPID': this.config.appId, 'IK-SIGN': await hmacSha256Hex(path + body, this.config.appSecret) },
      body,
    });
    if (!response.ok) throw new Error(`iKhokha payment creation failed: HTTP ${response.status}`);
    const data = await response.json() as { responseCode?: string; message?: string; paylinkUrl?: string; paylinkID?: string; externalTransactionID?: string };
    if (data.responseCode !== '00' || !data.paylinkUrl || !data.paylinkID) throw new Error(data.message || 'iKhokha rejected payment creation');
    return { paymentIntentId: '', provider: this.id, providerPaymentId: data.paylinkID, url: data.paylinkUrl };
  }

  async verifyWebhook(rawBody: string, callbackPath: string, signature: string): Promise<boolean> {
    const expected = await hmacSha256Hex(callbackPath + rawBody, this.config.appSecret);
    return timingSafeEqual(expected, signature);
  }

  parseWebhook(rawBody: string): PaymentWebhook {
    const body = JSON.parse(rawBody) as Partial<PaymentWebhook>;
    if (!body.paylinkID || !body.externalTransactionID || !body.status || !body.responseCode) throw new Error('Invalid iKhokha webhook payload');
    if (body.status !== 'SUCCESS' && body.status !== 'FAILURE') throw new Error('Invalid iKhokha webhook status');
    return { provider: this.id, providerPaymentId: body.paylinkID, externalTransactionId: body.externalTransactionID, status: body.status, responseCode: body.responseCode };
  }
}

async function hmacSha256Hex(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
