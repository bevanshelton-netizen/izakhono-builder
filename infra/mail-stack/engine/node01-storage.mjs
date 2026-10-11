/** NODE01 durable storage adapters for IZAKHONO MAIL. */
import fs from "node:fs";
import path from "node:path";

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function safeName(value) { return Buffer.from(String(value)).toString("base64url"); }
function atomicWrite(file, value) { const tmp = `${file}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(value, null, 2)); fs.renameSync(tmp, file); }

export class Node01MailboxStore {
  constructor({ root = "/var/lib/izakhono-mail/mailboxes" } = {}) { this.root = root; ensureDir(root); }
  load(address) { const file = path.join(this.root, `${safeName(address)}.json`); try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { if (e.code === "ENOENT") return null; throw e; } }
  save(address, mailbox) { atomicWrite(path.join(this.root, `${safeName(address)}.json`), mailbox); return mailbox; }
}

export class Node01QueueStore {
  constructor({ root = "/var/lib/izakhono-mail/queue" } = {}) { this.root = root; ensureDir(root); }
  load() { const file = path.join(this.root, "queue.json"); try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { if (e.code === "ENOENT") return {}; throw e; } }
  save(value) { atomicWrite(path.join(this.root, "queue.json"), value); return value; }
}
