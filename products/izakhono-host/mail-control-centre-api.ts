import { buildMailControlSnapshot, type MailDomainState, type MailboxState, type MailIncident, type MailControlSnapshot } from './mail-control-centre';
import registry from './mail-control-centre-state.json' with { type: 'json' };

export type MailControlRole = 'owner' | 'mail-admin' | 'security-admin' | 'support-admin' | 'auditor';

export interface MailControlRequest {
  role: MailControlRole;
  action: 'read-dashboard' | 'read-domain' | 'read-mailbox' | 'read-incidents';
  domain?: string;
  mailbox?: string;
}

export interface MailControlResponse {
  status: 'ok' | 'forbidden' | 'not-found';
  snapshot?: MailControlSnapshot;
  domain?: MailDomainState;
  mailbox?: MailboxState;
  incidents?: MailIncident[];
  reason?: string;
}

const domains = registry.domains as MailDomainState[];
const mailboxes = registry.mailboxes as MailboxState[];
const incidents = registry.incidents as MailIncident[];

function canRead(role: MailControlRole): boolean {
  return ['owner', 'mail-admin', 'security-admin', 'support-admin', 'auditor'].includes(role);
}

export function handleMailControlRequest(request: MailControlRequest): MailControlResponse {
  if (!canRead(request.role)) return { status: 'forbidden', reason: 'role-not-authorized' };

  const snapshot = buildMailControlSnapshot(domains, mailboxes, incidents);

  if (request.action === 'read-dashboard') return { status: 'ok', snapshot };

  if (request.action === 'read-domain') {
    if (!request.domain) return { status: 'not-found', reason: 'domain-required' };
    const domain = domains.find((item) => item.domain === request.domain);
    return domain ? { status: 'ok', domain } : { status: 'not-found', reason: 'domain-not-managed' };
  }

  if (request.action === 'read-mailbox') {
    if (!request.mailbox) return { status: 'not-found', reason: 'mailbox-required' };
    const mailbox = mailboxes.find((item) => item.address === request.mailbox);
    return mailbox ? { status: 'ok', mailbox } : { status: 'not-found', reason: 'mailbox-not-managed' };
  }

  return { status: 'ok', incidents };
}

export function mailControlCentreRoute(input: unknown): MailControlResponse {
  if (!input || typeof input !== 'object') return { status: 'forbidden', reason: 'invalid-request' };
  return handleMailControlRequest(input as MailControlRequest);
}
