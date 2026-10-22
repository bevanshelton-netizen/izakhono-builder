import dns from 'node:dns';
import net from 'node:net';

const DOMAIN = (process.env.IZAKHONO_PRIVATE_DOMAIN || 'izakhono').toLowerCase();
const HOST = process.env.IZAKHONO_RESOLVER_LISTEN_HOST || '127.0.0.1';
const PORT = Number(process.env.IZAKHONO_RESOLVER_LISTEN_PORT || 5353);

const records = new Map([
  [`mail.${DOMAIN}`, { type: 'A', value: process.env.IZAKHONO_MAIL_HOST || '127.0.0.1', ttl: 60 }],
  [`webmail.${DOMAIN}`, { type: 'A', value: process.env.IZAKHONO_WEBMAIL_HOST || '127.0.0.1', ttl: 60 }],
  [`smtp.${DOMAIN}`, { type: 'A', value: process.env.IZAKHONO_SMTP_HOST || '127.0.0.1', ttl: 60 }],
  [`imap.${DOMAIN}`, { type: 'A', value: process.env.IZAKHONO_IMAP_HOST || '127.0.0.1', ttl: 60 }]
]);

export function resolvePrivate(name) {
  const key = String(name || '').replace(/\.$/, '').toLowerCase();
  if (key === DOMAIN) return { type: 'A', value: '127.0.0.1', ttl: 60 };
  return records.get(key) || null;
}

export function startResolver({ host = HOST, port = PORT } = {}) {
  const server = dns.createServer();
  server.on('request', (req, send) => {
    const response = dns.createResponse(req);
    for (const question of req.questions) {
      const record = resolvePrivate(question.name);
      if (record && question.type === dns.consts.A) {
        response.answers.push({ name: question.name, type: dns.consts.A, class: dns.consts.IN, ttl: record.ttl, address: record.value });
      }
    }
    send(response);
  });
  server.bind(PORT, host);
  console.log(`[IZAKHONO RESOLVER] ${DOMAIN} listening on ${host}:${port}`);
  return server;
}

if (process.argv[1]?.endsWith('resolver.mjs')) startResolver();
