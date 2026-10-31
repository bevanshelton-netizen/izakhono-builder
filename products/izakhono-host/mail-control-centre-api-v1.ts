/**
 * IZAKHONO MAIL CONTROL CENTRE — provider-neutral API contract.
 * This module is deliberately storage/transport agnostic. Production adapters
 * must persist state and enforce authentication/RBAC outside this pure model.
 */

export type MailHealth = 'verified' | 'degraded' | 'failed' | 'pending';
export type MailOwnership = 'owned' | 'external-fallback';
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface DomainSnapshot {
  domain: string;
  platform: string;
  health: MailHealth;
  ownership: MailOwnership;
  checks: {
    mx: MailHealth;
    spf: MailHealth;
    dkim: MailHealth;
    dmarc: MailHealth;
    tls: MailHealth;
    smtp: MailHealth;
    imap: MailHealth;
  };
  transport: string;
  lastVerifiedAt: string | null;
  openIncidentIds: string[];
}

export interface MailboxSnapshot {
  address: string;
  platform: string;
  status: 'active' | 'suspended' | 'pending';
  health: MailHealth;
  storageUsedBytes: number;
  storageLimitBytes: number;
  lastAuthAt: string | null;
  lastDeliveryAt: string | null;
  deliveryFailures: number;
  backup: MailHealth;
}

export interface MailIncident {
  id: string;
  severity: IncidentSeverity;
  domain: string;
  mailbox?: string;
  code: string;
  message: string;
  openedAt: string;
  resolvedAt: string | null;
}

export interface MailControlSnapshot {
  generatedAt: string;
  summary: {
    managedDomains: number;
    verifiedDomains: number;
    attentionDomains: number;
    totalMailboxes: number;
    activeMailboxes: number;
    suspendedMailboxes: number;
    securityAlerts: number;
    healthyDomains: number;
  };
  domains: DomainSnapshot[];
  mailboxes: MailboxSnapshot[];
  incidents: MailIncident[];
}

export function domainIsProductionReady(domain: DomainSnapshot, incidents: MailIncident[]): boolean {
  const checks = Object.values(domain.checks);
  return domain.health === 'verified'
    && domain.ownership === 'owned'
    && checks.every((status) => status === 'verified')
    && incidents.every((incident) => incident.resolvedAt !== null);
}

export function buildMailControlSnapshot(input: Omit<MailControlSnapshot, 'generatedAt'>): MailControlSnapshot {
  const domains = input.domains;
  return {
    ...input,
    generatedAt: new Date().toISOString(),
    summary: {
      ...input.summary,
      managedDomains: domains.length,
      verifiedDomains: domains.filter((d) => d.health === 'verified').length,
      attentionDomains: domains.filter((d) => d.health !== 'verified').length,
      healthyDomains: domains.filter((d) => d.health === 'verified').length,
      totalMailboxes: input.mailboxes.length,
      activeMailboxes: input.mailboxes.filter((m) => m.status === 'active').length,
      suspendedMailboxes: input.mailboxes.filter((m) => m.status === 'suspended').length,
      securityAlerts: input.incidents.filter((i) => i.severity === 'critical' || i.severity === 'high').length,
    },
  };
}
