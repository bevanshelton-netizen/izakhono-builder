import assert from 'node:assert/strict';
import { once } from 'node:events';
import net from 'node:net';
import { startInboundSmtp } from './inbound-smtp.mjs';

process.env.MAIL_SMTP_LISTEN_HOST = '127.0.0.1';
process.env.MAIL_SMTP_LISTEN_PORT = '2625';
process.env.MAIL_PRIVATE_DOMAIN = 'izakhono';
process.env.MAIL_LOCAL_RECIPIENTS = 'bevan@izakhono';

const server = startInboundSmtp();
await once(server, 'listening');
const { port } = server.address();
const socket = net.connect({ host: '127.0.0.1', port });
let buffer = '';
socket.on('data', chunk => { buffer += chunk.toString(); });
await once(socket, 'data');

function command(line) {
  socket.write(line + '\r\n');
  return new Promise(resolve => {
    const check = () => {
      const match = buffer.match(/(?:^|\r\n)(\d{3}[^\r\n]*)\r\n/);
      if (match) resolve(match[1]); else setTimeout(check, 5);
    };
    check();
  });
}

assert.match(await command('EHLO test'), /^250/);
assert.match(await command('MAIL FROM:<sender@example.com>'), /^250/);
assert.match(await command('RCPT TO:<bevan@izakhono>'), /^250/);
assert.match(await command('DATA'), /^354/);
socket.write('Subject: Hello\r\n\r\nInbound test\r\n.\r\n');
await new Promise(resolve => setTimeout(resolve, 50));
assert.match(buffer, /250 2\.0\.0 queued as/);
assert.match(buffer, /Subject: Hello/);
assert.match(buffer, /Inbound test/);

socket.write('QUIT\r\n');
socket.end();
await once(socket, 'close');
server.close();
console.log('inbound SMTP protocol test passed');
