(() => {
  const KEY = 'shelton-freight-order-to-cash-v1';
  const API = '/api/freight/order-to-cash';
  const EVENTS = '/api/freight/order-to-cash/events';
  const state = { mode:'UNAVAILABLE', orders:[], outbox:[], audit:[], lastSync:null, error:null };

  const verified = v => v === true;
  const now = () => new Date().toISOString();
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const load = () => { try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) {} };

  function derive(order) {
    if (!order || !order.order_id) return { state:'UNAVAILABLE', reason:'Missing order identity.' };
    if (order.cancelled === true) return { state:'CANCELLED', reason:'Verified cancellation flag.' };
    if (order.exception && verified(order.exception.verified)) return { state:'EXCEPTION', reason:order.exception.code || 'Verified exception.' };
    if (verified(order.payment_verified) && order.payment_status === 'PAID') return { state:'PAID', reason:'Verified payment signal.' };
    if (verified(order.invoice_verified) && order.invoice_status === 'INVOICED') return { state:'PAYMENT_PENDING', reason:'Invoice verified; payment remains pending.' };
    const podVerified = verified(order.pod_verified) && order.pod_status === 'POD_VERIFIED';
    const commercialReady = verified(order.commercial_prerequisites_verified);
    if (podVerified && commercialReady && order.invoice_status !== 'INVOICED') return { state:'INVOICE_READY', reason:'Verified commercial prerequisites and POD.' };
    if (order.pod_status === 'POD_PENDING') return { state:'POD_PENDING', reason:'Delivery evidence remains pending.' };
    if (podVerified) return { state:'POD_VERIFIED', reason:'Proof of delivery verified.' };
    if (order.delivery_status === 'DELIVERED') return { state:'DELIVERED', reason:'Delivery status verified; POD may still be pending.' };
    if (order.journey_status === 'IN_TRANSIT') return { state:'IN_TRANSIT', reason:'Journey marked in transit by verified feed.' };
    if (order.dispatch_verified) return { state:'DISPATCHED', reason:'Dispatch verified.' };
    if (order.schedule_verified) return { state:'SCHEDULED', reason:'Schedule verified.' };
    if (order.validated === true) return { state:'VALIDATED', reason:'Order validation verified.' };
    return { state:'ORDER_RECEIVED', reason:'Order identity received; further verification required.' };
  }

  async function sync() {
    state.error = null;
    try {
      const r = await fetch(API, { headers:{Accept:'application/json'} });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      state.orders = Array.isArray(data.orders) ? data.orders : [];
      state.mode = 'LIVE'; state.lastSync = now(); save(); return state.orders;
    } catch (e) { state.mode='UNAVAILABLE'; state.error=e.message; save(); return []; }
  }

  function loadDemo() {
    state.mode='DEMO';
    state.orders=[
      {order_id:'DEMO-1001',customer_id:'CUSTOMER-A',job_id:'JOB-1001',journey_status:'IN_TRANSIT',dispatch_verified:true,validated:true},
      {order_id:'DEMO-1002',customer_id:'CUSTOMER-B',delivery_status:'DELIVERED',pod_status:'POD_PENDING',validated:true},
      {order_id:'DEMO-1003',customer_id:'CUSTOMER-C',pod_status:'POD_VERIFIED',pod_verified:true,commercial_prerequisites_verified:true,validated:true},
      {order_id:'DEMO-1004',customer_id:'CUSTOMER-D',invoice_status:'INVOICED',invoice_verified:true,payment_status:'PENDING',validated:true},
      {order_id:'DEMO-1005',customer_id:'CUSTOMER-E',payment_status:'PAID',payment_verified:true,invoice_status:'INVOICED',invoice_verified:true,validated:true}
    ];
    save(); return state.orders;
  }

  function evaluate(order) {
    const result = derive(order);
    return {...order, derived_state:result.state, reason:result.reason};
  }

  async function record(event) {
    const item = {...event, event_id:event.event_id || crypto.randomUUID(), created_at:now()};
    state.audit.push(item);
    try {
      const r = await fetch(EVENTS,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      state.mode='LIVE';
    } catch (_) {
      state.outbox.push(item);
      if (state.mode !== 'DEMO') state.mode='UNAVAILABLE';
    }
    save(); return item;
  }

  async function flush() {
    const pending=[...state.outbox]; state.outbox=[];
    for (const item of pending) {
      try { const r=await fetch(EVENTS,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)}); if(!r.ok) throw new Error(); }
      catch(_){ state.outbox.push(item); }
    }
    save(); return state.outbox.length;
  }

  load();
  window.SHELTON_FREIGHT_ORDER_TO_CASH={state,sync,loadDemo,evaluate,record,flush,derive};
})();