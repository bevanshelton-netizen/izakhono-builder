(() => {
  const API = '/api/freight/delivery-intelligence';
  const EVENTS = '/api/freight/delivery-intelligence/events';
  const state = { mode:'UNAVAILABLE', deliveries:[], outbox:[], audit:[], lastSync:null, error:null };

  const now = () => new Date().toISOString();
  const verified = v => v && v.verified === true && v.demo !== true;

  function classify(d = {}) {
    const signals = Array.isArray(d.signals) ? d.signals.filter(verified) : [];
    if (!signals.length) return { status:'UNAVAILABLE', severity:'UNAVAILABLE', exception:'UNKNOWN', reason:'No verified delivery signals available.' };
    const types = new Set(signals.map(s => s.type));
    if (types.has('security_event')) return { status:'EXCEPTION', severity:'CRITICAL', exception:'SECURITY_EVENT', reason:'Verified security signal requires operational review.' };
    if (types.has('safety_hold')) return { status:'AT_RISK', severity:'HIGH', exception:'SAFETY_HOLD', reason:'Verified safety hold takes precedence over delivery speed.' };
    if (types.has('vehicle_health')) return { status:'AT_RISK', severity:'HIGH', exception:'VEHICLE_HEALTH', reason:'Verified vehicle-health issue may affect safe delivery.' };
    if (types.has('route_deviation')) return { status:'AT_RISK', severity:'HIGH', exception:'ROUTE_DEVIATION', reason:'Verified route deviation requires review.' };
    if (types.has('delivery_window')) return { status:'AT_RISK', severity:'WATCH', exception:'DELIVERY_WINDOW', reason:'Verified delivery-window risk detected.' };
    if (types.has('connectivity_loss')) return { status:'IN_TRANSIT', severity:'WATCH', exception:'CONNECTIVITY_LOSS', reason:'Connectivity is unavailable; current ETA may be unavailable.' };
    if (d.delivered === true) return { status:'DELIVERED', severity:'INFO', exception:'NONE', reason:'Verified delivery milestone received.' };
    return { status:d.arriving ? 'ARRIVING' : 'IN_TRANSIT', severity:'INFO', exception:'NONE', reason:'Verified journey signals indicate normal progress.' };
  }

  function evaluate(delivery) {
    const result = classify(delivery);
    const locations = (delivery.signals || []).filter(s => verified(s) && s.type === 'location' && s.timestamp);
    const eta = verified(delivery.eta) ? delivery.eta.value : null;
    return {
      ...delivery,
      ...result,
      verifiedSignals:(delivery.signals || []).filter(verified).length,
      eta: eta ? { value:eta, status:'VERIFIED' } : { value:null, status:'UNAVAILABLE' },
      lastVerifiedLocation: locations.length ? locations[locations.length - 1] : null,
      evaluatedAt:now()
    };
  }

  async function sync() {
    state.error = null;
    try {
      const res = await fetch(API, { headers:{Accept:'application/json'} });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.deliveries = (Array.isArray(data) ? data : data.deliveries || []).map(evaluate);
      state.mode = 'LIVE'; state.lastSync = now(); return state.deliveries;
    } catch (e) {
      state.mode = 'UNAVAILABLE'; state.error = e.message; return [];
    }
  }

  function loadDemo() {
    state.mode = 'DEMO';
    state.deliveries = [
      evaluate({id:'DEMO-FRT-001', reference:'DEMO-DELIVERY-001', destination:'Demo Distribution Centre', signals:[
        {type:'location', verified:true, demo:true, timestamp:now()},
        {type:'delivery_window', verified:true, demo:true}
      ]}),
      evaluate({id:'DEMO-FRT-002', reference:'DEMO-DELIVERY-002', destination:'Demo Customer', signals:[
        {type:'location', verified:true, demo:true, timestamp:now()},
        {type:'vehicle_health', verified:true, demo:true}
      ]})
    ];
    return state.deliveries;
  }

  async function record(event) {
    const payload = {...event, eventId:event.eventId || crypto.randomUUID(), createdAt:now()};
    state.audit.push(payload);
    try {
      const res = await fetch(EVENTS, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (_) {
      state.outbox.push(payload);
    }
    return payload;
  }

  async function flush() {
    const pending = [...state.outbox]; state.outbox = [];
    for (const event of pending) await record(event);
    return state.outbox.length === 0;
  }

  window.addEventListener('online', flush);
  window.SHELTON_FREIGHT_DELIVERY = {state, evaluate, sync, loadDemo, record, flush};
})();