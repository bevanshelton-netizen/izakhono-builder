const SANDBOX_BASE_URL = 'https://sandbox.momodeveloper.mtn.com';

function baseUrl(env) {
  const configured = String(env.MTN_MOMO_BASE_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  if ((env.PAYMENT_MODE || 'mock') === 'sandbox') return SANDBOX_BASE_URL;
  throw new Error('MTN MoMo live base URL must be supplied by MTN onboarding');
}

function authHeader(user, key) {
  return `Basic ${Buffer.from(`${user}:${key}`, 'utf8').toString('base64')}`;
}

export function normalizeMtnMsisdn(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  return /^[1-9][0-9]{7,14}$/.test(digits) ? digits : null;
}

export function mtnMomoConfigured(env) {
  const mode = env.PAYMENT_MODE || 'mock';
  if (env.MTN_MOMO_ENABLED === 'false' || !['sandbox', 'live'].includes(mode)) return false;
  if (!env.MTN_MOMO_SUBSCRIPTION_KEY || !env.MTN_MOMO_API_USER || !env.MTN_MOMO_API_KEY || !env.MTN_MOMO_TARGET_ENVIRONMENT) return false;
  if (mode === 'live' && !env.MTN_MOMO_BASE_URL) return false;
  return true;
}

async function accessToken(env) {
  if (!mtnMomoConfigured(env)) throw new Error('MTN MoMo is not configured');
  const res = await fetch(`${baseUrl(env)}/collection/token/`, {
    method: 'POST',
    headers: {
      authorization: authHeader(env.MTN_MOMO_API_USER, env.MTN_MOMO_API_KEY),
      'Ocp-Apim-Subscription-Key': env.MTN_MOMO_SUBSCRIPTION_KEY
    }
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) throw new Error(`MTN MoMo token request failed (${res.status})`);
  return data.access_token;
}

function commonHeaders(env, token) {
  return {
    authorization: `Bearer ${token}`,
    'Ocp-Apim-Subscription-Key': env.MTN_MOMO_SUBSCRIPTION_KEY,
    'X-Target-Environment': env.MTN_MOMO_TARGET_ENVIRONMENT,
    'content-type': 'application/json'
  };
}

export async function mtnMomoRequestToPay({ env, intent, msisdn, origin }) {
  const payer = normalizeMtnMsisdn(msisdn);
  if (!payer) throw new Error('A valid international-format MSISDN is required for MTN MoMo');
  const token = await accessToken(env);
  const providerReference = crypto.randomUUID();
  const callbackUrl = `${origin}/api/webhooks/mtn-momo?reference=${encodeURIComponent(providerReference)}`;
  const payload = {
    amount: (Number(intent.amount_minor) / 100).toFixed(2),
    currency: String(intent.currency || '').toUpperCase(),
    externalId: intent.reference,
    payer: { partyIdType: 'MSISDN', partyId: payer },
    payerMessage: intent.description || 'IZAKHONO PAY payment',
    payeeNote: `IZAKHONO PAY ${intent.reference}`
  };
  const res = await fetch(`${baseUrl(env)}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers: {
      ...commonHeaders(env, token),
      'X-Reference-Id': providerReference,
      'X-Callback-Url': callbackUrl
    },
    body: JSON.stringify(payload)
  });
  if (res.status !== 202) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`MTN MoMo RequestToPay failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  return { provider_reference: providerReference, checkout_method: 'push_approval', status: 'processing' };
}

export async function mtnMomoPaymentStatus(env, providerReference) {
  if (!providerReference) throw new Error('MTN MoMo provider reference is required');
  const token = await accessToken(env);
  const res = await fetch(`${baseUrl(env)}/collection/v1_0/requesttopay/${encodeURIComponent(providerReference)}`, {
    method: 'GET',
    headers: commonHeaders(env, token)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(`MTN MoMo payment-status request failed (${res.status})`);
  return data;
}
