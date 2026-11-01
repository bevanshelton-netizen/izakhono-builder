(() => {
  const API = '/api/freight/vehicle-health';
  const EVENT_API = '/api/freight/vehicle-health/events';
  const state = { mode: 'UNAVAILABLE', vehicles: [], outbox: [], audit: [], lastSync: null, error: null };

  const verified = v => v && v.verified === true && v.demo !== true;
  const urgencyRank = { ROUTINE: 1, SOON: 2, URGENT: 3, CRITICAL: 4 };

  function evaluate(vehicle) {
    const signals = Array.isArray(vehicle?.signals) ? vehicle.signals : [];
    const vs = signals.filter(verified);
    if (!vs.length) return { vehicleId: vehicle?.vehicleId || null, state: 'UNAVAILABLE', urgency: 'ROUTINE', reasons: ['No verified vehicle-health telemetry available.'], verifiedSignals: 0 };
    const critical = vs.filter(s => s.severity === 'CRITICAL' || s.type === 'critical_verified_fault');
    const due = vs.some(s => s.type === 'service_due' || s.serviceDue === true);
    const warnings = vs.filter(s => ['HIGH', 'WARNING', 'WATCH'].includes(s.severity));
    let health = 'HEALTHY', urgency = 'ROUTINE';
    const reasons = [];
    if (critical.length) { health = 'GROUNDED'; urgency = 'CRITICAL'; reasons.push('Verified critical vehicle-health fault requires human review before operation.'); }
    else if (due) { health = 'SERVICE_DUE'; urgency = 'SOON'; reasons.push('Verified maintenance/service due signal detected.'); }
    else if (warnings.length) { health = 'WATCH'; urgency = 'SOON'; reasons.push('Verified vehicle-health warning requires monitoring.'); }
    else reasons.push('Verified vehicle-health signals currently indicate normal operating condition.');
    return { vehicleId: vehicle.vehicleId, state: health, urgency, reasons, verifiedSignals: vs.length, evaluatedAt: new Date().toISOString() };
  }

  async function sync() {
    try {
      const r = await fetch(API, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      state.vehicles = Array.isArray(data.vehicles) ? data.vehicles.map(v => ({ ...v, evaluation: evaluate(v) })) : [];
      state.mode = 'LIVE'; state.lastSync = new Date().toISOString(); state.error = null;
      return state.vehicles;
    } catch (e) { state.mode = 'UNAVAILABLE'; state.error = e.message; return []; }
  }

  function loadDemo() {
    state.mode = 'DEMO';
    state.vehicles = [
      { vehicleId: 'DEMO-TRUCK-01', registration: 'DEMO-001', signals: [{ type: 'service_due', serviceDue: true, verified: false, demo: true }], evaluation: null },
      { vehicleId: 'DEMO-TRUCK-02', registration: 'DEMO-002', signals: [{ type: 'battery_health', severity: 'WARNING', verified: false, demo: true }], evaluation: null }
    ].map(v => ({ ...v, evaluation: evaluate(v) }));
    return state.vehicles;
  }

  function queue(event) { state.outbox.push({ ...event, queuedAt: new Date().toISOString() }); return state.outbox.length; }
  async function flush() {
    while (state.outbox.length) {
      const event = state.outbox[0];
      try { const r = await fetch(EVENT_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); state.outbox.shift(); }
      catch (e) { state.error = e.message; break; }
    }
    return state.outbox.length;
  }

  function acknowledge(vehicleId, action = 'MAINTENANCE_REVIEW') {
    const record = { vehicleId, action, timestamp: new Date().toISOString(), mode: state.mode };
    state.audit.push(record); queue({ type: 'vehicle_health_action', ...record }); return record;
  }

  window.SHELTON_FREIGHT_VEHICLE_HEALTH = { state, evaluate, sync, loadDemo, queue, flush, acknowledge };
})();