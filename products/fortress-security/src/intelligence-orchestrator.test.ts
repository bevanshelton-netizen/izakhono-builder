import { decide, isolateTenant, verifyDecisionIntegrity } from './intelligence-orchestrator';

describe('FORTRESS intelligence orchestrator', () => {
  const signal = {
    tenantId: 'tenant-a',
    type: 'REGRESSION' as const,
    severity: 'CRITICAL' as const,
    targetId: 'asset-1',
    observedAt: '2026-10-28T05:00:00Z',
  };

  it('creates deterministic high-priority response actions', () => {
    const a = decide(signal);
    const b = decide(signal);
    expect(a.id).toBe(b.id);
    expect(a.actions).toEqual(['ESCALATE_CRITICAL', 'MARK_REGRESSION', 'NOTIFY_SECURITY_ADMIN', 'REQUIRE_REVIEW']);
    expect(verifyDecisionIntegrity(a)).toBe(true);
  });

  it('detects tampering', () => {
    const decision = decide(signal);
    expect(verifyDecisionIntegrity({ ...decision, rationale: 'tampered' })).toBe(false);
  });

  it('enforces tenant isolation', () => {
    const other = decide({ ...signal, tenantId: 'tenant-b' });
    expect(isolateTenant([decide(signal), other], 'tenant-a')).toHaveLength(1);
    expect(isolateTenant([decide(signal), other], 'tenant-b')[0].tenantId).toBe('tenant-b');
  });

  it('requests rescans for risk spikes', () => {
    const decision = decide({ ...signal, type: 'RISK_SPIKE', severity: 'HIGH' });
    expect(decision.actions).toContain('REQUEST_RESCAN');
  });
});
