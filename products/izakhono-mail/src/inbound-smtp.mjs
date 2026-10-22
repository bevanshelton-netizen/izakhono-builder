import net from 'node:net';
import crypto from 'node:crypto';
import { deliverInbound, ensureIdentity } from './mail-core-sqlite.mjs';

const host = process.env.MAIL_SMTP_LISTEN_HOST || '0.0.0.0';
const port = Number(process.env.MAIL_SMTP_LISTEN_PORT || 2525);
const domain = (process.env.MAIL_PRIVATE_DOMAIN || 'izakhono').toLowerCase();
const maxMessageBytes = Number(process.env.MAIL_SMTP_MAX_MESSAGE_BYTES || 5 * 1024 * 1024);
const identities = new Set((process.env.MAIL_LOCAL_RECIPIENTS || 'bevan@izakhono')
  .split(',').map(x => x.trim().toLowerCase()).filter(Boolean));

for (const address of identities) ensureIdentity(address);

function reply(socket, code, text) { socket.write(`${code} ${text}\r\n`); }
function validAddress(value) {
  const address = value.trim().replace(/^<|>$/g, '').toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(address) ? address : '';
}
function messageId() { return `<${crypto.randomUUID()}@${domain}>`; }

function acceptMessage(from, recipients, raw) {
  const id = messageId();
  const messages = deliverInbound({ messageId: id, from, recipients, raw });
  return { id, from, recipients, bytes: Buffer.byteLength(raw, 'utf8'), raw, messages };
}

function session(socket) {
  let buffer = '';
  let state = 'command';
  let from = '';
  const recipients = [];
  let data = '';
  let dataBytes = 0;
  reply(socket, 220, `${domain} IZAKHONO MAIL ESMTP ready`);

  socket.on('data', chunk => {
    buffer += chunk.toString('utf8');
    if (buffer.length > maxMessageBytes + 8192) { reply(socket, 552, 'Message too large'); socket.destroy(); return; }
    while (true) {
      const idx = buffer.indexOf('\r\n');
      if (idx < 0) break;
      const line = buffer.slice(0, idx); buffer = buffer.slice(idx + 2);
      if (state === 'data') {
        if (line === '.') {
          try {
            state = 'command';
            const accepted = acceptMessage(from, recipients, data);
            socket.__lastAccepted = accepted;
            reply(socket, 250, `2.0.0 delivered as ${accepted.id}`);
          } catch (error) {
            reply(socket, 451, `4.3.0 ${error.message}`);
          }
          from = ''; recipients.length = 0; data = ''; dataBytes = 0; continue;
        }
        const normalized = line.startsWith('..') ? line.slice(1) : line;
        data += normalized + '\r\n';
        dataBytes += Buffer.byteLength(normalized, 'utf8') + 2;
        if (dataBytes > maxMessageBytes) { reply(socket, 552, '5.3.4 Message too large'); socket.destroy(); return; }
        continue;
      }
      const command = line.trim();
      const [verb, ...rest] = command.split(/\s+/);
      const arg = rest.join(' '); const upper = verb.toUpperCase();
      if (upper === 'EHLO' || upper === 'HELO') {
        reply(socket, 250, `${domain}`); socket.write('250-SIZE 5242880\r\n250-8BITMIME\r\n250 HELP\r\n');
      } else if (upper === 'MAIL' && /^FROM:/i.test(arg)) {
        const address = validAddress(arg.replace(/^FROM:/i, '').trim());
        if (!address) reply(socket, 501, '5.1.7 Invalid sender'); else { from = address; reply(socket, 250, '2.1.0 Sender OK'); }
      } else if (upper === 'RCPT' && /^TO:/i.test(arg)) {
        const address = validAddress(arg.replace(/^TO:/i, '').trim());
        if (!address || !address.endsWith(`@${domain}`) || !identities.has(address)) reply(socket, 550, '5.1.1 User unknown');
        else { recipients.push(address); reply(socket, 250, '2.1.5 Recipient OK'); }
      } else if (upper === 'DATA') {
        if (!from || recipients.length === 0) reply(socket, 503, '5.5.1 Need MAIL FROM and RCPT TO');
        else { state = 'data'; reply(socket, 354, 'End data with <CR><LF>.<CR><LF>'); }
      } else if (upper === 'RSET') {
        from = ''; recipients.length = 0; data = ''; dataBytes = 0; state = 'command'; reply(socket, 250, '2.0.0 Reset');
      } else if (upper === 'NOOP') reply(socket, 250, '2.0.0 OK');
      else if (upper === 'QUIT') { reply(socket, 221, '2.0.0 Bye'); socket.end(); return; }
      else reply(socket, 502, '5.5.2 Command not implemented');
    }
  });
}

export function startInboundSmtp() {
  const server = net.createServer(session);
  server.listen(port, host, () => console.log(`[IZAKHONO MAIL] inbound SMTP listening on ${host}:${port}`));
  return server;
}

if (process.argv[1]?.endsWith('inbound-smtp.mjs')) startInboundSmtp();
