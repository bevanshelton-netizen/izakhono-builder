import { createHmac, timingSafeEqual } from 'node:crypto';

const API_ORIGIN = 'https://api.ikhokha.com';
const PAYMENT_PATH = '/public-api/v1/api/payment';

function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(name + ' is required');
  return value.trim();
}

function escapeSignedPayload(value) {
  return value.replace(/[\\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
}

function signatureFor(path, body, secret) {
  const payload = escapeSignedPayload(path + body);
  return createHmac('sha256', required(secret, 'appSecret')).update(payload, 'utf8').digest('hex');
}

function safeHexEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false;
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Build a signed iK Pay API create-payment-link request.
 * Credentials must come from server-side environment variables, never browser input.
 */
export function buildCreatePaymentLink({ appId, appSecret, entityId, callbackUrl, successUrl, failureUrl, requesterUrl, externalTransactionId, customerReference, amount = 14900, mode = 'live' }) {
  const transactionId = required(externalTransactionId, 'externalTransactionId');
  const body = {
    entityID: required(entityId, 'entityId'),
    externalEntityID: required(customerReference, 'customerReference'),
    amount,
    currency: 'ZAR',
    requesterUrl: required(requesterUrl, 'requesterUrl'),
    description: 'THE BUSINESS OF MUSIC eBook',
    paymentReference: transactionId,
    mode,
    externalTransactionID: transactionId,
    urls: {
      callbackUrl: required(callbackUrl, 'callbackUrl'),
      successPageUrl: required(successUrl, 'successUrl'),
      failurePageUrl: required(failureUrl, 'failureUrl'),
      cancelUrl: required(failureUrl, 'failureUrl'),
    },
  };
  if (!Number.isSafeInteger(amount) || amount !== 14900) throw new RangeError('Unexpected product amount');
  const bodyText = JSON.stringify(body);
  return {
    url: API_ORIGIN + PAYMENT_PATH,
    headers: {
      'Content-Type': 'application/json',
      'IK-APPID': required(appId, 'appId'),
      'IK-SIGN': signatureFor(PAYMENT_PATH, bodyText, appSecret),
    },
    bodyText,
  };
}

/**
 * Verify the iKhokha webhook using the documented JavaScript example:
 * pathname from the configured callback URL + JSON.stringify(parsed body),
 * after removing the optional "text" field. Do not sign raw HTTP bytes.
 */
export function verifyIkhokhaWebhook({ appId, expectedAppId, appSecret, callbackUrl, body, signature }) {
  if (typeof appId !== 'string' || typeof expectedAppId !== 'string' || appId !== expectedAppId) return false;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (typeof callbackUrl !== 'string') return false;
  let pathname;
  try {
    pathname = new URL(callbackUrl).pathname;
  } catch {
    return false;
  }
  if (!pathname.startsWith('/')) return false;
  const normalizedBody = { ...body };
  delete normalizedBody.text;
  const expected = signatureFor(pathname, JSON.stringify(normalizedBody), appSecret);
  return safeHexEqual(expected, signature);
}

/**
 * Callback is only a notification. A separate authenticated iKhokha status lookup
 * must confirm PAID and the expected paylink/transaction before creating a sale.
 */
export function isValidPaymentNotification(body) {
  return Boolean(
    body &&
    body.status === 'SUCCESS' &&
    body.responseCode === '00' &&
    typeof body.paylinkID === 'string' && body.paylinkID.trim() &&
    typeof body.externalTransactionID === 'string' && body.externalTransactionID.trim()
  );
}

export const IKHOKHA_PAYMENT_API = Object.freeze({
  origin: API_ORIGIN,
  createPaymentPath: PAYMENT_PATH,
  productAmount: 14900,
  currency: 'ZAR',
});
