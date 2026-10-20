import http from 'node:http';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

const port = Number(process.env.PORT || 8091);
const apiToken = process.env.IZAKHONO_MAIL_API_TOKEN || '';
const smtpHost = process.env.SMTP_HOST || 'stalwart';
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const smtpSecure = String(process.env.SMTP_TLS_MODE || 'starttls').toLowerCase() === 'tls';

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  requireTLS: !smtpSecure,
  auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  if (!apiToken) return false;
  return req.headers.authorization === `Bearer ${apiToken}`;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 128 * 1024) req.destroy();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('invalid_json')); }
    });
    req.on('error', reject);
  });
}

async function main(req, res) {
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, { ok: true, service: 'IZAKHONO MAIL', smtp_configured: Boolean(smtpUser && smtpPass), smtp_host: smtpHost, smtp_port: smtpPort });
  }
  if (req.method !== 'POST' || req.url !== '/v1/send') return send(res, 405, { error: 'method_not_allowed' });
  if (!authorized(req)) return send(res, 401, { error: 'unauthorized' });

  let body;
  try { body = await readJson(req); } catch { return send(res, 400, { error: 'invalid_json' }); }
  const to = body?.to?.email || body?.to;
  const from = body?.from?.email || body?.from;
  const replyTo = body?.reply_to?.email || body?.reply_to;
  const subject = String(body?.subject || '').trim();
  const text = String(body?.body_text || '').trim();
  const html = String(body?.body_html || '').trim();
  const idempotency = String(body?.idempotency_key || crypto.randomUUID());

  if (!to || !from || !subject || (!text && !html)) return send(res, 400, { error: 'missing_required_fields' });
  if (!smtpUser || !smtpPass) return send(res, 503, { error: 'mail_transport_not_configured', delivery_claim: false });

  try {
    const info = await transporter.sendMail({
      envelope: { from, to },
      from,
      to,
      replyTo: replyTo || undefined,
      subject,
      text: text || undefined,
      html: html || undefined,
      headers: { 'X-IZAKHONO-Idempotency-Key': idempotency },
    });
    return send(res, 202, { ok: true, provider: 'izakhono-mail-smtp', delivery_claim: true, message_id: info.messageId, accepted: info.accepted });
  } catch (error) {
    console.error('[MAIL] SMTP send failed:', error?.message || error);
    return send(res, 502, { error: 'smtp_send_failed', delivery_claim: false });
  }
}

http.createServer((req, res) => main(req, res).catch(() => send(res, 500, { error: 'internal_error' }))).listen(port, '0.0.0.0', () => {
  console.log(`IZAKHONO MAIL bridge listening on ${port}`);
});
