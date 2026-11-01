(() => {
  const API = '/api/freight/proof-of-delivery';
  const EVENTS = '/api/freight/proof-of-delivery/events';
  const state = { mode: 'UNAVAILABLE', records: [], outbox: [], audit: [], lastSync: null, error: null };

  const verified = r => !!r && r.verified === true && r.demo !== true;
  const normalise = r => ({
    journey_id: r.journey_id || null,
    delivery_id: r.delivery_id || null,
    vehicle_id: r.vehicle_id || null,
    state: r.state || 'POD_PENDING',
    recipient: r.recipient || null,
    captured_at: r.captured_at || null,
    geolocation: r.geolocation || null,
    signature_status: r.signature_status || 'NOT_REQUIRED',
    photo_references: Array.isArray(r.photo_references) ? r.photo_references : [],
    document_references: Array.isArray(r.document_references) ? r.document_references : [],
    quantity_expected: r.quantity_expected ?? null,
    quantity_delivered: r.quantity_delivered ?? null,
    discrepancy: r.discrepancy || null,
    seal_status: r.seal_status || 'UNAVAILABLE',
    notes: r.notes || null,
    verified: !!r.verified,
    demo: !!r.demo,
    evidence_status: r.evidence_status || 'PENDING',
    updated_at: r.updated_at || null
  });

  async function sync() {
    try {
      const res = await fetch(API, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`POD API ${res.status}`);
      const data = await res.json();
      state.records = Array.isArray(data.records) ? data.records.map(normalise) : Array.isArray(data) ? data.map(normalise) : [];
      state.mode = 'LIVE'; state.lastSync = new Date().toISOString(); state.error = null;
      render(); return state.records;
    } catch (e) { state.mode = 'UNAVAILABLE'; state.error = e.message; render(); return []; }
  }

  function loadDemo() {
    state.records = [
      normalise({ journey_id:'DEMO-J-1042', delivery_id:'DEMO-D-1042', vehicle_id:'SF-TRUCK-07', state:'POD_VERIFIED', recipient:'Demo Recipient', captured_at:'2026-11-01T14:22:00Z', signature_status:'VERIFIED', quantity_expected:24, quantity_delivered:24, discrepancy:null, seal_status:'INTACT', evidence_status:'VERIFIED', verified:true, demo:true }),
      normalise({ journey_id:'DEMO-J-1043', delivery_id:'DEMO-D-1043', vehicle_id:'SF-TRUCK-12', state:'EXCEPTION', signature_status:'REFUSED', quantity_expected:18, quantity_delivered:17, discrepancy:'Quantity discrepancy requires human review', seal_status:'EXCEPTION', evidence_status:'EXCEPTION', verified:false, demo:true })
    ];
    state.mode = 'DEMO'; state.error = null; render(); return state.records;
  }

  function queue(event) {
    state.outbox.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), event, queued_at: new Date().toISOString() });
    state.audit.push({ action:'QUEUE', event, at:new Date().toISOString() }); render();
  }

  async function capture(record) {
    const event = { type:'POD_CAPTURED', record: normalise(record), captured_at: new Date().toISOString() };
    try {
      const res = await fetch(EVENTS, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(event) });
      if (!res.ok) throw new Error(`POD event ${res.status}`);
      state.audit.push({ action:'CAPTURE', event, at:new Date().toISOString() });
      await sync();
    } catch { queue(event); }
  }

  async function flush() {
    if (!navigator.onLine || !state.outbox.length) return;
    const pending = [...state.outbox]; state.outbox = [];
    for (const item of pending) {
      try {
        const res = await fetch(EVENTS,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item.event)});
        if (!res.ok) throw new Error();
      } catch { state.outbox.push(item); }
    }
    if (!state.outbox.length) state.lastSync = new Date().toISOString();
    render();
  }

  function render() {
    window.dispatchEvent(new CustomEvent('shelton-freight-pod-update',{detail:state}));
  }
  window.addEventListener('online', flush);
  window.SHELTON_FREIGHT_POD = { state, sync, loadDemo, capture, queue, flush, verified };
  render();
})();