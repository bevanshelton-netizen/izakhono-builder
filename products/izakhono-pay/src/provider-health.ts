export type ProviderHealthStatus = 'healthy' | 'degraded' | 'offline';

export type ProviderHealth = {
  provider: string;
  status: ProviderHealthStatus;
  failureCount: number;
  lastCheckedAt: string;
};

export function isProviderUsable(health: ProviderHealth | undefined) {
  return !!health && health.status !== 'offline';
}

export function rankProviders<T extends { provider: string; priority: number }>(routes: T[], health: ProviderHealth[]) {
  const byProvider = new Map(health.map((h) => [h.provider, h]));
  return [...routes]
    .filter((route) => isProviderUsable(byProvider.get(route.provider)))
    .sort((a, b) => {
      const ah = byProvider.get(a.provider);
      const bh = byProvider.get(b.provider);
      const statusScore = (s?: ProviderHealthStatus) => s === 'healthy' ? 0 : s === 'degraded' ? 1 : 2;
      return statusScore(ah?.status) - statusScore(bh?.status) || a.priority - b.priority;
    });
}
