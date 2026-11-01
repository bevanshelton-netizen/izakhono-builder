(function(){
  'use strict';
  const KEY='shelton-freight-incidents-v1';
  const STATES=['NEW','TRIAGED','ACKNOWLEDGED','ESCALATED','RESPONDING','RESOLVED','CLOSED'];
  const EVENTS=['panic','hijack_suspected','unauthorized_stop','route_deviation','geofence_breach','vehicle_tamper','driver_distress'];
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}};
  const write=x=>{try{localStorage.setItem(KEY,JSON.stringify(x.slice(-100)))}catch{}};
  const id=()=>`INC-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
  const normalize=(input={})=>({
    incident_id:input.incident_id||id(), event_class:input.event_class||'driver_distress',
    severity:input.severity||'HIGH', state:input.state||'NEW',
    vehicle_id:input.vehicle_id||null, driver_id:input.driver_id||null, journey_id:input.journey_id||null,
    lat:Number.isFinite(input.lat)?input.lat:null, lon:Number.isFinite(input.lon)?input.lon:null,
    source:input.source||'driver', demo:input.demo===true, created_at:input.created_at||new Date().toISOString(),
    updated_at:new Date().toISOString(), notes:input.notes||''
  });
  async function post(path,payload){
    try{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw Error(`HTTP ${r.status}`);return await r.json().catch(()=>({ok:true}));}catch(e){return {ok:false,error:e.message};}
  }
  async function create(input){
    if(!EVENTS.includes(input.event_class||'driver_distress')) throw Error('Unsupported incident class');
    const incident=normalize(input); const result=await post('/api/freight/events',{type:incident.event_class,category:'security',incident});
    const list=read(); list.push(incident); write(list); emit();
    return {incident,result,mode:result.ok?'LIVE':'QUEUED'};
  }
  async function transition(incidentId,next,notes=''){
    if(!STATES.includes(next)) throw Error('Unsupported incident state');
    const list=read(); const i=list.findIndex(x=>x.incident_id===incidentId); if(i<0) throw Error('Incident not found');
    list[i]={...list[i],state:next,updated_at:new Date().toISOString(),notes:notes||list[i].notes}; write(list);
    const result=await post('/api/freight/events',{type:'security',category:'incident_state',incident:list[i],action:next}); emit();
    return {incident:list[i],result};
  }
  function current(){return read();}
  function emit(){window.dispatchEvent(new CustomEvent('shelton-freight-incidents',{detail:current()}));}
  window.SHELTON_FREIGHT_INCIDENTS={states:STATES,eventClasses:EVENTS,current,create,transition,emit};
  emit();
})();
