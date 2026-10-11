/** IZAKHONO MAILBOX ENGINE — logical mailbox storage and folders. */
export class MailboxEngine {
  constructor({ mailboxes = new Map() } = {}) { this.mailboxes = mailboxes; }
  ensure(address) { const key = String(address).trim().toLowerCase(); if (!this.mailboxes.has(key)) this.mailboxes.set(key, { address: key, folders: { inbox: [], sent: [], archive: [], trash: [], quarantine: [] } }); return this.mailboxes.get(key); }
  deliver(address, message, folder = "inbox") { const box = this.ensure(address); if (!box.folders[folder]) throw new Error("UNKNOWN_FOLDER"); if (!box.folders[folder].some(m => m.id === message.id)) box.folders[folder].push(message); return { mailbox: box.address, folder, messageId: message.id }; }
  list(address, folder = "inbox") { const box = this.ensure(address); return [...(box.folders[folder] || [])]; }
  move(address, id, from = "inbox", to = "archive") { const box = this.ensure(address); const source = box.folders[from] || []; const index = source.findIndex(m => m.id === id); if (index < 0) return false; const [message] = source.splice(index, 1); this.deliver(address, message, to); return true; }
  stats(address) { const box = this.ensure(address); return Object.fromEntries(Object.entries(box.folders).map(([k,v]) => [k, v.length])); }
}
