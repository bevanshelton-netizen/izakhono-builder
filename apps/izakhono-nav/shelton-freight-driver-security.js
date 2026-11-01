/* SHELTON FREIGHT DRIVER SECURITY v0.1 */
(function(){
  'use strict';
  const KEY='shelton-freight-driver-security-outbox-v1';
  const VALID={safety_check_in:['security_check','INFO'],driver_distress:['driver_distress','HIGH'],hijack_suspected:['hijack_suspected','CRITICAL'],unauthorized_stop:['unauthorized_stop','HIGH'],route_deviation:['route_deviation','WATCH']};
  let outbox=[]; try{outbox=JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){outbox=[]}
  const state={mode:'UNAVAILABLE',outbox,lastEvent:null,error:null};
  function save(){localStorage.setItem(KEY,JSON.stringify(outbox));state.outbox=outbox.slice()}
  function mode(){return navigator.onLine?'READY':'OFFLINE'}
  function context(){
    const j=window.SHELTON_FREIGHT_COMMAND?.state?.journeys||[];
    const v=window.SHELTON_FREIGHT_COMMAND?.state?.vehicles||[];
    return {journey:j.find(x=>['en_route','departed','exception'].includes(x.status))||j[0]||null,vehicle:v[0]||null};
  }
  function location(){return new Promise(resolve=>{if(!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,source:'browser_geolocation'}),()=>resolve(null),{enableHighAccuracy:true,timeout:5000,maximumAge:10000})})}
  async function create(action,extra={}){
    if(!VALID[action]) throw new Error('Invalid driver security action');
    const [event_class,severity]=VALID[action]; const ctx=context(); const loc=await location();
    const event={event_id:'DRV-'+Date.now(),event_class,severity,vehicle_id:ctx.vehicle?.vehicle_id||null,journey_id:ctx.journey?.journey_id||null,driver_id:ctx.journey?.driver_id||null,timestamp:new Date().toISOString(),source:'shelton_freight_driver',demo:false,...extra};
    if(loc) Object.assign(event,loc);
    const api=window.SHELTON_FREIGHT_FORTRESS;
    try{
      if(api?.record){ const result=await api.record(event); state.mode=api.state?.mode||mode(); state.lastEvent=event; state.error=null; return result; }
      if(!navigator.onLine) throw new Error('offline');
      const r=await fetch('/api/freight/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)}); if(!r.ok) throw new Error('event API '+r.status);
      state.mode='LIVE';state.lastEvent=event;state.error=null;return await r.json().catch(()=>event);
    }catch(e){outbox.push(event);save();state.mode='OFFLINE';state.lastEvent=event;state.error=e.message;return {queued:true,event};}
  }
  async function flush(){ if(!navigator.onLine||!outbox.length)return {flushed:0}; const pending=outbox.slice();let flushed=0; for(const e of pending){try{if(window.SHELTON_FREIGHT_FORTRESS?.record) await window.SHELTON_FREIGHT_FORTRESS.record(e); else {const r=await fetch('/api/freight/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(e)});if(!r.ok)throw new Error('API '+r.status)} outbox.shift();flushed++;}catch(err){break}} save();return {flushed,remaining:outbox.length};}
  window.SHELTON_FREIGHT_DRIVER_SECURITY={state,create,flush,actions:Object.keys(VALID)};
  window.addEventListener('online',flush); save();
})();