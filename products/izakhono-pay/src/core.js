import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const PAYFAST_DEFAULT_CIDRS = [
  '197.97.145.144/28',
  '41.74.179.192/27',
  '102.216.36.0/28',
  '102.216.36.128/28',
  '144.126.193.139/32'
];

export function sha256Hex(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function md5Hex(value) {
  return createHash('md5').update(String(value)).digest('hex');
}

export function safeEqualText(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

export function merchantWebhookSignature(rawBody, timestamp, secret) {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

export function verifyMerchantWebhookSignature(rawBody, timestamp, signature, secret) {
  if (!timestamp || !signature || !secret) return false;
  return safeEqualText(merchantWebhookSignature(rawBody, timestamp, secret), signature);
}

export function payfastEncode(value) {
  return encodeURIComponent(String(value).trim())
    .replace(/%20/g, '+')
    .replace(/%[0-9a-f]{2}/gi, (m) => m.toUpperCase());
}

export function payfastParamString(entries) {
  return entries
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== '')
    .map(([key, value]) => `${key}=${payfastEncode(value)}`)
    .join('&');
}

export function payfastSignature(entries, passphrase = '') {
  let source = payfastParamString(entries);
  if (passphrase) source += `&passphrase=${payfastEncode(passphrase)}`;
  return md5Hex(source);
}

export function buildPayfastCheckout({ env, intent, origin }) {
  const sandbox = env.PAYFAST_SANDBOX === 'true' || env.PAYMENT_MODE === 'sandbox';
  const endpoint = sandbox ? 'https://sandbox.payfast.co.za/eng/process' : 'https://www.payfast.co.za/eng/process';
  const amount = (intent.amount_minor / 100).toFixed(2);
  const returnUrl = intent.return_url || `${origin}/?payment=return&reference=${encodeURIComponent(intent.reference)}`;
  const cancelUrl = intent.cancel_url || `${origin}/?payment=cancelled&reference=${encodeURIComponent(intent.reference)}`;
  const entries = [
    ['merchant_id', env.PAYFAST_MERCHANT_ID],
    ['merchant_key', env.PAYFAST_MERCHANT_KEY],
    ['return_url', returnUrl],
    ['cancel_url', cancelUrl],
    ['notify_url', `${origin}/api/webhooks/payfast`],
    ['email_address', intent.customer_email],
    ['m_payment_id', intent.reference],
    ['amount', amount],
    ['item_name', intent.description || 'IZAKHONO PAY transaction'],
    ['item_description', `Payment reference ${intent.reference}`]
  ];
  const fields = Object.fromEntries(entries.filter(([, v]) => v !== undefined && v !== null && String(v) !== ''));
  fields.signature = payfastSignature(entries, env.PAYFAST_PASSPHRASE || '');
  return { endpoint, fields };
}

export function providerConfigured(env, provider) {
  if (provider === 'paystack') return env.PAYSTACK_ENABLED !== 'false' && Boolean(env.PAYSTACK_SECRET_KEY);
  if (provider === 'payfast') {
    return env.PAYFAST_ENABLED !== 'false' && Boolean(env.PAYFAST_MERCHANT_ID && env.PAYFAST_MERCHANT_KEY);
  }
  if (provider === 'mock') return env.PAYMENT_MODE === 'mock';
  return false;
}

export function chooseProvider(env, currency, requested = 'smart') {
  const code = String(currency || '').toUpperCase();
  const mode = env.PAYMENT_MODE || 'mock';
  if (mode === 'mock') return 'mock';
  if (code !== 'ZAR') return null;
  if (requested !== 'smart') return providerConfigured(env, requested) ? requested : null;
  if (providerConfigured(env, 'paystack')) return 'paystack';
  if (providerConfigured(env, 'payfast')) return 'payfast';
  return null;
}

export function paystackSignature(rawBody, secret) {
  return createHmac('sha512', secret).update(rawBody).digest('hex');
}

export function verifyPaystackSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  return safeEqualText(paystackSignature(rawBody, secret), signature);
}

function ipToInt(ip) {
  const parts = String(ip).split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

export function ipv4InCidr(ip, cidr) {
  const [network, bitsText = '32'] = String(cidr).split('/');
  const bits = Number(bitsText);
  const ipInt = ipToInt(ip);
  const netInt = ipToInt(network);
  if (ipInt === null || netInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
}

export function payfastIpAllowed(ip, cidrs = PAYFAST_DEFAULT_CIDRS) {
  return cidrs.some((cidr) => ipv4InCidr(ip, cidr));
}

export function buildPayfastItnParamString(rawBody) {
  const params = new URLSearchParams(rawBody);
  const entries = [];
  for (const [key, value] of params.entries()) {
    if (key === 'signature') break;
    entries.push([key, value]);
  }
  return payfastParamString(entries);
}

export function verifyPayfastItnSignature(rawBody, passphrase = '') {
  const params = new URLSearchParams(rawBody);
  const supplied = params.get('signature') || '';
  let source = buildPayfastItnParamString(rawBody);
  if (passphrase) source += `&passphrase=${payfastEncode(passphrase)}`;
  return supplied !== '' && safeEqualText(md5Hex(source), supplied);
}
