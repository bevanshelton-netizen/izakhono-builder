export type PaymentStatus = 'created' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export interface PaymentIntent {
  id: string;
  /** Immutable merchant identity resolved from an authenticated server-side principal. */
  merchantId: string;
  /** Immutable service/product entitlement resolved from the authenticated order context. */
  serviceId: string;
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

/** Provider-side status lookup evidence, normalized to the intent's currency and minor units. */
export interface PaymentWebhookEvidence extends PaymentWebhook {
  amountMinor: number;
  currency: string;
}

/** Supplied only by the server's authenticated request boundary, never from a client payload. */
export interface AuthenticatedMerchantContext { principalId: string; }
/** Canonical tenant and entitlement mapping derived from a verified principal and server-side order. */
export interface ResolvedPaymentOwnership { merchantId: string; serviceId: string; }
export type PaymentOwnershipResolver = (context: AuthenticatedMerchantContext, input: CreatePaymentInput) => Promise<ResolvedPaymentOwnership>;

export interface PaymentProvider {
  readonly id: string;
  createPaymentLink(input: CreatePaymentInput): Promise<PaymentLink>;
  verifyWebhook(rawBody: string, callbackPath: string, signature: string): Promise<boolean>;
  parseWebhook(rawBody: string): PaymentWebhook;
  verifyPaymentEvidence(webhook: PaymentWebhook, intent: PaymentIntent): Promise<PaymentWebhookEvidence>;
}

export interface PaymentStore {
  save(intent: PaymentIntent): Promise<void>;
  getById(id: string): Promise<PaymentIntent | undefined>;
  getByExternalTransactionId(externalTransactionId: string): Promise<PaymentIntent | undefined>;
  update(id: string, patch: Partial<PaymentIntent>): Promise<PaymentIntent>;
  updateIfStatus?(id: string, expectedStatus: PaymentStatus, patch: Partial<PaymentIntent>): Promise<PaymentIntent | undefined>;
}

export class MemoryPaymentStore implements PaymentStore {
  private readonly intents = new Map<string, PaymentIntent>();

  async save(intent: PaymentIntent): Promise<void> {
    if (!intent.merchantId?.trim() || !intent.serviceId?.trim()) throw new Error('Payment merchant identity and service entitlement are required');
    if (this.intents.has(intent.id)) throw new Error('Duplicate payment intent ID');
    this.intents.set(intent.id, { ...intent });
  }

  async getById(id: string): Promise<PaymentIntent | undefined> {
    const intent = this.intents.get(id);
    return intent ? { ...intent } : undefined;
  }

  async getByExternalTransactionId(externalTransactionId: string): Promise<PaymentIntent | undefined> {
    const intent = [...this.intents.values()].find((item) => item.externalTransactionId === externalTransactionId);
    return intent ? { ...intent } : undefined;
  }

  async update(id: string, patch: Partial<PaymentIntent>): Promise<PaymentIntent> {
    const current = this.intents.get(id);
    if (!current) throw new Error(`Unknown payment intent: ${id}`);
    if ((patch.merchantId !== undefined && patch.merchantId !== current.merchantId) || (patch.serviceId !== undefined && patch.serviceId !== current.serviceId)) throw new Error('Payment merchant and service identity are immutable');
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.intents.set(id, updated);
    return { ...updated };
  }

  async updateIfStatus(id: string, expectedStatus: PaymentStatus, patch: Partial<PaymentIntent>): Promise<PaymentIntent | undefined> {
    const current = this.intents.get(id);
    if (!current || current.status !== expectedStatus) return undefined;
    if (patch.merchantId !== undefined && patch.merchantId !== current.merchantId) throw new Error('Payment merchant identity is immutable');
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.intents.set(id, updated);
    return { ...updated };
  }
}

export class IzakhonoPay {
  constructor(
    private readonly store: PaymentStore,
    private readonly provider: PaymentProvider,
    private readonly resolvePaymentOwnership: PaymentOwnershipResolver,
  ) {}

  async getPaymentIntent(id: string): Promise<PaymentIntent | undefined> { return this.store.getById(id); }

  async createPayment(input: CreatePaymentInput, context: AuthenticatedMerchantContext): Promise<{ intent: PaymentIntent; link: PaymentLink }> {
    if (Object.hasOwn(input, 'merchantId') || Object.hasOwn(input, 'serviceId')) throw new Error('Merchant and service IDs must be resolved server-side, not supplied in payment input');
    if (!context?.principalId?.trim()) throw new Error('Authenticated merchant principal is required');
    const ownership = await this.resolvePaymentOwnership(context, input);
    if (!ownership || typeof ownership.merchantId !== 'string' || !ownership.merchantId.trim()) throw new Error('Authenticated principal is not mapped to an active merchant');
    if (typeof ownership.serviceId !== 'string' || !ownership.serviceId.trim()) throw new Error('Payment order is not mapped to an active service entitlement');
    const { merchantId, serviceId } = ownership;
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Payment amount must be a positive integer in minor currency units');
    if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error('Currency must be an ISO 4217 code');
    if (!input.externalTransactionId.trim()) throw new Error('External transaction ID is required');
    if (await this.store.getByExternalTransactionId(input.externalTransactionId)) throw new Error('Duplicate external transaction ID');

    const now = new Date().toISOString();
    const intent: PaymentIntent = {
      id: `pay_${crypto.randomUUID()}`,
      merchantId,
      serviceId,
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
      if (link.provider !== this.provider.id || !link.providerPaymentId?.trim()) throw new Error('Payment provider returned an invalid payment reference');
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
    if (!intent.merchantId?.trim() || !intent.serviceId?.trim()) throw new Error('Payment intent has no trusted merchant identity or service entitlement');
    if (webhook.provider !== intent.provider) throw new Error('Payment webhook provider does not match payment intent');
    const evidence = await this.provider.verifyPaymentEvidence(webhook, intent);
    if (evidence.provider !== intent.provider || evidence.providerPaymentId !== intent.providerPaymentId || evidence.externalTransactionId !== intent.externalTransactionId) throw new Error('Provider payment evidence does not match payment intent references');
    if (!Number.isSafeInteger(evidence.amountMinor) || evidence.amountMinor !== intent.amountMinor) throw new Error('Provider payment evidence amount does not match payment intent');
    if (evidence.currency !== intent.currency) throw new Error('Provider payment evidence currency does not match payment intent');
    if (evidence.status !== webhook.status || evidence.responseCode !== webhook.responseCode) throw new Error('Provider payment evidence contradicts webhook outcome');
    const success = evidence.status === 'SUCCESS' && evidence.responseCode === '00';
    if (intent.status === 'paid' && success) return intent;
    if (intent.status !== 'pending') throw new Error(`Payment webhook cannot transition intent from ${intent.status}`);
    const status: PaymentStatus = success ? 'paid' : 'failed';
    return this.store.update(intent.id, { status });
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
    const body = JSON.parse(rawBody) as { paylinkID?: string; externalTransactionID?: string; status?: string; responseCode?: string };
    if (!body.paylinkID || !body.externalTransactionID || !body.status || !body.responseCode) throw new Error('Invalid iKhokha webhook payload');
    if (body.status !== 'SUCCESS' && body.status !== 'FAILURE') throw new Error('Invalid iKhokha webhook status');
    return { provider: this.id, providerPaymentId: body.paylinkID, externalTransactionId: body.externalTransactionID, status: body.status, responseCode: body.responseCode };
  }

  async verifyPaymentEvidence(webhook: PaymentWebhook, intent: PaymentIntent): Promise<PaymentWebhookEvidence> {
    const path = `/public-api/v1/api/getStatus/external?externalReference=${encodeURIComponent(webhook.externalTransactionId)}`;
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { 'IK-APPID': this.config.appId, 'IK-SIGN': await hmacSha256Hex(path, this.config.appSecret) },
    });
    if (!response.ok) throw new Error(`iKhokha payment-status verification failed: HTTP ${response.status}`);
    const data = await response.json() as { paylinkID?: string; status?: string; amount?: number };
    if (!data.paylinkID || data.paylinkID !== intent.providerPaymentId || data.paylinkID !== webhook.providerPaymentId) throw new Error('iKhokha payment-status reference does not match payment intent');
    if (typeof data.amount !== 'number' || !Number.isSafeInteger(data.amount) || data.amount !== intent.amountMinor) throw new Error('iKhokha payment-status amount does not match payment intent');
    const providerStatus = String(data.status ?? '').toUpperCase();
    const expectedSuccess = webhook.status === 'SUCCESS' && webhook.responseCode === '00';
    if (expectedSuccess && providerStatus !== 'PAID') throw new Error('iKhokha status lookup does not confirm a paid transaction');
    if (!expectedSuccess && !['FAILED', 'FAILURE'].includes(providerStatus)) throw new Error('iKhokha status lookup does not confirm the reported failed transaction');
    return { provider: this.id, providerPaymentId: data.paylinkID, externalTransactionId: intent.externalTransactionId, amountMinor: data.amount, currency: intent.currency, status: webhook.status, responseCode: webhook.responseCode };
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
