(function () {
  'use strict';

  const CONFIG = {
    api: '/api/freight/driver-performance',
    storage: 'shelton-freight-driver-performance-v1',
    staleMs: 24 * 60 * 60 * 1000
  };

  const state = {
    mode: 'UNAVAILABLE',
    drivers: {},
    outbox: [],
    audit: [],
    lastSync: null,
    error: null
  };

  function persist() {
    try { localStorage.setItem(CONFIG.storage, JSON.stringify(state)); } catch (_) {}
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG.storage) || 'null');
      if (saved) Object.assign(state, saved);
    } catch (_) {}
  }

  function now() { return new Date().toISOString(); }

  function verifiedSignal(signal) {
    return !!signal && signal.verified === true && !signal.demo;
  }

  function scoreDriver(driverId, signals) {
    const list = Array.isArray(signals) ? signals : [];
    const verified = list.filter(verifiedSignal);
    if (!verified.length) return { driverId, band: 'UNAVAILABLE', score: null, reasons: ['No verified operational data'] };

    let score = 100;
    const reasons = [];
    let critical = false;
    let review = false;

    verified.forEach(s => {
      const type = String(s.type || 'unknown');
      const severity = String(s.severity || 'INFO').toUpperCase();
      if (severity === 'CRITICAL') { critical = true; score -= 35; reasons.push(type + ': critical'); }
      else if (severity === 'HIGH') { review = true; score -= 20; reasons.push(type + ': high'); }
      else if (severity === 'WATCH') { score -= 5; reasons.push(type + ': watch'); }
      if (type === 'safety_check') score += 2;
      if (type === 'security_clearance') score += 2;
    });

    score = Math.max(0, Math.min(100, score));
    let band = 'STABLE';
    if (critical || score < 45) band = 'REVIEW';
    else if (score >= 90) band = 'EXCELLENT';
    else if (score < 70 || review) band = 'WATCH';

    return { driverId, band, score, reasons, verifiedSignals: verified.length, evaluatedAt: now() };
  }

  function evaluate(driverId, signals) {
    const result = scoreDriver(driverId, signals);
    state.drivers[driverId] = result;
    state.lastSync = now();
    state.error = null;
    state.audit.unshift({ at: now(), action: 'EVALUATE', driverId, result });
    state.audit = state.audit.slice(0, 100);
    persist();
    return result;
  }

  async function sync(driverId) {
    try {
      const url = driverId ? CONFIG.api + '?driverId=' + encodeURIComponent(driverId) : CONFIG.api;
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!response.ok) throw new Error('API ' + response.status);
      const payload = await response.json();
      state.mode = 'LIVE';
      state.lastSync = now();
      const rows = Array.isArray(payload.drivers) ? payload.drivers : (driverId ? [payload] : []);
      rows.forEach(row => evaluate(row.driverId, row.signals));
      persist();
      return payload;
    } catch (error) {
      state.error = error.message;
      if (state.mode !== 'DEMO') state.mode = 'UNAVAILABLE';
      persist();
      return null;
    }
  }

  function loadDemo(driverId, signals) {
    state.mode = 'DEMO';
    return evaluate(driverId, signals || []);
  }

  function queue(action) {
    state.outbox.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), at: now(), action });
    persist();
  }

  async function flush() {
    if (!navigator.onLine || !state.outbox.length) return { sent: 0, remaining: state.outbox.length };
    let sent = 0;
    while (state.outbox.length) {
      const item = state.outbox[0];
      try {
        const response = await fetch('/api/freight/driver-performance/events', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item)
        });
        if (!response.ok) break;
        state.outbox.shift(); sent++;
      } catch (_) { break; }
    }
    persist();
    return { sent, remaining: state.outbox.length };
  }

  window.addEventListener('online', flush);
  restore();
  window.SHELTON_FREIGHT_DRIVER_PERFORMANCE = { state, evaluate, scoreDriver, sync, loadDemo, queue, flush };
})();
