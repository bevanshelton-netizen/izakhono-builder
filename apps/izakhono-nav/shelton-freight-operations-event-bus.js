(() => {
  const API = '/api/freight/events';
  const KEY = 'shelton-freight-event-bus-outbox-v1';
  const state = { mode:'UNAVAILABLE', queue:[], events:[], audit:[], lastSync:null, error:null };

  const now = () => new Date().toISOString();
  const id = (prefix='evt') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
  const persist = () => localStorage.setItem(KEY, JSON.stringify(state.queue));
  const load = () => { try { state.queue = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { state.queue=[]; } };
  const audit = (action, detail={}) => state.audit.unshift({ id:id('audit'), action, at:now(), detail });

  function envelope(input={}) {
    return {
      event_id: input.event_id || id(),
      event_type: input.event_type || 'unknown',
      occurred_at: input.occurred_at || now(),
      source: input.source || 'shelton-freight-client',
      entity_type: input.entity_type || 'unknown',
      entity_id: input.entity_id || 'unknown',
      verified: input.verified === true,
      mode: input.mode || (state.mode === 'LIVE' ? 'LIVE' : 'DEMO'),
      payload: input.payload || {},
      correlation_id: input.correlation_id || null,
      causation_id: input.causation_id || null,
      schema_version: input.schema_version || '0.1'
    };
  }

  function priority(event) {
    if (!event.verified) return 'OBSERVE';
    if (/critical|hijack|distress|panic|tamper/i.test(event.event_type)) return 'CRITICAL';
    if (/security|safety|maintenance.alert|delivery.exception/i.test(event.event_type)) return 'HIGH';
    return 'NORMAL';
  }

  async function publish(input) {
    const event = envelope(input);
    const p = priority(event);
    if (!event.verified && event.mode === 'LIVE') event.mode = 'UNAVAILABLE';
    const record = { event, priority:p, published_at:now() };
    try {
      const res = await fetch(API, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(record) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.mode='LIVE'; state.lastSync=now(); state.error=null;
      state.events.unshift(record); audit('published',{event_id:event.event_id,priority:p});
      return {ok:true,record};
    } catch (err) {
      state.mode = navigator.onLine ? 'UNAVAILABLE' : 'DEMO';
      state.queue.push(record); persist(); state.error=err.message;
      audit('queued',{event_id:event.event_id,reason:err.message});
      return {ok:false,queued:true,record,error:err.message};
    }
  }

  async function flush() {
    const pending = [...state.queue]; let sent=0;
    for (const record of pending) {
      try {
        const res=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(record)});
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        state.queue=state.queue.filter(x=>x.event.event_id!==record.event.event_id); sent++;
        state.events.unshift(record);
      } catch { break; }
    }
    persist(); state.lastSync=sent?now():state.lastSync; audit('flush',{sent,remaining:state.queue.length}); return {sent,remaining:state.queue.length};
  }

  async function stream(limit=50) {
    try {
      const res=await fetch(`${API}?limit=${encodeURIComponent(limit)}`,{headers:{accept:'application/json'}});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data=await res.json();
      state.events=Array.isArray(data.events)?data.events:Array.isArray(data)?data:[];
      state.mode='LIVE'; state.lastSync=now(); state.error=null; audit('sync',{count:state.events.length});
      return state.events;
    } catch(err) { state.error=err.message; return []; }
  }

  function loadDemo() {
    const demo=[
      envelope({event_type:'vehicle.health_changed',source:'demo',entity_type:'vehicle',entity_id:'DEMO-TRUCK-01',verified:false,mode:'DEMO',payload:{health:'WATCH'}}),
      envelope({event_type:'delivery.milestone',source:'demo',entity_type:'delivery',entity_id:'DEMO-DELIVERY-01',verified:false,mode:'DEMO',payload:{state:'POD_PENDING'}}),
      envelope({event_type:'security.signal',source:'demo',entity_type:'vehicle',entity_id:'DEMO-TRUCK-02',verified:false,mode:'DEMO',payload:{signal:'route_deviation'}})
    ];
    state.mode='DEMO'; state.events=demo.map(event=>({event,priority:priority(event),published_at:now()})); audit('demo_loaded',{count:demo.length}); return state.events;
  }

  load();
  window.addEventListener('online', flush);
  window.SHELTON_FREIGHT_EVENT_BUS={state,publish,flush,stream,loadDemo,envelope,priority};
})();