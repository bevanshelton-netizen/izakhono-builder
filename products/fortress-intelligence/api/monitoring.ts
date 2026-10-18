export interface MonitoringRule {
  id: string;
  tenantId: string;
  subjectId: string;
  frequency: "daily" | "weekly" | "monthly";
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
}

export interface MonitoringEvent {
  ruleId: string;
  subjectId: string;
  observedAt: string;
  changed: boolean;
  summary: string;
}

/** Scheduling model only. A production worker must persist jobs durably and use licensed providers. */
export class MonitoringRegistry {
  private readonly rules = new Map<string, MonitoringRule>();
  private readonly events: MonitoringEvent[] = [];

  register(rule: MonitoringRule): MonitoringRule {
    this.rules.set(rule.id, { ...rule });
    return { ...rule };
  }

  getForTenant(tenantId: string): MonitoringRule[] {
    return [...this.rules.values()].filter((rule) => rule.tenantId === tenantId).map((rule) => ({ ...rule }));
  }

  record(event: MonitoringEvent): void {
    this.events.push({ ...event });
  }

  eventsForTenant(tenantId: string): MonitoringEvent[] {
    const ids = new Set(this.getForTenant(tenantId).map((rule) => rule.id));
    return this.events.filter((event) => ids.has(event.ruleId)).map((event) => ({ ...event }));
  }
}
