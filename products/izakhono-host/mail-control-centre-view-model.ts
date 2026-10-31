export type DashboardStatus = 'configured' | 'degraded' | 'verified' | 'failed';

export interface MailControlDashboardModel {
  generatedAt: string;
  headline: {
    status: DashboardStatus;
    label: string;
    message: string;
  };
  cards: Array<{ key: string; label: string; value: number | string; severity: 'normal' | 'attention' | 'critical' }>;
  domains: Array<{
    domain: string;
    platform: string;
    status: DashboardStatus;
    transport: 'owned' | 'external-fallback' | 'unknown';
    failedChecks: string[];
    openIncidents: number;
    lastVerifiedAt: string | null;
  }>;
  incidents: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    type: string;
    status: 'open' | 'acknowledged' | 'resolved';
    domain?: string;
    mailbox?: string;
  }>;
}

export function buildDashboardModel(snapshot: {
  generatedAt: string;
  domains: Array<{ domain: string; platform: string; status: DashboardStatus; transport: 'owned' | 'external-fallback' | 'unknown'; checks: Record<string, 'passed' | 'failed' | 'pending'>; openIncidents: number; lastVerifiedAt: string | null }>;
  mailboxes: Array<{ status: 'active' | 'suspended' | 'pending' | 'failed' }>;
  incidents: Array<{ id: string; severity: 'critical' | 'high' | 'medium' | 'low'; type: string; status: 'open' | 'acknowledged' | 'resolved'; domain?: string; mailbox?: string }>;
}): MailControlDashboardModel {
  const attentionDomains = snapshot.domains.filter((d) => d.status === 'degraded' || d.status === 'failed').length;
  const criticalIncidents = snapshot.incidents.filter((i) => i.status !== 'resolved' && i.severity === 'critical').length;
  const highIncidents = snapshot.incidents.filter((i) => i.status !== 'resolved' && i.severity === 'high').length;
  const activeMailboxes = snapshot.mailboxes.filter((m) => m.status === 'active').length;

  const status: DashboardStatus = criticalIncidents > 0
    ? 'failed'
    : highIncidents > 0 || attentionDomains > 0
      ? 'degraded'
      : snapshot.domains.length > 0 && snapshot.domains.every((d) => d.status === 'verified')
        ? 'verified'
        : 'configured';

  const label = status.toUpperCase();
  const message = status === 'verified'
    ? 'All registered mail domains currently satisfy the verification state.'
    : status === 'degraded'
      ? 'Operational attention is required on one or more mail services.'
      : status === 'failed'
        ? 'Critical mail or security conditions require operator action.'
        : 'Mail services are registered but production verification is incomplete.';

  return {
    generatedAt: snapshot.generatedAt,
    headline: { status, label, message },
    cards: [
      { key: 'domains', label: 'Managed domains', value: snapshot.domains.length, severity: 'normal' },
      { key: 'verified-domains', label: 'Verified domains', value: snapshot.domains.filter((d) => d.status === 'verified').length, severity: 'normal' },
      { key: 'attention-domains', label: 'Domains requiring attention', value: attentionDomains, severity: attentionDomains ? 'attention' : 'normal' },
      { key: 'active-mailboxes', label: 'Active mailboxes', value: activeMailboxes, severity: 'normal' },
      { key: 'suspended-mailboxes', label: 'Suspended mailboxes', value: snapshot.mailboxes.filter((m) => m.status === 'suspended').length, severity: 'attention' },
      { key: 'security-alerts', label: 'Open security alerts', value: criticalIncidents + highIncidents, severity: criticalIncidents ? 'critical' : highIncidents ? 'attention' : 'normal' },
    ],
    domains: snapshot.domains.map((domain) => ({
      domain: domain.domain,
      platform: domain.platform,
      status: domain.status,
      transport: domain.transport,
      failedChecks: Object.entries(domain.checks).filter(([, value]) => value !== 'passed').map(([key]) => key),
      openIncidents: domain.openIncidents,
      lastVerifiedAt: domain.lastVerifiedAt,
    })),
    incidents: snapshot.incidents,
  };
}
