import net from 'node:net';
import { login } from './auth.mjs';

const authBase = process.env.NODE01_MAIL_ACCEPTANCE_AUTH_URL || 'http://127.0.0.1:8789';
const mailboxBase = process.env.NODE01_MAIL_ACCEPTANCE_MAILBOX_URL || 'http://127.0.0.1:8787';
const mailBase = process.env.NODE01_MAIL_ACCEPTANCE_MAIL_URL || 'http://127.0.0.1:9899';
const target = String(process.env.NODE01_MAIL_ACCEPTANCE_ADDRESS || '').trim().toLowerCase();
const password = process.env.NODE01_MAIL_ACCEPTANCE_PASSWORD || '';
const apiToken = process.env.MAIL_API_TOKEN || '';
const inboundHost = process.env.NODE01_MAIL_ACCEPTANCE_INBOUND_HOST || '127.0.0.1';
const inboundPort = Number(process.env.NODE01_MAIL_ACCEPTANCE_INBOUND_PORT || 2525);

async function request(base, path, options = {}) {
  const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) };
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { status: res.status, body };
}

function smtpSend({ recipient }) {
  const subject = `NODE01 inbound acceptance ${Date.now()}`;
  const body = 'NODE01 private inbound SMTP acceptance test.';
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: inboundHost, port: inboundPort });
    let buffer = '';
    let stage = 'greeting';
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('inbound_smtp_timeout')); }, 10000);
    const fail = error => { clearTimeout(timer); socket.destroy(); reject(error); };
    const send = value => socket.write(`${value}\r\n`);
    const handle = line => {
      if (/^[45]\d\d\b/.test(line)) return fail(new Error(`inbound_smtp_rejected_${line.slice(0, 3)}`));
      if (stage === 'greeting' && /^220\b/.test(line)) { stage = 'ehlo'; return send('EHLO node01-acceptance'); }
      if (stage === 'ehlo' && /^250\b/.test(line)) { stage = 'mail'; return send('MAIL FROM:<acceptance@node01.internal>'); }
      if (stage === 'mail' && /^250\b/.test(line)) { stage = 'rcpt'; return send(`RCPT TO:<${recipient}>`); }
      if (stage === 'rcpt' && /^250\b/.test(line)) { stage = 'data'; return send('DATA'); }
      if (stage === 'data' && /^354\b/.test(line)) {
        stage = 'accepted';
        return send(`From: acceptance@node01.internal\r\nTo: ${recipient}\r\nSubject: ${subject}\r\n\r\n${body}\r\n.`);
      }
      if (stage === 'accepted' && /^250\b/.test(line)) { stage = 'quit'; return send('QUIT'); }
      if (stage === 'quit' && /^221\b/.test(line)) {
        clearTimeout(timer); socket.end(); return resolve({ subject, body });
      }
    };
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      while (true) {
        const idx = buffer.indexOf('\r\n');
        if (idx < 0) return;
        const line = buffer.slice(0, idx); buffer = buffer.slice(idx + 2);
        handle(line);
      }
    });
    socket.on('error', fail);
  });
}

export async function runAcceptance() {
  if (!target || !password) throw new Error('NODE01_MAIL_ACCEPTANCE_ADDRESS and NODE01_MAIL_ACCEPTANCE_PASSWORD are required');

  const authHealth = await request(authBase, '/healthz');
  if (authHealth.status !== 200 || !authHealth.body?.ok) throw new Error('mail_auth_health_failed');
  const mailHealth = await request(mailBase, '/healthz');
  if (mailHealth.status !== 200 || !mailHealth.body?.ok) throw new Error('mail_core_health_failed');

  const auth = login({ address: target, password });
  const before = await request(mailboxBase, '/v1/mailbox/inbox', { headers: { authorization: `Bearer ${auth.token}` } });
  if (before.status !== 200 || !before.body?.ok) throw new Error('mailbox_inbox_failed');
  if (String(before.body.address || '').toLowerCase() !== target) throw new Error('mailbox_identity_mismatch');

  const inbound = await smtpSend({ recipient: target });
  const after = await request(mailboxBase, '/v1/mailbox/inbox', { headers: { authorization: `Bearer ${auth.token}` } });
  if (after.status !== 200 || !after.body?.ok) throw new Error('mailbox_inbox_after_delivery_failed');
  const visible = Array.isArray(after.body.messages) && after.body.messages.some(message => message.subject === inbound.subject && message.body.includes(inbound.body));
  if (!visible) throw new Error('inbound_message_not_visible_in_inbox');

  const checks = { auth: true, auth_health: true, mail_health: true, inbox_before: true, inbound_smtp: true, inbox_after: true, message_visible: true };
  let outbound = { state: 'not_run' };
  if (String(process.env.NODE01_MAIL_ACCEPTANCE_SMTP || '').toLowerCase() === 'true') {
    if (!apiToken) throw new Error('MAIL_API_TOKEN is required for outbound acceptance');
    const key = `acceptance-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const send = await request(mailBase, '/v1/send', {
      method: 'POST', headers: { authorization: `Bearer ${apiToken}` },
      body: JSON.stringify({ idempotency_key: key, to: { email: target, name: target }, subject: 'NODE01 MAIL outbound acceptance', body_text: 'NODE01 outbound SMTP acceptance test.' })
    });
    if (![200, 202].includes(send.status) || !send.body?.ok) throw new Error('mail_outbound_acceptance_failed');
    outbound = { state: send.body?.outbox?.state || send.body?.outbound_state || 'unknown', delivery_claim: send.body?.delivery_claim || null, idempotency_key: key };
    checks.outbound = outbound.state === 'outbound_accepted' || outbound.delivery_claim === 'outbound_accepted';
    if (!checks.outbound) throw new Error('mail_outbound_not_accepted');
  }

  return { ok: true, address: target, checks, inbound_subject: inbound.subject, outbound, note: 'Private inbound delivery is proven through the SMTP listener. Public DNS, external delivery and public webmail remain separate production gates.' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { console.log(JSON.stringify(await runAcceptance(), null, 2)); }
  catch (error) { console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2)); process.exitCode = 1; }
}
