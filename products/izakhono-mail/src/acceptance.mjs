import { login } from './auth.mjs';

const authBase = process.env.NODE01_MAIL_ACCEPTANCE_AUTH_URL || 'http://127.0.0.1:8789';
const mailboxBase = process.env.NODE01_MAIL_ACCEPTANCE_MAILBOX_URL || 'http://127.0.0.1:8787';
const mailBase = process.env.NODE01_MAIL_ACCEPTANCE_MAIL_URL || 'http://127.0.0.1:9899';
const target = String(process.env.NODE01_MAIL_ACCEPTANCE_ADDRESS || '').trim().toLowerCase();
const password = process.env.NODE01_MAIL_ACCEPTANCE_PASSWORD || '';
const apiToken = process.env.MAIL_API_TOKEN || '';

async function request(base, path, options = {}) {
  const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) };
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { status: res.status, body };
}

export async function runAcceptance() {
  if (!target || !password) throw new Error('NODE01_MAIL_ACCEPTANCE_ADDRESS and NODE01_MAIL_ACCEPTANCE_PASSWORD are required');

  const authHealth = await request(authBase, '/healthz');
  if (authHealth.status !== 200 || !authHealth.body?.ok) throw new Error('mail_auth_health_failed');

  const mailHealth = await request(mailBase, '/healthz');
  if (mailHealth.status !== 200 || !mailHealth.body?.ok) throw new Error('mail_core_health_failed');

  const auth = login({ address: target, password });
  const inbox = await request(mailboxBase, '/v1/mailbox/inbox', {
    headers: { authorization: `Bearer ${auth.token}` }
  });
  if (inbox.status !== 200 || !inbox.body?.ok) throw new Error('mailbox_inbox_failed');
  if (String(inbox.body.address || '').toLowerCase() !== target) throw new Error('mailbox_identity_mismatch');

  const checks = { auth: true, auth_health: true, mail_health: true, inbox: true };
  let outbound = { state: 'not_run' };

  if (String(process.env.NODE01_MAIL_ACCEPTANCE_SMTP || '').toLowerCase() === 'true') {
    if (!apiToken) throw new Error('MAIL_API_TOKEN is required for SMTP acceptance');
    const key = `acceptance-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const send = await request(mailBase, '/v1/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiToken}` },
      body: JSON.stringify({
        idempotency_key: key,
        to: { email: target, name: target },
        subject: 'NODE01 MAIL acceptance test',
        body_text: 'NODE01 MAIL acceptance test message.'
      })
    });
    if (![200, 202].includes(send.status) || !send.body?.ok) throw new Error('mail_outbound_acceptance_failed');
    outbound = {
      state: send.body?.outbox?.state || send.body?.outbound_state || 'unknown',
      delivery_claim: send.body?.delivery_claim || null,
      idempotency_key: key
    };
    checks.outbound = ['outbound_accepted', 'completed'].includes(outbound.state) || outbound.delivery_claim === 'outbound_accepted';
    if (!checks.outbound) throw new Error('mail_outbound_not_accepted');
  }

  return {
    ok: true,
    address: target,
    checks,
    outbound,
    note: 'Inbound SMTP is not claimed by this harness unless a real inbound transport test is separately configured. DNS and SMTP production readiness remain runtime gates.'
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log(JSON.stringify(await runAcceptance(), null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2));
    process.exitCode = 1;
  }
}
