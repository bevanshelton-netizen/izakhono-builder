export type MailHealth = 'configured' | 'degraded' | 'verified' | 'failed';
export type MailSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface MailDomainState {
  domain: string;
  platform: string;
  status: MailHealth;
  checks: Record<string, 'passed' | 'failed' | 'pending'>;
  transport: 'owned' | 'external-fallback' | 'unknown';
  lastVerifiedAt: string | null;
  openIncidents: number;
}

export interface MailboxState {
  address: string;
  platform: string;
  status: 'active' | 'suspended' | 'pending' | 'failed';
  storageUsedBytes: number;
  lastAuthenticationAt: string | null;
  lastDeliveryAt: string | null;
  deliveryFailures: number;
  securityStatus: 'clear' | 'attention' | 'blocked';
  backupStatus: 'verified' | 'pending' | 'failed';
}

export interface MailIncident {
  id: string;
  severity: MailSeverity;
  domain?: string;
  mailbox?: string;
  type: string;
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
}

export interface MailControlSnapshot {
  generatedAt: string;
  domains: MailDomainState[];
  mailboxes: MailboxState[];
  incidents: MailIncident[];
  summary: {
    managedDomains: number;
    verifiedDomains: number;
    attentionDomains: number;
    totalMailboxes: number;
    activeMailboxes: number;
    suspendedMailboxes: number;
    openSecurityAlerts: number;
  };
}

export function buildMailControlSnapshot(
  domains: MailDomainState[],
  mailboxes: MailboxState[],
  incidents: MailIncident[],
  generatedAt = new Date().toISOString(),
): MailControlSnapshot {
  return {
    generatedAt,
    domains,
    mailboxes,
    incidents,
    summary: {
      managedDomains: domains.length,
      verifiedDomains: domains.filter((d) => d.status === 'verified').length,
      attentionDomains: domains.filter((d) => d.status === 'degraded' || d.status === 'failed').length,
      totalMailboxes: mailboxes.length,
      activeMailboxes: mailboxes.filter((m) => m.status === 'active').length,
      suspendedMailboxes: mailboxes.filter((m) => m.status === 'suspended').length,
      openSecurityAlerts: incidents.filter((i) => i.status !== 'resolved' && ['critical', 'high'].includes(i.severity)).length,
    },
  };
}

export function canClaimProductionReady(domain: MailDomainState): boolean {
  return domain.status === 'verified'
    && domain.openIncidents === 0
    && Object.values(domain.checks).every((value) => value === 'passed');
}
