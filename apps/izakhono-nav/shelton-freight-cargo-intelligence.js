(() => {
  const API = '/api/freight/cargo';
  const EVENTS = '/api/freight/cargo/events';
  const state = { mode:'UNAVAILABLE', cargo:[], outbox:[], audit:[], lastSync:null, error:null };
  const verified = v => v === true;
  function utilization(weight, capacity){ return Number.isFinite(weight)&&Number.isFinite(capacity)&&capacity>0 ? Math.round((weight/capacity)*100) : null; }
  function assess(item={}) {
    const reasons=[]; let risk='NORMAL';
    const wu=utilization(item.declared_weight_kg,item.vehicle_capacity_kg);
    const vu=utilization(item.volume_m3,item.vehicle_capacity_m3);
    if (verified(item.verified) && wu !== null && wu > 100) { risk='HIGH'; reasons.push('verified weight exceeds vehicle capacity'); }
    if (verified(item.verified) && vu !== null && vu > 100) { risk='HIGH'; reasons.push('verified volume exceeds vehicle capacity'); }
    if (verified(item.vehicle_health_critical)) { risk='CRITICAL'; reasons.push('critical verified vehicle-health condition'); }
    if (verified(item.security_exception) && risk !== 'CRITICAL') { risk='HIGH'; reasons.push('verified security exception'); }
    if (!item.declared_weight_kg && !item.volume_m3) { risk='UNAVAILABLE'; reasons.push('insufficient verified cargo measurements'); }
    if (item.demo === true || item.verified !== true) { if(risk==='NORMAL') risk='WATCH'; reasons.push('data is not verified/live'); }
    return { cargoId:item.cargo_id||null, risk, weightUtilization:wu, volumeUtilization:vu, reasons, evaluatedAt:new Date().toISOString() };
  }
  async function sync(){
    state.error=null;
    try { const r=await fetch(API); if(!r.ok) throw new Error(`HTTP ${r.status}`); const d=await r.json(); state.cargo=Array.isArray(d)?d:(d.items||[]); state.mode='LIVE'; state.lastSync=new Date().toISOString(); return state.cargo; }
    catch(e){ state.mode='UNAVAILABLE'; state.error=e.message; return []; }
  }
  function queue(event){ state.outbox.push({...event,queuedAt:new Date().toISOString()}); return state.outbox.length; }
  async function flush(){ const pending=[...state.outbox]; const remaining=[]; for(const e of pending){ try{const r=await fetch(EVENTS,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(e)}); if(!r.ok) throw new Error('event rejected'); state.audit.push({event:e,flushedAt:new Date().toISOString()});}catch(_){remaining.push(e);} } state.outbox=remaining; return state.outbox.length; }
  function evaluate(item){ const result=assess(item); state.audit.push({type:'cargo_assessment',result}); return result; }
  window.SHELTON_FREIGHT_CARGO={state,sync,flush,queue,evaluate,assess,utilization};
})();