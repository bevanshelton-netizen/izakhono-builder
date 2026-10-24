#!/usr/bin/env node
/**
 * YHVH Global Broadcast Engine
 * Shared orchestration layer for TV and Gospel Radio partner networks.
 * Fail-closed: no route is activated without explicit rights clearance.
 */

export class YhvhGlobalBroadcastEngine {
  constructor({ registry = [], rights = [], now = () => new Date() } = {}) {
    this.registry = registry;
    this.rights = rights;
    this.now = now;
  }

  registerPartner(partner) {
    if (!partner?.id || !partner?.name || !partner?.type) throw new Error('partner id, name and type required');
    const allowed = new Set(['TV_NETWORK', 'RADIO_NETWORK', 'RADIO_STATION', 'TV_STATION', 'DISTRIBUTOR', 'MINISTRY']);
    if (!allowed.has(partner.type)) throw new Error(`unsupported partner type: ${partner.type}`);
    const record = { ...partner, status: partner.status || 'PROSPECT', updatedAt: this.now().toISOString() };
    this.registry = [...this.registry.filter(p => p.id !== partner.id), record];
    return record;
  }

  evaluateRoute({ partnerId, contentId, territory, distributionMethod }) {
    const partner = this.registry.find(p => p.id === partnerId);
    if (!partner) return { allowed: false, reason: 'PARTNER_NOT_REGISTERED' };
    const matches = this.rights.filter(r => r.partnerId === partnerId && r.contentId === contentId && r.territory === territory && r.distributionMethod === distributionMethod);
    if (!matches.length) return { allowed: false, reason: 'RIGHTS_RECORD_MISSING', partnerId, contentId, territory, distributionMethod };
    const valid = matches.find(r => r.status === 'CLEAR' && (!r.validUntil || new Date(r.validUntil) > this.now()));
    if (!valid) return { allowed: false, reason: 'RIGHTS_NOT_CLEAR', partnerId, contentId, territory, distributionMethod };
    return { allowed: true, reason: 'CLEAR', partnerId, route: partner.endpoint || null, rightsSource: valid.rightsSource || null };
  }

  snapshot() {
    return {
      engine: 'YHVH Global Broadcast Engine',
      authority: 'IZAKHONO',
      partnerCount: this.registry.length,
      activePartners: this.registry.filter(p => p.status === 'ACTIVE').length,
      tvPartners: this.registry.filter(p => p.type.includes('TV')).length,
      radioPartners: this.registry.filter(p => p.type.includes('RADIO')).length,
      generatedAt: this.now().toISOString()
    };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const engine = new YhvhGlobalBroadcastEngine();
  console.log(JSON.stringify(engine.snapshot(), null, 2));
}
