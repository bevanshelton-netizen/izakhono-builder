/* SHELTON FREIGHT — FORTRESS Security Runtime v0.1 */
(function(){
  'use strict';
  const API='/api/freight/events';
  const STORE='shelton-freight-fortress-outbox-v1';
  const state={mode:'UNAVAILABLE',response:'NORMAL',activeIncident:null,outbox:[],lastEvent:null,error:null};
  const emit=()=>window.dispatchEvent(new CustomEvent('shelton-freight-security-state',{detail:{...state,outbox:[...state.outbox]}}));
  const load=()=>{try{state.outbox=JSON.parse(localStorage.getItem(STORE)||'[]')}catch(_){state.outbox=[]}};
  const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(state.outbox))}catch(_){};emit()};
  const validSeverity=new Set(['INFO','WATCH','HIGH','CRITICAL']);
  const validClass=new Set(['panic','hijack_suspected','unauthorized_stop','route_deviation','geofence_breach','vehicle_tamper','driver_distress','security_check','security_clearance']);
  function normalize(input){
    const x=input||{};
    if(!validClass.has(x.event_type)) throw new Error('Unsupported security event');
    const severity=validSeverity.has(x.severity)?x.severity:'WATCH';
    return {event_type:x.event_type,severity,vehicle_id:x.vehicle_id||null,driver_id:x.driver_id||null,journey_id:x.journey_id||null,lat:Number.isFinite(x.lat)?x.lat:null,lon:Number.isFinite(x.lon)?x.lon:null,timestamp:x.timestamp||new Date().toISOString(),source:x.source||'shelton-freight-security-runtime',demo:x.demo===true};
  }
  function responseFor(e){if(e.event_type==='security_clearance') return 'NORMAL';if(e.severity==='CRITICAL') return 'ESCALATED';if(e.severity==='HIGH') return 'MONITOR';if(e.event_type==='hijack_suspected'||e.event_type==='panic'||e.event_type==='driver_distress') return 'ESCALATED';return 'MONITOR'}
  async function post(event){
    try{
      const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(event)});
      if(!r.ok) throw new Error('Security API '+r.status);
      state.mode='LIVE';state.error=null;return true;
    }catch(err){state.mode=event.demo?'DEMO':'UNAVAILABLE';state.error=err.message;return false}
  }
  async function record(input){
    const event=normalize(input);state.lastEvent=event;state.response=responseFor(event);
    if(event.demo===true){state.mode='DEMO';emit();return {accepted:true,mode:'DEMO',event};}
    if(await post(event)){state.activeIncident=event.severity==='INFO'?null:event;emit();return {accepted:true,mode:'LIVE',event};}
    state.outbox.push(event);state.activeIncident=event;save();return {accepted:true,mode:'OFFLINE_QUEUE',event};
  }
  async function flush(){
    if(!state.outbox.length)return {sent:0,pending:0};
    const pending=[];let sent=0;
    for(const e of state.outbox){if(await post(e))sent++;else pending.push(e)}
    state.outbox=pending;save();return {sent,pending:pending.length};
  }
  function resolve(){state.response='RESOLVED';state.activeIncident=null;state.lastEvent={event_type:'security_clearance',severity:'INFO',timestamp:new Date().toISOString(),source:'shelton-freight-security-runtime'};emit();}
  load();
  window.SHELTON_FREIGHT_FORTRESS={state,record,flush,resolve,emit};
  window.addEventListener('online',flush);
  emit();
})();
