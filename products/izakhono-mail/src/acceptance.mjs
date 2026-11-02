import { login } from './auth.mjs';
import { sendMail } from './server.mjs';

const base = process.env.NODE01_MAIL_ACCEPTANCE_URL || 'http://127.0.0.1:8789';
const target = process.env.NODE01_MAIL_ACCEPTANCE_ADDRESS || '';
const password = process.env.NODE01_MAIL_ACCEPTANCE_PASSWORD || '';

async function httpJson(path, options = {}) {
  const res = await fetch(`${base}${path}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { status: res.status, body };
}

export async function runAcceptance() {
  if (!target || !password) throw new Error('NODE01_MAIL_ACCEPTANCE_ADDRESS and NODE01_MAIL_ACCEPTANCE_PASSWORD are required');
  const auth = login({ address: target, password });
  const health = await httpJson('/healthz');
  if (health.status !== 200 || !health.body?.ok) throw new Error('mail_auth_health_failed');
  const inbox = await httpJson('/v1/mailbox/inbox', { headers: { authorization: `Bearer ${auth.token}` } });
  if (inbox.status !== 200 || !inbox.body?.ok) throw new Error('mailbox_inbox_failed');
  return { ok: true, address: target.toLowerCase(), checks: { auth: true, health: true, inbox: true }, note: 'Outbound SMTP and inbound delivery require configured runtime transport and are not falsely marked successful by this harness.' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { console.log(JSON.stringify(await runAcceptance(), null, 2)); }
  catch (error) { console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2)); process.exitCode = 1; }
}
