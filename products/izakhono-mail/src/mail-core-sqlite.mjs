import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const databasePath = process.env.MAIL_DATABASE_PATH || './izakhono-mail.sqlite';
const domain = (process.env.MAIL_PRIVATE_DOMAIN || 'izakhono').toLowerCase();

const db = new DatabaseSync(databasePath);
db.exec(`PRAGMA foreign_keys = ON;`);

db.exec(`CREATE TABLE IF NOT EXISTS mail_identities (
  id TEXT PRIMARY KEY, address TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active', mailbox_id TEXT NOT NULL UNIQUE,
  quota_bytes INTEGER NOT NULL DEFAULT 1073741824, uid_validity INTEGER NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);`);
db.exec(`CREATE TABLE IF NOT EXISTS mail_messages (
  id TEXT PRIMARY KEY, message_id TEXT NOT NULL UNIQUE, mailbox_id TEXT NOT NULL,
  folder TEXT NOT NULL, sender TEXT NOT NULL, recipients_json TEXT NOT NULL DEFAULT '[]',
  cc_json TEXT NOT NULL DEFAULT '[]', subject TEXT NOT NULL DEFAULT '',
  headers_json TEXT NOT NULL DEFAULT '{}', body TEXT NOT NULL DEFAULT '', raw_message TEXT NOT NULL DEFAULT '',
  flags_json TEXT NOT NULL DEFAULT '[]', delivery_state TEXT NOT NULL DEFAULT 'delivered',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);`);
db.exec(`CREATE TABLE IF NOT EXISTS mail_core_audit (
  id TEXT PRIMARY KEY, event_type TEXT NOT NULL, actor TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);`);

const now = () => new Date().toISOString();
const id = p => `${p}_${crypto.randomUUID()}`;

export function ensureIdentity(address, displayName = 'Bevan Shelton') {
  const canonical = address.trim().toLowerCase();
  if (!new RegExp(`^.+@${domain.replace('.', '\\.')}$`).test(canonical)) throw new Error('Private IZAKHONO identity required');
  const existing = db.prepare('SELECT * FROM mail_identities WHERE address = ?').get(canonical);
  if (existing) return existing;
  const ts = now();
  const record = { id: id('idn'), mailbox_id: id('mbx'), address: canonical, display_name: displayName,
    status: 'active', quota_bytes: 1073741824, uid_validity: Math.floor(Date.now() / 1000), created_at: ts, updated_at: ts };
  db.prepare(`INSERT INTO mail_identities
    (id,address,display_name,status,mailbox_id,quota_bytes,uid_validity,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(record.id, record.address, record.display_name, record.status, record.mailbox_id,
      record.quota_bytes, record.uid_validity, record.created_at, record.updated_at);
  audit('security', canonical, 'identity_created');
  return record;
}

function audit(eventType, actor, detail) {
  db.prepare('INSERT INTO mail_core_audit (id,event_type,actor,detail,created_at) VALUES (?,?,?,?,?)')
    .run(id('audit'), eventType, actor, detail, now());
}

function parseRaw(raw) {
  const split = raw.split(/\r?\n\r?\n/, 2);
  const headerText = split[0] || '';
  const body = split[1] || '';
  const headers = {};
  for (const line of headerText.split(/\r?\n/)) {
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (m) headers[m[1].trim()] = m[2].trim();
  }
  return { headers, body, subject: headers.Subject || '' };
}

export function deliverInbound({ messageId, from, recipients, raw }) {
  const parsed = parseRaw(raw);
  const delivered = [];
  for (const recipient of recipients) {
    const identity = ensureIdentity(recipient);
    const ts = now();
    const message = {
      id: id('msg'), message_id: messageId, mailbox_id: identity.mailbox_id,
      folder: 'INBOX', sender: from || '', recipients_json: JSON.stringify(recipients), cc_json: '[]',
      subject: parsed.subject, headers_json: JSON.stringify(parsed.headers), body: parsed.body,
      raw_message: raw, flags_json: '[]', delivery_state: 'delivered', created_at: ts, updated_at: ts
    };
    db.prepare(`INSERT INTO mail_messages
      (id,message_id,mailbox_id,folder,sender,recipients_json,cc_json,subject,headers_json,body,raw_message,flags_json,delivery_state,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        message.id, message.message_id, message.mailbox_id, message.folder, message.sender,
        message.recipients_json, message.cc_json, message.subject, message.headers_json, message.body,
        message.raw_message, message.flags_json, message.delivery_state, message.created_at, message.updated_at);
    audit('delivery', recipient, `inbound:${message.id}`);
    delivered.push(message);
  }
  return delivered;
}

export function listInbox(address) {
  const identity = ensureIdentity(address);
  return db.prepare(`SELECT * FROM mail_messages WHERE mailbox_id = ? AND folder = 'INBOX' ORDER BY created_at DESC`)
    .all(identity.mailbox_id);
}

export { db };
