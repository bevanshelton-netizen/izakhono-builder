export type MailboxFolder = 'INBOX' | 'SENT' | 'DRAFTS' | 'ARCHIVE' | 'JUNK' | 'TRASH';
export type DeliveryState = 'queued' | 'processing' | 'delivered' | 'deferred' | 'failed';

export interface Identity { id: string; address: string; displayName: string; status: 'active' | 'disabled'; mailboxId: string; createdAt: string; updatedAt: string; }
export interface Mailbox { id: string; identityId: string; quotaBytes: number; uidValidity: number; folders: MailboxFolder[]; createdAt: string; }
export interface Message { id: string; messageId: string; mailboxId: string; folder: MailboxFolder; from: string; to: string[]; cc: string[]; subject: string; headers: Record<string, string>; body: string; flags: string[]; deliveryState: DeliveryState; createdAt: string; updatedAt: string; }
export interface AuditEvent { id: string; type: 'authentication' | 'delivery' | 'security'; actor: string; detail: string; createdAt: string; }

const folders: MailboxFolder[] = ['INBOX', 'SENT', 'DRAFTS', 'ARCHIVE', 'JUNK', 'TRASH'];
const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const now = () => new Date().toISOString();

export class MailCore {
  readonly identities = new Map<string, Identity>();
  readonly mailboxes = new Map<string, Mailbox>();
  readonly messages = new Map<string, Message>();
  readonly audit: AuditEvent[] = [];

  createIdentity(address: string, displayName = ''): Identity {
    const canonical = address.trim().toLowerCase();
    if (!/^.+@izakhono$/.test(canonical)) throw new Error('Only the private @izakhono namespace is accepted by V1');
    if (this.findIdentity(canonical)) throw new Error('Identity already exists');
    const timestamp = now();
    const mailboxId = makeId('mbx');
    const identity: Identity = { id: makeId('idn'), address: canonical, displayName, status: 'active', mailboxId, createdAt: timestamp, updatedAt: timestamp };
    this.identities.set(identity.id, identity);
    this.mailboxes.set(mailboxId, { id: mailboxId, identityId: identity.id, quotaBytes: 1_073_741_824, uidValidity: Math.floor(Date.now() / 1000), folders: [...folders], createdAt: timestamp });
    this.auditEvent('security', canonical, 'identity_created');
    return identity;
  }

  findIdentity(address: string): Identity | undefined {
    const canonical = address.trim().toLowerCase();
    return [...this.identities.values()].find(x => x.address === canonical);
  }

  createDraft(from: string, to: string[], subject: string, body: string): Message {
    const identity = this.requireIdentity(from);
    return this.createMessage(identity.mailboxId, 'DRAFTS', from, to, subject, body, 'queued');
  }

  submit(messageId: string): Message {
    const message = this.requireMessage(messageId);
    if (message.folder !== 'DRAFTS') throw new Error('Only drafts may be submitted');
    this.requireIdentity(message.from);
    message.folder = 'SENT'; message.deliveryState = 'queued'; message.updatedAt = now();
    this.auditEvent('delivery', message.from, `submitted:${message.id}`);
    return message;
  }

  processLocalDelivery(messageId: string): Message {
    const message = this.requireMessage(messageId);
    message.deliveryState = 'processing'; message.updatedAt = now();
    for (const recipient of message.to) {
      const target = this.findIdentity(recipient);
      if (!target) {
        message.deliveryState = 'failed'; message.updatedAt = now();
        this.auditEvent('delivery', message.from, `failed:${recipient}`);
        throw new Error(`Local recipient does not exist: ${recipient}`);
      }
      this.createMessage(target.mailboxId, 'INBOX', message.from, [recipient], message.subject, message.body, 'delivered', message.messageId, message.headers);
    }
    message.deliveryState = 'delivered'; message.updatedAt = now();
    this.auditEvent('delivery', message.from, `delivered:${message.id}`);
    return message;
  }

  listMailbox(address: string, folder: MailboxFolder = 'INBOX'): Message[] {
    const identity = this.requireIdentity(address);
    return [...this.messages.values()].filter(x => x.mailboxId === identity.mailboxId && x.folder === folder).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private createMessage(mailboxId: string, folder: MailboxFolder, from: string, to: string[], subject: string, body: string, deliveryState: DeliveryState, inReplyTo?: string, headers: Record<string, string> = {}): Message {
    const timestamp = now();
    const message: Message = { id: makeId('msg'), messageId: `<${crypto.randomUUID()}@izakhono>`, mailboxId, folder, from: from.toLowerCase(), to: to.map(x => x.toLowerCase()), cc: [], subject, headers: { ...headers, ...(inReplyTo ? { 'In-Reply-To': inReplyTo } : {}) }, body, flags: [], deliveryState, createdAt: timestamp, updatedAt: timestamp };
    this.messages.set(message.id, message);
    return message;
  }

  private requireIdentity(address: string): Identity {
    const identity = this.findIdentity(address);
    if (!identity || identity.status !== 'active') throw new Error('Identity is not active');
    return identity;
  }

  private requireMessage(messageId: string): Message {
    const message = this.messages.get(messageId);
    if (!message) throw new Error('Message not found');
    return message;
  }

  private auditEvent(type: AuditEvent['type'], actor: string, detail: string): void {
    this.audit.push({ id: makeId('audit'), type, actor, detail, createdAt: now() });
  }
}
