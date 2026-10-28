function bridgeConfig() {
  return {
    baseUrl: String(process.env.I_CONNECT_CARRIER_BRIDGE_URL || '').replace(/\/$/, ''),
    secret: process.env.I_CONNECT_CARRIER_BRIDGE_SECRET || '',
    path: process.env.I_CONNECT_CARRIER_PROVISION_PATH || '/provision'
  };
}

export function carrierBridgeConfigured() {
  const c = bridgeConfig();
  return Boolean(c.baseUrl && c.secret);
}

export async function provisionThroughCarrierBridge({ providerId, plan, attempt, idempotencyKey }) {
  const c = bridgeConfig();
  if (!c.baseUrl || !c.secret) return { ok: false, error: 'carrier_bridge_not_configured' };

  const response = await fetch(`${c.baseUrl}${c.path.startsWith('/') ? c.path : `/${c.path}`}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${c.secret}`,
      'x-idempotency-key': idempotencyKey || plan.jobId
    },
    body: JSON.stringify({
      providerId,
      attempt,
      customerId: plan.customerId,
      serviceId: plan.serviceId,
      product: plan.product,
      requirements: plan.requirements,
      jobId: plan.jobId
    })
  });

  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) return { ok: false, error: data?.error || `carrier_bridge_http_${response.status}` };
  return { ok: data?.ok === true, externalReference: data?.externalReference || data?.reference || null, error: data?.error || null };
}
