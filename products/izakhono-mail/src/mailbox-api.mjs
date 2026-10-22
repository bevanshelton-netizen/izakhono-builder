import http from 'node:http';
import { ensureIdentity, listInbox } from './mail-core-sqlite.mjs';

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function startMailboxApi({ host = process.env.MAIL_API_LISTEN_HOST || '127.0.0.1', port = Number(process.env.MAIL_API_LISTEN_PORT || 8787) } = {}) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true, service: 'izakhono-mailbox-api' });

    if (req.method === 'GET' && url.pathname === '/v1/mailbox/inbox') {
      const address = (url.searchParams.get('address') || 'bevan@izakhono').toLowerCase();
      try {
        ensureIdentity(address);
        const messages = listInbox(address).map(row => ({
          id: row.id,
          messageId: row.message_id,
          from: row.sender,
          to: JSON.parse(row.recipients_json),
          subject: row.subject,
          body: row.body,
          headers: JSON.parse(row.headers_json),
          flags: JSON.parse(row.flags_json),
          receivedAt: row.created_at
        }));
        return json(res, 200, { address, folder: 'INBOX', messages });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    return json(res, 404, { error: 'Not found' });
  });
  server.listen(port, host, () => console.log(`[IZAKHONO MAIL] mailbox API listening on ${host}:${port}`));
  return server;
}
