(function(){
  'use strict';
  const API='/api/freight/events';
  const state={mode:'UNAVAILABLE', incidents:[], lastSync:null, error:null};
  const emit=()=>window.dispatchEvent(new CustomEvent('shelton-freight-security-state',{detail:{...state,incidents:[...state.incidents]}}));
  function normalize(e){return {event_id:e.event_id||e.id||null,journey_id:e.journey_id||null,vehicle_id:e.vehicle_id||null,driver_id:e.driver_id||null,type:e.type||'security',severity:e.severity||'WATCH',status:e.status||'detected',message:e.message||e.description||'Security event',timestamp:e.timestamp||null,source:e.source||'api'};}
  async function sync(){
    try{
      const r=await fetch(API,{headers:{accept:'application/json'},cache:'no-store'});
      if(!r.ok) throw new Error('Security event API unavailable');
      const body=await r.json();
      const list=Array.isArray(body)?body:(body.events||body.data||[]);
      state.mode='LIVE'; state.incidents=list.map(normalize); state.lastSync=new Date().toISOString(); state.error=null;
    }catch(err){
      state.mode='UNAVAILABLE'; state.error=err.message; state.incidents=[];
    }
    emit(); return {...state,incidents:[...state.incidents]};
  }
  function triage(eventId,status){
    const i=state.incidents.find(x=>x.event_id===eventId); if(!i) return false;
    i.status=status; emit(); return true;
  }
  window.SHELTON_FREIGHT_SECURITY_COMMAND={state,sync,triage,api:API};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',emit); else emit();
})();
