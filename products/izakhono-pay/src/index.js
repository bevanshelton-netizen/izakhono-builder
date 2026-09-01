import {
  PAYFAST_DEFAULT_CIDRS,
  buildPayfastCheckout,
  buildPayfastItnParamString,
  chooseProvider,
  payfastIpAllowed,
  providerConfigured,
  safeEqualText,
  sha256Hex,
  verifyPayfastItnSignature,
  verifyPaystackSignature
} from './core.js';
import { dispatchMerchantPaymentPaid } from './merchant-webhooks.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function response(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
}

function fail(message, status = 400, code = 'bad_request') {
  return response({ ok: false, error: { code, message } }, status);
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}

function paymentReference() {
  return `IZP-${crypto.randomUUID().replaceAll('-', '')}`;
}

function cleanText(value, max = 255) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function validateMerchantReturnUrl(rawValue, allowedOrigin) {
  const raw = cleanText(rawValue, 1200);
  if (!raw) return null;
  const allowed = cleanText(allowedOrigin, 1000);
  if (!allowed) throw new Error('Merchant return origin is not configured');
  let url;
  let origin;
  try {
    url = new URL(raw);
    origin = new URL(allowed);
  } catch {
    throw new Error('Merchant return URL is invalid');
  }
  if (url.protocol !== 'https:' || origin.protocol !== 'https:' || url.username || url.password || origin.username || origin.password) {
    throw new Error('Merchant return URLs must use HTTPS');
  }
  if (url.origin !== origin.origin) throw new Error('Merchant return URL is outside the approved origin');
  return url.toString();
}

function adminAuthorized(req, env) {
  const secret = req.headers.get('x-admin-secret') || '';
  return Boolean(env.ADMIN_SECRET && secret && safeEqualText(secret, env.ADMIN_SECRET));
}

async function authorizeMerchant(req, env) {
  const key = cleanText(req.headers.get('x-izakhono-key') || '', 512);
  const slug = cleanText(req.headers.get('x-izakhono-app') || '', 60).toLowerCase();
  if (!key || !slug) return null;
  const keyHash = sha256Hex(key);
  return env.DB.prepare("SELECT id,slug,display_name,status,fortress_required,return_origin FROM merchant_apps WHERE slug=? AND api_key_hash=? AND status='active'")
    .bind(slug, keyHash).first();
}

async function parseJson(req) {
  if (!(req.headers.get('content-type') || '').includes('application/json')) throw new Error('Expected application/json');
  return req.json();
}

async function findIntentByReference(env, reference) {
  return env.DB.prepare('SELECT * FROM payment_intents WHERE reference=?').bind(reference).first();
}

async function findIntentById(env, intentId) {
  return env.DB.prepare('SELECT * FROM payment_intents WHERE id=?').bind(intentId).first();
}

async function findMerchantIntentById(env, merchantSlug, intentId) {
  return env.DB.prepare('SELECT * FROM payment_intents WHERE id=? AND app_slug=?').bind(intentId, merchantSlug).first();
}

async function findIntentByIdempotency(env, appSlug, idempotencyKey) {
  return env.DB.prepare('SELECT * FROM payment_intents WHERE app_slug=? AND idempotency_key=?').bind(appSlug, idempotencyKey).first();
}

async function recordEvent(env, provider, eventType, fingerprint, intentId, payload, verified = true) {
  try {
    await env.DB.prepare('INSERT INTO payment_events(id,provider,fingerprint,event_type,intent_id,payload_json,verified) VALUES(?,?,?,?,?,?,?)')
      .bind(id('evt'), provider, fingerprint, eventType, intentId || null, JSON.stringify(payload).slice(0, 50000), verified ? 1 : 0).run();
    return true;
  } catch {
    return false;
  }
}

async function recordFortressEvent(env, { severity = 'medium', category, source, merchantSlug = null, intentId = null, details = {} }) {
  try {
    const fingerprint = sha256Hex(`${category}:${source}:${merchantSlug || ''}:${intentId || ''}:${crypto.randomUUID()}`);
    await env.DB.prepare('INSERT INTO fortress_security_events(id,severity,category,source,merchant_slug,intent_id,fingerprint,details_json,fortress_status) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(id('sec'), severity, category, source, merchantSlug, intentId, fingerprint, JSON.stringify(details).slice(0, 12000), 'pending').run();
  } catch {
    // Payment processing must not depend on the alpha FORTRESS outbox being available.
  }
}

async function markPaid(env, intentId, providerReference = null) {
  await env.DB.prepare("UPDATE payment_intents SET status='paid',provider_reference=COALESCE(?,provider_reference),paid_at=COALESCE(paid_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=? AND status!='paid'")
    .bind(providerReference, intentId).run();
  const paidIntent = await findIntentById(env, intentId);
  if (paidIntent) await dispatchMerchantPaymentPaid(env, paidIntent);
  return paidIntent;
}

function metadataJson(input) {
  const raw = JSON.stringify(input && typeof input === 'object' && !Array.isArray(input) ? input : {});
  if (raw.length > 8000) throw new Error('metadata is too large');
  return raw;
}

function normalizeIntent(intent) {
  return {
    id: intent.id,
    reference: intent.reference,
    app_slug: intent.app_slug,
    amount_minor: Number(intent.amount_minor),
    currency: intent.currency,
    customer_email: intent.customer_email,
    description: intent.description,
    requested_provider: intent.requested_provider,
    routed_provider: intent.routed_provider,
    status: intent.status,
    provider_reference: intent.provider_reference || null,
    checkout_method: intent.checkout_method || null,
    checkout_url: intent.checkout_url || null,
    created_at: intent.created_at,
    updated_at: intent.updated_at,
    paid_at: intent.paid_at || null
  };
}

function renderIntent(req, env, intent) {
  const output = normalizeIntent(intent);
  if (intent.status === 'requires_action' && intent.routed_provider === 'payfast') {
    const origin = new URL(req.url).origin;
    const pf = buildPayfastCheckout({ env, intent, origin });
    output.checkout_method = 'form_post';
    output.checkout_url = pf.endpoint;
    output.form_fields = pf.fields;
  }
  return output;
}

async function initializePaystack(env, intent, origin) {
  const payload = {
    email: intent.customer_email,
    amount: String(intent.amount_minor),
    currency: intent.currency,
    reference: intent.reference,
    callback_url: intent.return_url || `${origin}/?payment=return&reference=${encodeURIComponent(intent.reference)}`,
    metadata: JSON.stringify({ intent_id: intent.id, app_slug: intent.app_slug })
  };
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.status || !data?.data?.authorization_url) {
    throw new Error(`Paystack initialization failed (${res.status})`);
  }
  return {
    checkout_url: data.data.authorization_url,
    checkout_method: 'redirect',
    provider_reference: data.data.reference || intent.reference
  };
}

async function initializeIntent(req, env, input, { demo = false, merchant = null } = {}) {
  const amountMinor = Number(input.amount_minor);
  const currency = cleanText(input.currency || 'ZAR', 3).toUpperCase();
  const email = cleanText(input.email, 254).toLowerCase();
  const description = cleanText(input.description || 'IZAKHONO PAY transaction', 180);
  const requestedProvider = cleanText(input.provider || 'smart', 20).toLowerCase();
  const appSlug = demo ? 'demo' : cleanText(merchant?.slug || '', 60).toLowerCase();
  const idempotencyKey = demo ? null : cleanText(req.headers.get('idempotency-key') || '', 120);
  let metadata;
  let returnUrl = null;
  let cancelUrl = null;
  try {
    metadata = metadataJson(input.metadata);
    if (!demo) {
      returnUrl = validateMerchantReturnUrl(input.return_url, merchant?.return_origin);
      cancelUrl = validateMerchantReturnUrl(input.cancel_url, merchant?.return_origin);
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Invalid merchant checkout URL', 422, 'invalid_return_url');
  }

  if (!Number.isSafeInteger(amountMinor) || amountMinor < 100 || amountMinor > 1000000000) return fail('amount_minor must be an integer between 100 and 1,000,000,000', 422, 'invalid_amount');
  if (!validEmail(email)) return fail('A valid customer email is required', 422, 'invalid_email');
  if (currency !== 'ZAR') return fail('Alpha currently supports ZAR checkout only; international cards can still be accepted by enabled providers where the merchant account permits it.', 422, 'unsupported_currency');
  if (!['smart','paystack','payfast'].includes(requestedProvider)) return fail('provider must be smart, paystack, or payfast', 422, 'invalid_provider');
  if (!demo && !/^[A-Za-z0-9._:-]{8,120}$/.test(idempotencyKey)) return fail('A stable 8-120 character Idempotency-Key header is required', 422, 'invalid_idempotency_key');
  if (!demo && !appSlug) return fail('Merchant identity is required', 401, 'unauthorized');
  if (demo && env.PAYMENT_MODE !== 'mock') return fail('Public demo checkout is disabled outside mock mode', 403, 'demo_disabled');

  const fingerprint = demo ? null : sha256Hex(JSON.stringify({ appSlug, amountMinor, currency, email, description, requestedProvider, metadata, returnUrl, cancelUrl }));

  if (!demo) {
    const existing = await findIntentByIdempotency(env, appSlug, idempotencyKey);
    if (existing) {
      if (existing.idempotency_fingerprint !== fingerprint) {
        await recordFortressEvent(env, {
          severity: 'high', category: 'payment.idempotency_mismatch', source: 'izakhono-pay', merchantSlug: appSlug, intentId: existing.id,
          details: { idempotency_key_hash: sha256Hex(idempotencyKey) }
        });
        return fail('This idempotency key was already used for a different payment request', 409, 'idempotency_mismatch');
      }
      return response({ ok: true, idempotent_replay: true, intent: renderIntent(req, env, existing) }, 200);
    }
  }

  const routedProvider = demo ? 'mock' : chooseProvider(env, currency, requestedProvider);
  if (!routedProvider) return fail('No configured provider can safely handle this transaction', 503, 'no_provider');
  if (routedProvider === 'payfast' && amountMinor < 500) return fail('PayFast live transactions must be at least R5.00', 422, 'provider_minimum');

  const intent = {
    id: id('pi'),
    reference: paymentReference(),
    app_slug: appSlug || 'demo',
    amount_minor: amountMinor,
    currency,
    customer_email: email,
    description,
    requested_provider: requestedProvider,
    routed_provider: routedProvider,
    status: 'created',
    idempotency_key: idempotencyKey,
    idempotency_fingerprint: fingerprint,
    metadata_json: metadata,
    return_url: returnUrl,
    cancel_url: cancelUrl
  };

  try {
    await env.DB.prepare('INSERT INTO payment_intents(id,reference,app_slug,amount_minor,currency,customer_email,description,requested_provider,routed_provider,status,metadata_json,idempotency_key,idempotency_fingerprint,return_url,cancel_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(intent.id, intent.reference, intent.app_slug, intent.amount_minor, intent.currency, intent.customer_email, intent.description, intent.requested_provider, intent.routed_provider, intent.status, intent.metadata_json, intent.idempotency_key, intent.idempotency_fingerprint, intent.return_url, intent.cancel_url).run();
  } catch (error) {
    if (!demo) {
      const existing = await findIntentByIdempotency(env, appSlug, idempotencyKey);
      if (existing && existing.idempotency_fingerprint === fingerprint) {
        return response({ ok: true, idempotent_replay: true, intent: renderIntent(req, env, existing) }, 200);
      }
    }
    throw error;
  }

  const origin = new URL(req.url).origin;
  try {
    if (routedProvider === 'mock') {
      const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
      const checkoutUrl = `${origin}/mock-checkout.html?intent=${encodeURIComponent(intent.id)}&token=${encodeURIComponent(token)}`;
      await env.DB.prepare("UPDATE payment_intents SET status='requires_action',checkout_method='redirect',checkout_url=?,checkout_token_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(checkoutUrl, sha256Hex(token), intent.id).run();
      return response({ ok: true, intent: { ...normalizeIntent({ ...intent, status: 'requires_action', checkout_method: 'redirect', checkout_url: checkoutUrl }), checkout_url: checkoutUrl } }, 201);
    }

    if (routedProvider === 'paystack') {
      const checkout = await initializePaystack(env, intent, origin);
      await env.DB.prepare("UPDATE payment_intents SET status='requires_action',checkout_url=?,checkout_method=?,provider_reference=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(checkout.checkout_url, checkout.checkout_method, checkout.provider_reference, intent.id).run();
      return response({ ok: true, intent: { ...normalizeIntent({ ...intent, status: 'requires_action', ...checkout }), ...checkout } }, 201);
    }

    const pf = buildPayfastCheckout({ env, intent, origin });
    await env.DB.prepare("UPDATE payment_intents SET status='requires_action',checkout_url=?,checkout_method='form_post',updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(pf.endpoint, intent.id).run();
    return response({ ok: true, intent: { ...normalizeIntent({ ...intent, status: 'requires_action', checkout_method: 'form_post', checkout_url: pf.endpoint }), checkout_method: 'form_post', checkout_url: pf.endpoint, form_fields: pf.fields } }, 201);
  } catch (error) {
    await env.DB.prepare("UPDATE payment_intents SET status='failed',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(intent.id).run();
    await recordFortressEvent(env, {
      severity: 'high', category: 'payment.provider_initialization_failed', source: routedProvider, merchantSlug: intent.app_slug, intentId: intent.id,
      details: { provider: routedProvider }
    });
    return fail(error instanceof Error ? error.message : 'Provider initialization failed', 502, 'provider_error');
  }
}

async function handlePaystackWebhook(req, env) {
  if (!env.PAYSTACK_SECRET_KEY) return fail('Paystack webhook is not configured', 503, 'provider_unconfigured');
  const raw = await req.text();
  const signature = req.headers.get('x-paystack-signature') || '';
  if (!verifyPaystackSignature(raw, signature, env.PAYSTACK_SECRET_KEY)) {
    await recordFortressEvent(env, { severity: 'high', category: 'webhook.invalid_signature', source: 'paystack', details: { payload_hash: sha256Hex(raw) } });
    return fail('Invalid Paystack signature', 401, 'invalid_signature');
  }
  const event = JSON.parse(raw);
  const reference = event?.data?.reference;
  const intent = reference ? await findIntentByReference(env, reference) : null;
  const fingerprint = sha256Hex(`paystack:${raw}`);
  const fresh = await recordEvent(env, 'paystack', cleanText(event?.event || 'unknown', 80), fingerprint, intent?.id, event, true);
  if (!fresh) return response({ ok: true, duplicate: true });

  if (event?.event === 'charge.success' && intent) {
    const amountMatches = Number(event?.data?.amount) === Number(intent.amount_minor);
    const currencyMatches = String(event?.data?.currency || '').toUpperCase() === intent.currency;
    if (!amountMatches || !currencyMatches) {
      await recordFortressEvent(env, { severity: 'critical', category: 'payment.amount_or_currency_mismatch', source: 'paystack', merchantSlug: intent.app_slug, intentId: intent.id, details: { reference } });
      return fail('Verified webhook did not match the expected amount/currency', 409, 'payment_mismatch');
    }
    await markPaid(env, intent.id, String(event?.data?.id || reference));
  }
  return response({ ok: true });
}

async function handlePayfastWebhook(req, env) {
  if (!env.PAYFAST_MERCHANT_ID || !env.PAYFAST_MERCHANT_KEY) return fail('PayFast webhook is not configured', 503, 'provider_unconfigured');
  const raw = await req.text();
  const params = new URLSearchParams(raw);
  const reference = params.get('m_payment_id') || '';
  const intent = reference ? await findIntentByReference(env, reference) : null;
  if (!intent) return fail('Unknown PayFast payment reference', 404, 'unknown_reference');

  if (!verifyPayfastItnSignature(raw, env.PAYFAST_PASSPHRASE || '')) {
    await recordFortressEvent(env, { severity: 'high', category: 'webhook.invalid_signature', source: 'payfast', merchantSlug: intent.app_slug, intentId: intent.id, details: { reference } });
    return fail('Invalid PayFast signature', 401, 'invalid_signature');
  }

  if (env.PAYFAST_REQUIRE_IP !== 'false') {
    const ip = req.headers.get('cf-connecting-ip') || '';
    const cidrs = cleanText(env.PAYFAST_ALLOWED_CIDRS || '', 1000).split(',').map((s) => s.trim()).filter(Boolean);
    if (!payfastIpAllowed(ip, cidrs.length ? cidrs : PAYFAST_DEFAULT_CIDRS)) {
      await recordFortressEvent(env, { severity: 'high', category: 'webhook.invalid_source', source: 'payfast', merchantSlug: intent.app_slug, intentId: intent.id, details: { reference } });
      return fail('PayFast source IP was not allow-listed', 401, 'invalid_source');
    }
  }

  const amountGross = Number(params.get('amount_gross'));
  if (!Number.isFinite(amountGross) || Math.abs(amountGross - Number(intent.amount_minor) / 100) > 0.01) {
    await recordFortressEvent(env, { severity: 'critical', category: 'payment.amount_mismatch', source: 'payfast', merchantSlug: intent.app_slug, intentId: intent.id, details: { reference } });
    return fail('PayFast amount did not match the payment intent', 409, 'payment_mismatch');
  }

  const host = env.PAYFAST_SANDBOX === 'true' || env.PAYMENT_MODE === 'sandbox' ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';
  const validation = await fetch(`https://${host}/eng/query/validate`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: buildPayfastItnParamString(raw)
  });
  const validationText = (await validation.text()).trim();
  if (!validation.ok || validationText !== 'VALID') {
    await recordFortressEvent(env, { severity: 'high', category: 'webhook.provider_confirmation_failed', source: 'payfast', merchantSlug: intent.app_slug, intentId: intent.id, details: { reference } });
    return fail('PayFast server confirmation failed', 401, 'provider_confirmation_failed');
  }

  const fingerprint = sha256Hex(`payfast:${raw}`);
  const payload = Object.fromEntries(params.entries());
  const fresh = await recordEvent(env, 'payfast', `payment.${params.get('payment_status') || 'unknown'}`, fingerprint, intent.id, payload, true);
  if (!fresh) return new Response('OK', { status: 200 });

  if (params.get('payment_status') === 'COMPLETE') await markPaid(env, intent.id, params.get('pf_payment_id'));
  return new Response('OK', { status: 200 });
}

async function handleMockComplete(req, env) {
  if (env.PAYMENT_MODE !== 'mock') return fail('Mock completion is disabled', 403, 'mock_disabled');
  const input = await parseJson(req);
  const intent = await findIntentById(env, cleanText(input.intent_id, 80));
  if (!intent || intent.routed_provider !== 'mock') return fail('Mock payment intent not found', 404, 'not_found');
  const token = cleanText(input.token, 200);
  if (!token || !intent.checkout_token_hash || !safeEqualText(sha256Hex(token), intent.checkout_token_hash)) return fail('Invalid mock checkout token', 401, 'invalid_token');
  const outcome = input.outcome === 'cancel' ? 'cancelled' : 'paid';
  if (outcome === 'paid') await markPaid(env, intent.id, `mock-${intent.reference}`);
  else await env.DB.prepare("UPDATE payment_intents SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status!='paid'").bind(intent.id).run();
  await recordEvent(env, 'mock', `payment.${outcome}`, sha256Hex(`mock:${intent.id}:${outcome}`), intent.id, { outcome }, true);
  return response({ ok: true, status: outcome, reference: intent.reference });
}

async function handleApi(req, env, url) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  if (url.pathname === '/api/health' && req.method === 'GET') {
    const row = await env.DB.prepare('SELECT 1 AS ok').first();
    return response({ ok: row?.ok === 1, service: 'IZAKHONO PAY', version: '0.2.2', mode: env.PAYMENT_MODE || 'mock', env: env.APP_ENV || 'alpha' });
  }

  if (url.pathname === '/api/v1/capabilities' && req.method === 'GET') {
    return response({
      ok: true,
      mode: env.PAYMENT_MODE || 'mock',
      currencies: ['ZAR'],
      providers: {
        paystack: { enabled: env.PAYSTACK_ENABLED !== 'false', configured: providerConfigured(env, 'paystack') },
        payfast: { enabled: env.PAYFAST_ENABLED !== 'false', configured: providerConfigured(env, 'payfast'), sandbox: env.PAYFAST_SANDBOX === 'true' || env.PAYMENT_MODE === 'sandbox' }
      },
      methods: ['card','eft','capitec_pay','qr','wallets_where_supported'],
      merchant_auth: 'per-merchant-key',
      idempotency_required: true,
      merchant_webhooks: 'signed-hmac-sha256',
      merchant_return_urls: 'allowlisted-https-origin',
      note: 'Payment methods are ultimately determined by the connected merchant account and provider.'
    });
  }

  if (url.pathname === '/api/demo/intents' && req.method === 'POST') {
    const input = await parseJson(req);
    return initializeIntent(req, env, input, { demo: true });
  }

  if (url.pathname === '/api/demo/mock-complete' && req.method === 'POST') return handleMockComplete(req, env);
  if (url.pathname === '/api/webhooks/paystack' && req.method === 'POST') return handlePaystackWebhook(req, env);
  if (url.pathname === '/api/webhooks/payfast' && req.method === 'POST') return handlePayfastWebhook(req, env);

  if (url.pathname === '/api/v1/intents' && req.method === 'POST') {
    const merchant = await authorizeMerchant(req, env);
    if (!merchant) {
      await recordFortressEvent(env, { severity: 'medium', category: 'merchant.auth_failed', source: 'izakhono-pay', merchantSlug: cleanText(req.headers.get('x-izakhono-app') || '', 60).toLowerCase() || null });
      return fail('Missing, inactive, or invalid merchant credentials', 401, 'unauthorized');
    }
    const input = await parseJson(req);
    return initializeIntent(req, env, input, { merchant });
  }

  const intentMatch = url.pathname.match(/^\/api\/v1\/intents\/([^/]+)$/);
  if (intentMatch && req.method === 'GET') {
    const merchant = await authorizeMerchant(req, env);
    if (!merchant) return fail('Missing, inactive, or invalid merchant credentials', 401, 'unauthorized');
    const intent = await findMerchantIntentById(env, merchant.slug, intentMatch[1]);
    if (!intent) return fail('Payment intent not found', 404, 'not_found');
    return response({ ok: true, intent: renderIntent(req, env, intent) });
  }

  if (url.pathname === '/api/admin/summary' && req.method === 'GET') {
    if (!adminAuthorized(req, env)) return fail('Unauthorized', 401, 'unauthorized');
    const totals = await env.DB.prepare("SELECT COUNT(*) AS intents, SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paid_count, COALESCE(SUM(CASE WHEN status='paid' THEN amount_minor ELSE 0 END),0) AS paid_minor FROM payment_intents").first();
    const byProvider = await env.DB.prepare("SELECT COALESCE(routed_provider,'unrouted') AS provider, COUNT(*) AS intents, COALESCE(SUM(CASE WHEN status='paid' THEN amount_minor ELSE 0 END),0) AS paid_minor FROM payment_intents GROUP BY routed_provider ORDER BY intents DESC").all();
    const recent = await env.DB.prepare("SELECT id,reference,app_slug,amount_minor,currency,customer_email,description,routed_provider,status,created_at,paid_at FROM payment_intents ORDER BY created_at DESC LIMIT 25").all();
    return response({ ok: true, totals, by_provider: byProvider.results || [], recent: recent.results || [] });
  }

  return fail('Not found', 404, 'not_found');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await handleApi(req, env, url); }
      catch (error) {
        console.error('IZAKHONO PAY error', error);
        return fail(error instanceof Error ? error.message : 'Unexpected error', 500, 'internal_error');
      }
    }
    return env.ASSETS.fetch(req);
  }
};
