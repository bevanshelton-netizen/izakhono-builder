import { merchantWebhookSignature, sha256Hex } from './core.js';

function deliveryId() {
  return `mwd_${crypto.randomUUID().replaceAll('-', '')}`;
}

function safeJson(value, fallback = {}) {
  try { return JSON.parse(value || '{}'); } catch { return fallback; }
}

function allowedWebhookUrl(env, rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) return null;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) return null;
    const allowed = String(env.MERCHANT_WEBHOOK_ALLOWED_HOSTS || '')
      .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
    if (!allowed.length || !allowed.includes(hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function merchantConfig(env, slug) {
  return env.DB.prepare("SELECT slug,webhook_url,webhook_secret_env,status FROM merchant_apps WHERE slug=? AND status='active'")
    .bind(slug).first();
}

async function recordDelivery(env, { eventId, merchantSlug, intentId, webhookUrl, status = 'pending', error = null }) {
  const leaseToken = status === 'pending' ? crypto.randomUUID() : null;
  try {
    await env.DB.prepare('INSERT INTO merchant_webhook_deliveries(id,event_id,merchant_slug,intent_id,webhook_url,status,last_error,lease_token,lease_expires_at) VALUES(?,?,?,?,?,?,?,?,CASE WHEN ? IS NULL THEN NULL ELSE datetime(\'now\', \'+30 seconds\') END)')
      .bind(deliveryId(), eventId, merchantSlug, intentId, webhookUrl, status, error, leaseToken, leaseToken).run();
    return { claimed: true, leaseToken };
  } catch (insertError) {
    // A deterministic event ID means an existing row may be a replay. Only a
    // previously failed delivery is eligible for an atomic retry claim.
    let existing;
    try {
      existing = await env.DB.prepare('SELECT status,lease_expires_at FROM merchant_webhook_deliveries WHERE event_id=? LIMIT 1')
        .bind(eventId).first();
    } catch {
      throw insertError;
    }
    if (!existing) throw insertError;
    if (existing.status !== 'failed' && existing.status !== 'pending') return { claimed: false, leaseToken: null };

    const reclaimed = await env.DB.prepare("UPDATE merchant_webhook_deliveries SET status='pending',last_http_status=NULL,last_error=NULL,lease_token=?,lease_expires_at=datetime('now','+30 seconds') WHERE event_id=? AND (status='failed' OR (status='pending' AND lease_expires_at<=CURRENT_TIMESTAMP))")
      .bind(leaseToken, eventId).run();
    return { claimed: Number(reclaimed?.meta?.changes ?? reclaimed?.changes ?? 0) === 1, leaseToken };
  }
}

async function updateDelivery(env, eventId, leaseToken, { status, httpStatus = null, error = null }) {
  const result = await env.DB.prepare("UPDATE merchant_webhook_deliveries SET status=?,attempt_count=attempt_count+1,last_http_status=?,last_error=?,delivered_at=CASE WHEN ?='delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END,lease_token=NULL,lease_expires_at=NULL WHERE event_id=? AND lease_token=?")
    .bind(status, httpStatus, error, status, eventId, leaseToken).run();
  if (Number(result?.meta?.changes ?? result?.changes ?? 0) !== 1) throw new Error('merchant_webhook_lease_lost');
}

export async function dispatchMerchantPaymentPaid(env, intent) {
  const merchant = await merchantConfig(env, intent.app_slug);
  if (!merchant?.webhook_url || !merchant?.webhook_secret_env) return { delivered: false, reason: 'not_configured' };

  const webhookUrl = allowedWebhookUrl(env, merchant.webhook_url);
  const secretRef = String(merchant.webhook_secret_env || '').trim();
  const secret = /^[A-Z][A-Z0-9_]{2,127}$/.test(secretRef) ? env[secretRef] : null;
  const eventId = `evt_payment_paid_${sha256Hex(`${intent.id}:${intent.provider_reference || ''}`).slice(0, 32)}`;

  if (!webhookUrl || !secret) {
    await recordDelivery(env, {
      eventId,
      merchantSlug: intent.app_slug,
      intentId: intent.id,
      webhookUrl: merchant.webhook_url,
      status: 'suppressed',
      error: !webhookUrl ? 'webhook_host_not_allowlisted' : 'webhook_secret_unavailable'
    });
    return { delivered: false, reason: 'suppressed' };
  }

  const claim = await recordDelivery(env, {
    eventId,
    merchantSlug: intent.app_slug,
    intentId: intent.id,
    webhookUrl,
  });
  if (!claim.claimed) return { delivered: false, reason: 'duplicate' };

  const occurredAt = new Date().toISOString();
  const payload = {
    event: 'payment.paid',
    event_id: eventId,
    occurred_at: occurredAt,
    merchant: intent.app_slug,
    intent: {
      id: intent.id,
      reference: intent.reference,
      amount_minor: Number(intent.amount_minor),
      currency: intent.currency,
      status: 'paid',
      provider: intent.routed_provider,
      provider_reference: intent.provider_reference || null,
      metadata: safeJson(intent.metadata_json),
    },
  };
  const raw = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = merchantWebhookSignature(raw, timestamp, secret);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const result = await fetch(webhookUrl, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'IZAKHONO-PAY/0.2',
        'x-izakhono-event': 'payment.paid',
        'x-izakhono-event-id': eventId,
        'x-izakhono-timestamp': timestamp,
        'x-izakhono-signature': signature,
      },
      body: raw,
    });
    clearTimeout(timer);
    if (!result.ok) {
      await updateDelivery(env, eventId, claim.leaseToken, { status: 'failed', httpStatus: result.status, error: `merchant_http_${result.status}` });
      return { delivered: false, reason: 'merchant_rejected', status: result.status };
    }
    await updateDelivery(env, eventId, claim.leaseToken, { status: 'delivered', httpStatus: result.status });
    return { delivered: true };
  } catch (error) {
    await updateDelivery(env, eventId, claim.leaseToken, { status: 'failed', error: error instanceof Error ? error.message.slice(0, 500) : 'delivery_failed' });
    return { delivered: false, reason: 'delivery_failed' };
  }
}
