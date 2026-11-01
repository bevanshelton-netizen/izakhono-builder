(() => {
  const state = { mode: 'UNAVAILABLE', records: [], outbox: [], audit: [], lastSync: null, error: null };
  const api = '/api/freight/customer-experience';
  const eventApi = '/api/freight/customer-experience/events';

  function verifiedSignals(signals = []) {
    return signals.filter(s => s && s.verified === true && s.demo !== true);
  }

  function evaluate(record = {}) {
    const signals = verifiedSignals(record.signals || []);
    if (!signals.length) return { band: 'UNAVAILABLE', score: null, reasons: ['No verified customer-experience signals available.'], verifiedSignals: 0 };
    let score = 100;
    const reasons = [];
    for (const s of signals) {
      if (s.type === 'late_delivery') { score -= 20; reasons.push('Verified late-delivery event.'); }
      if (s.type === 'delivery_exception') { score -= 15; reasons.push('Verified delivery exception.'); }
      if (s.type === 'pod_missing') { score -= 10; reasons.push('Proof of delivery is incomplete.'); }
      if (s.type === 'window_adherence') { score += s.value === true ? 5 : -10; }
      if (s.type === 'communication_confirmed') { score += 3; }
      if (s.type === 'service_recovery') { score += 2; }
    }
    score = Math.max(0, Math.min(100, score));
    let band = score >= 90 ? 'EXCELLENT' : score >= 75 ? 'RELIABLE' : score >= 55 ? 'WATCH' : 'REVIEW';
    return { band, score, reasons, verifiedSignals: signals.length, evaluatedAt: new Date().toISOString() };
  }

  async function sync() {
    try {
      const res = await fetch(api, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.records = Array.isArray(data.records) ? data.records : [];
      state.mode = 'LIVE'; state.lastSync = new Date().toISOString(); state.error = null;
      return state.records;
    } catch (e) {
      state.mode = 'UNAVAILABLE'; state.error = e.message; return [];
    }
  }

  function loadDemo(records = []) {
    state.records = records.map(r => ({ ...r, evaluation: evaluate(r) }));
    state.mode = 'DEMO';
    return state.records;
  }

  async function queue(event) {
    const item = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, ...event, queuedAt: new Date().toISOString() };
    state.outbox.push(item); state.audit.push({ action: 'QUEUE', id: item.id, at: item.queuedAt }); return item;
  }

  async function flush() {
    if (!navigator.onLine) return { flushed: 0, remaining: state.outbox.length };
    let flushed = 0;
    while (state.outbox.length) {
      const item = state.outbox[0];
      try {
        const res = await fetch(eventApi, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        state.outbox.shift(); flushed++;
      } catch (_) { break; }
    }
    return { flushed, remaining: state.outbox.length };
  }

  window.SHELTON_FREIGHT_CUSTOMER_EXPERIENCE = { state, evaluate, sync, loadDemo, queue, flush };
  window.addEventListener('online', flush);
})();