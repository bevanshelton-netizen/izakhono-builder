(() => {
  const API = '/api/freight/profitability';
  const EVENTS = '/api/freight/profitability/events';
  const state = { mode: 'UNAVAILABLE', records: [], outbox: [], audit: [], lastSync: null, error: null };

  const num = (v) => Number.isFinite(Number(v)) ? Number(v) : null;
  const verified = (v) => v && v.verified === true && v.demo !== true;
  const sum = (a) => a.reduce((x, v) => x + (num(v) || 0), 0);

  function calculate(input = {}) {
    const revenue = verified(input.revenue) ? num(input.revenue.value) : null;
    const cost = verified(input.cost) ? num(input.cost.value) : null;
    const km = verified(input.distanceKm) ? num(input.distanceKm.value) : null;
    const deliveries = verified(input.deliveries) ? num(input.deliveries.value) : null;
    const capacity = verified(input.capacity) ? num(input.capacity.value) : null;
    const loaded = verified(input.loaded) ? num(input.loaded.value) : null;

    if (revenue === null || cost === null) {
      return { band: 'UNAVAILABLE', score: null, revenue, cost, margin: null, marginPercentage: null, costPerKm: null, costPerDelivery: null, cargoUtilisation: null, reasons: ['Verified revenue and verified cost are required.'] };
    }

    const margin = revenue - cost;
    const marginPercentage = revenue > 0 ? (margin / revenue) * 100 : null;
    const costPerKm = km > 0 ? cost / km : null;
    const costPerDelivery = deliveries > 0 ? cost / deliveries : null;
    const cargoUtilisation = capacity > 0 && loaded !== null ? (loaded / capacity) * 100 : null;

    let band = 'STABLE';
    if (margin < 0) band = 'REVIEW';
    else if (marginPercentage !== null && marginPercentage < 8) band = 'WATCH';
    else if (marginPercentage !== null && marginPercentage >= 15) band = 'PROFITABLE';

    const reasons = [margin < 0 ? 'Verified negative contribution margin.' : 'Verified revenue exceeds verified operating cost.'];
    if (cargoUtilisation !== null && cargoUtilisation < 50) reasons.push('Verified low cargo utilisation may increase cost exposure.');
    if (costPerKm !== null) reasons.push(`Verified cost per km: ${costPerKm.toFixed(2)}.`);

    return { band, score: marginPercentage === null ? null : Math.round(marginPercentage * 10) / 10, revenue, cost, margin, marginPercentage, costPerKm, costPerDelivery, cargoUtilisation, reasons };
  }

  async function sync() {
    state.error = null;
    try {
      const res = await fetch(API, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.records = Array.isArray(data.records) ? data.records : [];
      state.mode = 'LIVE';
      state.lastSync = new Date().toISOString();
      return state.records;
    } catch (e) {
      state.mode = 'UNAVAILABLE';
      state.error = e.message;
      return [];
    }
  }

  function loadDemo() {
    const demo = [
      { id: 'JOB-DEMO-001', customer: 'Demo Customer A', revenue: { value: 18500, verified: false, demo: true }, cost: { value: 12900, verified: false, demo: true }, distanceKm: { value: 420, verified: false, demo: true }, deliveries: { value: 6, verified: false, demo: true }, capacity: { value: 24000, verified: false, demo: true }, loaded: { value: 20400, verified: false, demo: true } },
      { id: 'JOB-DEMO-002', customer: 'Demo Customer B', revenue: { value: 9800, verified: false, demo: true }, cost: { value: 10400, verified: false, demo: true }, distanceKm: { value: 310, verified: false, demo: true }, deliveries: { value: 4, verified: false, demo: true }, capacity: { value: 18000, verified: false, demo: true }, loaded: { value: 7200, verified: false, demo: true } }
    ];
    state.records = demo.map(r => ({ ...r, calculation: calculate(r) }));
    state.mode = 'DEMO';
    state.lastSync = new Date().toISOString();
    return state.records;
  }

  async function recordEvent(event) {
    const payload = { ...event, createdAt: new Date().toISOString() };
    state.audit.push(payload);
    try {
      const res = await fetch(EVENTS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      state.outbox.push(payload);
      state.error = e.message;
    }
    return payload;
  }

  async function flush() {
    if (!state.outbox.length) return { sent: 0, remaining: 0 };
    const pending = [...state.outbox]; state.outbox = [];
    let sent = 0;
    for (const item of pending) {
      try {
        const res = await fetch(EVENTS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        sent++;
      } catch (_) { state.outbox.push(item); }
    }
    return { sent, remaining: state.outbox.length };
  }

  window.SHELTON_FREIGHT_PROFITABILITY = { state, calculate, sync, loadDemo, recordEvent, flush };
  window.addEventListener('online', flush);
})();