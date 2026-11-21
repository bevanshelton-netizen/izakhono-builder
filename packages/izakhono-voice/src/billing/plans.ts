export type VoicePlan = {
  id: string;
  name: string;
  currency: string;
  monthlyBaseCents: number;
  includedMinutes: number;
  overagePerMinuteCents: number;
  minimumBillableSeconds?: number;
  billingIncrementSeconds?: number;
};

export const IZAKHONO_VOICE_PLANS: readonly VoicePlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    currency: 'ZAR',
    monthlyBaseCents: 27900,
    includedMinutes: 200,
    overagePerMinuteCents: 175,
    billingIncrementSeconds: 60,
  },
  {
    id: 'essential',
    name: 'Essential',
    currency: 'ZAR',
    monthlyBaseCents: 32900,
    includedMinutes: 500,
    overagePerMinuteCents: 165,
    billingIncrementSeconds: 60,
  },
  {
    id: 'business',
    name: 'Business',
    currency: 'ZAR',
    monthlyBaseCents: 39900,
    includedMinutes: 1000,
    overagePerMinuteCents: 155,
    billingIncrementSeconds: 60,
  },
  {
    id: 'pro',
    name: 'Pro',
    currency: 'ZAR',
    monthlyBaseCents: 69900,
    includedMinutes: 2000,
    overagePerMinuteCents: 145,
    billingIncrementSeconds: 60,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    currency: 'ZAR',
    monthlyBaseCents: 195000,
    includedMinutes: 5000,
    overagePerMinuteCents: 125,
    billingIncrementSeconds: 60,
  },
  {
    id: 'call-centre',
    name: 'Call Centre',
    currency: 'ZAR',
    monthlyBaseCents: 395000,
    includedMinutes: 10000,
    overagePerMinuteCents: 110,
    billingIncrementSeconds: 60,
  },
];

export function getVoicePlan(id: string): VoicePlan | undefined {
  return IZAKHONO_VOICE_PLANS.find((plan) => plan.id === id);
}
