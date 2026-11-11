import { evaluateRiskEvents, materializeAlerts, transitionAlert } from './risk-engine';

test('detects risk jump, stale scan, certificate expiry and repeated failures', () => {
  const now = '2026-10-28T06:00:00Z';
  const events = evaluateRiskEvents({
    tenantId: 'tenant-a', now, currentRiskScore: 70, previousRiskScore: 50,
    lastScanAt: '2026-10-27T00:00:00Z', certificateExpiryAt: '2026-11-01T00:00:00Z', consecutiveFailures: 3,
  });
  expect(events.map(e => e.type)).toEqual(expect.arrayContaining(['RISK_JUMP', 'STALE_SCAN', 'CERTIFICATE_EXPIRY', 'REPEATED_FAILURE']));
});

test('creates deterministic fingerprints and suppresses duplicates within the cooldown window', () => {
  const events = evaluateRiskEvents({ tenantId: 'tenant-a', now: '2026-10-28T06:00:00Z', currentRiskScore: 40, newFindings: [{ id: 'f-1', severity: 'CRITICAL' }] });
  const first = materializeAlerts(events);
  const second = materializeAlerts(events, first);
  expect(first).toHaveLength(1);
  expect(second).toHaveLength(1);
  expect(second[0].fingerprint).toBe(first[0].fingerprint);
});

test('prevents cross-tenant lifecycle changes', () => {
  const [event] = evaluateRiskEvents({ tenantId: 'tenant-a', now: '2026-10-28T06:00:00Z', currentRiskScore: 40, newFindings: [{ id: 'f-1', severity: 'HIGH' }] });
  const [alert] = materializeAlerts([event]);
  expect(() => transitionAlert(alert, 'ACKNOWLEDGED', 'tenant-b')).toThrow('cross-tenant alert access denied');
});

test('supports acknowledgement and resolution', () => {
  const [event] = evaluateRiskEvents({ tenantId: 'tenant-a', now: '2026-10-28T06:00:00Z', currentRiskScore: 40, newFindings: [{ id: 'f-1', severity: 'HIGH' }] });
  const [alert] = materializeAlerts([event]);
  const acknowledged = transitionAlert(alert, 'ACKNOWLEDGED', 'tenant-a');
  expect(acknowledged.status).toBe('ACKNOWLEDGED');
  expect(transitionAlert(acknowledged, 'RESOLVED', 'tenant-a').status).toBe('RESOLVED');
});
