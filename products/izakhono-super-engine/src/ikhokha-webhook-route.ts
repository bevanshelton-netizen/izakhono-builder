import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PaymentIntent } from './payment-core.js';
import type { PaymentWebhookGuard } from './payment-webhook-guard.js';

export interface IKhokhaWebhookRouteConfig {
  /** Exact configured callback path, including any path prefix used in the iKhokha HMAC contract. */
  callbackPath: string;
  /** Header name supplied by the merchant's confirmed iKhokha callback configuration. */
  signatureHeader: string;
  guard: Pick<PaymentWebhookGuard, 'process'>;
  /** Must be idempotent: a legitimate provider retry can invoke this callback again. */
  onPaid(payment: PaymentIntent): Promise<void>;
  maxBodyBytes?: number;
}

function reply(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

/**
 * Raw-body iKhokha callback route. It never parses JSON or trusts browser redirect data.
 * Signature verification and webhook parsing are delegated to PaymentWebhookGuard.
 */
export function createIKhokhaWebhookRoute(config: IKhokhaWebhookRouteConfig) {
  if (!config.callbackPath.startsWith('/')) throw new Error('Webhook callback path must be an absolute URL path');
  if (!/^[a-z0-9-]+$/i.test(config.signatureHeader)) throw new Error('A confirmed signature header name is required');
  if (!config.onPaid) throw new Error('Paid-payment handler is required');
  const maxBodyBytes = config.maxBodyBytes ?? 64 * 1024;
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1) throw new Error('Webhook body limit must be a positive integer');

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const requestPath = (req.url ?? '').split('?', 1)[0];
    if (requestPath !== config.callbackPath) return false;
    if (req.method !== 'POST') {
      reply(res, 405, { ok: false, error: 'method_not_allowed' });
      return true;
    }

    const chunks: Buffer[] = [];
    let bytes = 0;
    try {
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > maxBodyBytes) {
          req.destroy();
          reply(res, 413, { ok: false, error: 'payload_too_large' });
          return true;
        }
        chunks.push(buffer);
      }
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const headerValue = req.headers[config.signatureHeader.toLowerCase()];
      const signature = Array.isArray(headerValue) ? headerValue[0] : headerValue;
      if (!signature) {
        reply(res, 401, { ok: false, error: 'missing_signature' });
        return true;
      }

      const payment = await config.guard.process(rawBody, config.callbackPath, signature);
      if (payment.status === 'paid') await config.onPaid(payment);
      reply(res, 200, { ok: true, paymentIntentId: payment.id, paymentStatus: payment.status });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Webhook processing failed';
      const status = /signature/i.test(message) ? 401 :
        /unknown payment|does not match|contradictory|invalid .*payload|invalid .*status/i.test(message) ? 400 : 500;
      reply(res, status, { ok: false, error: status === 401 ? 'invalid_signature' : status === 400 ? 'invalid_payment_callback' : 'webhook_processing_failed' });
      return true;
    }
  };
}
