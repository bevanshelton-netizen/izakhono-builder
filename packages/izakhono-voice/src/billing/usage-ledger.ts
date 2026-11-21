export type VoiceTariff = {
  currency: string;
  monthlyBaseCents: number;
  includedMinutes: number;
  includedSeconds?: number;
  overagePerMinuteCents: number;
  minimumBillableSeconds?: number;
  billingIncrementSeconds?: number;
};

export type UsageEntry = {
  tenantId: string;
  cdrId: string;
  callId?: string;
  billableSeconds: number;
  billableMinutes: number;
  amountCents: number;
  currency: string;
  recordedAt: string;
};

export type UsageSummary = {
  tenantId: string;
  currency: string;
  baseAmountCents: number;
  includedMinutes: number;
  usedMinutes: number;
  overageMinutes: number;
  overageAmountCents: number;
  totalAmountCents: number;
  entries: number;
};

function billableSeconds(rawSeconds: number, tariff: VoiceTariff): number {
  const minimum = tariff.minimumBillableSeconds ?? 0;
  const increment = tariff.billingIncrementSeconds ?? 1;
  const seconds = Math.max(rawSeconds, minimum);
  return Math.ceil(seconds / increment) * increment;
}

export class UsageLedger {
  private readonly entries = new Map<string, UsageEntry>();

  recordCdr(args: {
    tenantId: string;
    cdrId: string;
    callId?: string;
    durationSeconds?: number;
    billableSeconds?: number;
    recordedAt?: string;
    tariff: VoiceTariff;
  }): UsageEntry {
    const existing = this.entries.get(args.cdrId);
    if (existing) return existing;

    const rawSeconds = Math.max(0, args.billableSeconds ?? args.durationSeconds ?? 0);
    const seconds = billableSeconds(rawSeconds, args.tariff);
    const minutes = seconds / 60;
    const amountCents = Math.round(minutes * args.tariff.overagePerMinuteCents);

    const entry: UsageEntry = {
      tenantId: args.tenantId,
      cdrId: args.cdrId,
      callId: args.callId,
      billableSeconds: seconds,
      billableMinutes: minutes,
      amountCents,
      currency: args.tariff.currency,
      recordedAt: args.recordedAt ?? new Date().toISOString(),
    };

    this.entries.set(args.cdrId, entry);
    return entry;
  }

  summarize(tenantId: string, tariff: VoiceTariff): UsageSummary {
    const tenantEntries = [...this.entries.values()].filter((entry) => entry.tenantId === tenantId);
    const usedMinutes = tenantEntries.reduce((sum, entry) => sum + entry.billableMinutes, 0);
    const includedMinutes = tariff.includedSeconds != null
      ? tariff.includedSeconds / 60
      : tariff.includedMinutes;
    const overageMinutes = Math.max(0, usedMinutes - includedMinutes);
    const overageAmountCents = Math.round(overageMinutes * tariff.overagePerMinuteCents);

    return {
      tenantId,
      currency: tariff.currency,
      baseAmountCents: tariff.monthlyBaseCents,
      includedMinutes,
      usedMinutes,
      overageMinutes,
      overageAmountCents,
      totalAmountCents: tariff.monthlyBaseCents + overageAmountCents,
      entries: tenantEntries.length,
    };
  }

  list(tenantId: string): UsageEntry[] {
    return [...this.entries.values()].filter((entry) => entry.tenantId === tenantId);
  }
}
