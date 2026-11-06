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
 * Verify the documented iKhokha callback signature against the exact callback path
 * and raw JSON body. Callers must preserve rawBody before JSON parsing.
 */
export function verifyIkhokhaWebhook({ appId, expectedAppId, appSecret, callbackPath, rawBody, signature }) {
  if (required(appId, 'appId') !== required(expectedAppId, 'expectedAppId')) return false;
  if (typeof rawBody !== 'string' || !rawBody.length) return false;
  if (typeof callbackPath !== 'string' || !callbackPath.startsWith('/')) return false;
  const expected = signatureFor(callbackPath, rawBody, appSecret);
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
