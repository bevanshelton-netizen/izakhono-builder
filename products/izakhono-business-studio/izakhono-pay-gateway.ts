import type {
  PaymentProvider,
  PaymentVerificationRequest,
  PaymentVerifier,
  VerifiedPaymentReceipt
} from './order-provisioning-orchestrator';

export interface IzakhonoPayGatewayConfig {
  baseUrl: string;
  merchantSlug: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  now?: () => string;
}

export interface CreateOrderPaymentInput {
  orderId: string;
  amountMinor: number;
  currency: string;
  email: string;
  idempotencyKey: string;
  returnUrl: string;
  cancelUrl: string;
  description?: string;
}

export interface OrderPaymentCheckout {
  orderId: string;
  intentId: string;
  reference: string;
  merchantSlug: string;
  amountMinor: number;
  currency: string;
  provider: PaymentProvider;
  status: 'requires_action' | 'paid';
  checkoutMethod: string | null;
  checkoutUrl: string | null;
  formFields: Record<string, string> | null;
}

interface ApiIntent {
  id?: unknown;
  reference?: unknown;
  app_slug?: unknown;
  merchant_reference?: unknown;
  amount_minor?: unknown;
  currency?: unknown;
  status?: unknown;
  routed_provider?: unknown;
  provider_reference?: unknown;
  paid_at?: unknown;
  checkout_method?: unknown;
  checkout_url?: unknown;
  form_fields?: unknown;
}

interface ApiResponse {
  ok?: unknown;
  intent?: unknown;
  error?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asProvider(value: unknown): PaymentProvider | null {
  return value === 'ikhokha' || value === 'paystack' || value === 'payfast' ? value : null;
}

function assertHttpsUrl(value: string, field: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(field + '_invalid');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error(field + '_must_use_https');
  return parsed.toString();
}

function parseIntent(body: ApiResponse | null): ApiIntent | null {
  return body && body.ok === true && isRecord(body.intent) ? body.intent as ApiIntent : null;
}

export function createIzakhonoPayGateway(config: IzakhonoPayGatewayConfig): PaymentVerifier & {
  createOrderPaymentIntent(input: CreateOrderPaymentInput): Promise<OrderPaymentCheckout>;
} {
  if (typeof window !== 'undefined') throw new Error('IZAKHONO_PAY_GATEWAY_SERVER_ONLY');
  let base: URL;
  try {
    base = new URL(config.baseUrl);
  } catch {
    throw new Error('IZAKHONO_PAY_BASE_URL_INVALID');
  }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('IZAKHONO_PAY_BASE_URL_MUST_USE_HTTPS_ORIGIN');
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(config.merchantSlug)) throw new Error('IZAKHONO_PAY_MERCHANT_SLUG_INVALID');
  if (!config.apiKey || !config.apiKey.trim()) throw new Error('IZAKHONO_PAY_SERVER_KEY_REQUIRED');

  const fetchImpl = config.fetchImpl || fetch;
  const now = config.now || (() => new Date().toISOString());
  const headers = () => ({
    accept: 'application/json',
    'content-type': 'application/json',
    'x-izakhono-app': config.merchantSlug,
    'x-izakhono-key': config.apiKey
  });
  const endpoint = (path: string) => new URL(path, base.origin).toString();

  return {
    async createOrderPaymentIntent(input: CreateOrderPaymentInput): Promise<OrderPaymentCheckout> {
      if (!/^[A-Za-z0-9._:-]{1,120}$/.test(input.orderId)) throw new Error('order_id_invalid');
      if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 100) throw new Error('payment_amount_invalid');
      const currency = String(input.currency || '').toUpperCase();
      if (currency !== 'ZAR') throw new Error('payment_currency_not_supported');
      const email = String(input.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('customer_email_invalid');
      if (!/^[A-Za-z0-9._:-]{8,120}$/.test(input.idempotencyKey)) throw new Error('idempotency_key_invalid');

      const returnUrl = assertHttpsUrl(input.returnUrl, 'return_url');
      const cancelUrl = assertHttpsUrl(input.cancelUrl, 'cancel_url');
      const payload = {
        amount_minor: input.amountMinor,
        currency,
        email,
        description: input.description || 'Order ' + input.orderId,
        provider: 'smart',
        metadata: { order_id: input.orderId },
        return_url: returnUrl,
        cancel_url: cancelUrl
      };
      const response = await fetchImpl(endpoint('/api/v1/intents'), {
        method: 'POST',
        headers: { ...headers(), 'idempotency-key': input.idempotencyKey },
        body: JSON.stringify(payload),
        redirect: 'error'
      });
      const body = await response.json().catch(() => null) as ApiResponse | null;
      const intent = parseIntent(body);
      if (!response.ok || !intent) {
        const error = isRecord(body?.error) && typeof body.error.code === 'string' ? body.error.code : 'request_failed';
        throw new Error('IZAKHONO_PAY_INTENT_CREATE_FAILED:' + error);
      }

      const provider = asProvider(intent.routed_provider);
      const status = intent.status === 'paid' ? 'paid' : intent.status === 'requires_action' ? 'requires_action' : null;
      const checkoutUrl = typeof intent.checkout_url === 'string' && intent.checkout_url ? intent.checkout_url : null;
      if (
        intent.app_slug !== config.merchantSlug ||
        intent.merchant_reference !== input.orderId ||
        Number(intent.amount_minor) !== input.amountMinor ||
        String(intent.currency || '').toUpperCase() !== currency ||
        typeof intent.id !== 'string' || !intent.id.trim() ||
        typeof intent.reference !== 'string' || !intent.reference.trim() ||
        !provider ||
        !status ||
        (status === 'requires_action' && !checkoutUrl) ||
        (status === 'paid' && (typeof intent.provider_reference !== 'string' || !intent.provider_reference.trim() || typeof intent.paid_at !== 'string' || !intent.paid_at))
      ) throw new Error('IZAKHONO_PAY_INTENT_RESPONSE_MISMATCH');

      return {
        orderId: input.orderId,
        intentId: intent.id,
        reference: intent.reference,
        merchantSlug: config.merchantSlug,
        amountMinor: input.amountMinor,
        currency,
        provider,
        status,
        checkoutMethod: typeof intent.checkout_method === 'string' ? intent.checkout_method : null,
        checkoutUrl,
        formFields: isRecord(intent.form_fields) ? intent.form_fields as Record<string, string> : null
      };
    },

    async verifyPayment(request: PaymentVerificationRequest): Promise<VerifiedPaymentReceipt | null> {
      if (request.merchantSlug !== config.merchantSlug) return null;
      if (!request.intentId || !request.orderId || !Number.isSafeInteger(request.amountMinor) || request.amountMinor <= 0) return null;
      if (!/^[A-Z]{3}$/.test(request.currency)) return null;

      const response = await fetchImpl(endpoint('/api/v1/intents/' + encodeURIComponent(request.intentId)), {
        method: 'GET',
        headers: headers(),
        redirect: 'error'
      });
      const body = await response.json().catch(() => null) as ApiResponse | null;
      const intent = parseIntent(body);
      if (!response.ok || !intent) return null;

      const provider = asProvider(intent.routed_provider);
      const providerTransactionId = typeof intent.provider_reference === 'string' ? intent.provider_reference.trim() : '';
      const paidAt = typeof intent.paid_at === 'string' ? intent.paid_at : '';
      if (
        intent.id !== request.intentId ||
        intent.app_slug !== config.merchantSlug ||
        intent.merchant_reference !== request.orderId ||
        Number(intent.amount_minor) !== request.amountMinor ||
        String(intent.currency || '').toUpperCase() !== request.currency ||
        intent.status !== 'paid' ||
        !provider ||
        !providerTransactionId ||
        !paidAt ||
        !Number.isFinite(Date.parse(paidAt))
      ) return null;

      return {
        ...request,
        status: 'paid',
        provider,
        providerTransactionId,
        paidAt,
        verifiedAt: now(),
        verificationSource: 'IZAKHONO_PAY_SERVER'
      };
    }
  };
}
