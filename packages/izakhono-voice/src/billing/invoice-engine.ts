import type { VoiceTariff, UsageSummary } from './usage-ledger';

export type VoiceInvoiceLine = {
  description: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
};

export type VoiceInvoice = {
  id: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  status: 'draft' | 'issued';
  lines: VoiceInvoiceLine[];
  subtotalCents: number;
  totalCents: number;
  issuedAt?: string;
};

export function createMonthlyVoiceInvoice(args: {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  summary: UsageSummary;
  tariff: VoiceTariff;
  invoiceId?: string;
}): VoiceInvoice {
  const lines: VoiceInvoiceLine[] = [
    {
      description: `IZAKHONO VOICE monthly plan (${summary.includedMinutes} included minutes)`,
      quantity: 1,
      unitAmountCents: tariff.monthlyBaseCents,
      amountCents: tariff.monthlyBaseCents,
    },
  ];

  if (summary.overageMinutes > 0) {
    lines.push({
      description: 'Voice usage overage',
      quantity: summary.overageMinutes,
      unitAmountCents: tariff.overagePerMinuteCents,
      amountCents: summary.overageAmountCents,
    });
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);

  return {
    id: args.invoiceId ?? `iv_${args.tenantId}_${args.periodStart}`,
    tenantId: args.tenantId,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    currency: tariff.currency,
    status: 'draft',
    lines,
    subtotalCents,
    totalCents: subtotalCents,
  };
}

export function issueVoiceInvoice(invoice: VoiceInvoice, issuedAt = new Date().toISOString()): VoiceInvoice {
  if (invoice.status === 'issued') return invoice;
  return { ...invoice, status: 'issued', issuedAt };
}
