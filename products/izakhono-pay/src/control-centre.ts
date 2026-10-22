export type MerchantControlCentre = {
  merchantId: string;
  status: string;
  transactions: number;
  processedVolume: number;
  pendingVolume: number;
  settledNet: number;
  activePaymentLinks: number;
  requestedRefunds: number;
  kybChecks: number;
  providerHealth: Array<{ provider: string; status: string; failureCount: number; lastCheckedAt: string }>;
};

export function buildControlCentre(data: Omit<MerchantControlCentre, 'merchantId'> & { merchantId: string }): MerchantControlCentre {
  return {
    ...data,
    transactions: Number(data.transactions || 0),
    processedVolume: Number(data.processedVolume || 0),
    pendingVolume: Number(data.pendingVolume || 0),
    settledNet: Number(data.settledNet || 0),
    activePaymentLinks: Number(data.activePaymentLinks || 0),
    requestedRefunds: Number(data.requestedRefunds || 0),
    kybChecks: Number(data.kybChecks || 0),
    providerHealth: data.providerHealth || [],
  };
}
