export function replayKey(tenantId: string, provider: string, eventId: string): string {
  return `${tenantId}:${provider}:${eventId}`;
}

export function entitlementKey(tenantId: string, provider: string, transactionId: string): string {
  return `${tenantId}:${provider}:${transactionId}`;
}
