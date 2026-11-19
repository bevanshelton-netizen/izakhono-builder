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
    if (/^\\d{1,3}(?:\\.\\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) return null;
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

async function ensureDelivery(env, { eventId, merchantSlug, intentId, webhookUrl }) {
  await env.DB.prepare("INSERT OR IGNORE INTO merchant_webhook_deliveries(id,event_id,merchant_slug,intent_id,webhook_url,status) VALUES(?,?,?,?,?,'pending')")
    .bind(deliveryId(), eventId, merchantSlug, intentId, webhookUrl).run();
  return env.DB.prepare('SELECT event_id,status,attempt_count,lease_token,lease_expires_at,next_attempt_at FROM merchant_webhook_deliveries WHERE event_id=?')
    .bind(eventId).first();
}

function changedRows(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

/**
 * Atomically claims a pending/failed delivery. The lease prevents concurrent
 * payment-webhook replays from dispatching the same merchant event at once.
 */
export async function claimMerchantWebhookDelivery(env, eventId) {
  const leaseToken = `lease_${crypto.randomUUID().replaceAll('-', '')}`;
  const result = await env.DB.prepare(
    "UPDATE merchant_webhook_deliveries SET lease_token=?,lease_expires_at=datetime('now','+30 seconds'),attempt_count=attempt_count+1 WHERE event_id=? AND status IN ('pending','failed') AND (lease_expires_at IS NULL OR lease_expires_at<=CURRENT_TIMESTAMP) AND (next_attempt_at IS NULL OR next_attempt_at<=CURRENT_TIMESTAMP)"
  ).bind(leaseToken, eventId).run();
  if (changedRows(result) > 0) return { claimed: true, leaseToken };
  const row = await env.DB.prepare('SELECT event_id,status,attempt_count,lease_token,lease_expires_at,next_attempt_at FROM merchant_webhook_deliveries WHERE event_id=?')
    .bind(eventId).first();
  return { claimed: false, row };
}

async function updateDelivery(env, eventId, leaseToken, { status, httpStatus = null, error = null }) {
  await env.DB.prepare(
    "UPDATE merchant_webhook_deliveries SET status=?,last_http_status=?,last_error=?,delivered_at=CASE WHEN ?='delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END,next_attempt_at=CASE WHEN ?='failed' THEN datetime('now','+30 seconds') ELSE NULL END,lease_token=NULL,lease_expires_at=NULL WHERE event_id=? AND lease_token=?"
  ).bind(status, httpStatus, error, status, status, eventId, leaseToken).run();
}

export async function dispatchMerchantPaymentPaid(env, intent) {
  const eventId = `evt_payment_paid_${sha256Hex(`${intent.id}:${intent.provider_reference || ''}`).slice(0, 32)}`;
  const merchant = await merchantConfig(env, intent.app_slug);
  const webhookUrl = merchant?.webhook_url ? allowedWebhookUrl(env, merchant.webhook_url) : null;
  const secretRef = String(merchant?.webhook_secret_env || '').trim();
  const secret = /^[A-Z][A-Z0-9_]{2,127}$/.test(secretRef) ? env[secretRef] : null;

  if (!webhookUrl || !secret) {
    if (merchant?.webhook_url || merchant?.webhook_secret_env) {
      const row = await ensureDelivery(env, {
        eventId, merchantSlug: intent.app_slug, intentId: intent.id,
        webhookUrl: merchant.webhook_url || 'https://suppressed.invalid/'
      });
      if (row?.status !== 'delivered') {
        await env.DB.prepare("UPDATE merchant_webhook_deliveries SET status='suppressed',last_error=?,lease_token=NULL,lease_expires_at=NULL,next_attempt_at=NULL WHERE event_id=? AND status IN ('pending','failed')")
          .bind(!webhookUrl ? 'webhook_host_not_allowlisted' : 'webhook_secret_unavailable', eventId).run();
      }
      return { delivered: false, reason: 'suppressed' };
    }
    return { delivered: false, reason: 'not_configured' };
  }

  const row = await ensureDelivery(env, {
    eventId, merchantSlug: intent.app_slug, intentId: intent.id, webhookUrl
  });
  if (row?.status === 'delivered') return { delivered: true, duplicate: true };
  if (row?.status === 'suppressed') return { delivered: false, reason: 'suppressed' };

  const claim = await claimMerchantWebhookDelivery(env, eventId);
  if (!claim.claimed) {
    if (claim.row?.status === 'delivered') return { delivered: true, duplicate: true };
    return { delivered: false, reason: claim.row?.status === 'failed' ? 'retry_scheduled' : 'delivery_in_progress' };
  }

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
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
    if (!result.ok) {
      await updateDelivery(env, eventId, claim.leaseToken, {
        status: 'failed', httpStatus: result.status, error: `merchant_http_${result.status}`
      });
      return { delivered: false, reason: 'merchant_rejected', status: result.status };
    }
    await updateDelivery(env, eventId, claim.leaseToken, { status: 'delivered', httpStatus: result.status });
    return { delivered: true };
  } catch (error) {
    await updateDelivery(env, eventId, claim.leaseToken, {
      status: 'failed', error: error instanceof Error ? error.message.slice(0, 500) : 'delivery_failed'
    });
    return { delivered: false, reason: 'delivery_failed' };
  } finally {
    clearTimeout(timer);
  }
}
