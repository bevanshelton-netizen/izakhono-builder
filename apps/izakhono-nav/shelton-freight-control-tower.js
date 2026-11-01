(function(){
  'use strict';
  const API='/api/freight/control-tower';
  const EVENT_API=API+'/events';
  const state={mode:'UNAVAILABLE',summary:null,alerts:[],domains:{},outbox:[],audit:[],lastSync:null,error:null};
  const verified=v=>v===true || (v && v.verified===true && v.demo!==true);
  const severityRank={NORMAL:0,WATCH:1,ELEVATED:2,HIGH:3,CRITICAL:4,UNAVAILABLE:-1};
  const maxBand=(a,b)=>severityRank[a]>=severityRank[b]?a:b;
  function assess(input){
    const x=input||{}; const signals=Array.isArray(x.signals)?x.signals:[];
    let band='NORMAL'; let verifiedCount=0;
    for(const s of signals){
      if(!verified(s)) continue;
      verifiedCount++;
      const b=String(s.severity||s.band||'WATCH').toUpperCase();
      if(severityRank[b]!==undefined) band=maxBand(band,b);
    }
    if(!verifiedCount && (!x.live || x.unavailable)) band='UNAVAILABLE';
    return {band,verifiedSignals:verifiedCount,evaluatedAt:new Date().toISOString()};
  }
  function setMode(mode){state.mode=mode; return state.mode;}
  async function sync(){
    try{
      const r=await fetch(API,{headers:{Accept:'application/json'}});
      if(!r.ok) throw new Error('Control Tower API '+r.status);
      const data=await r.json(); state.summary=data; state.mode='LIVE'; state.lastSync=new Date().toISOString(); state.error=null; return data;
    }catch(e){state.mode='UNAVAILABLE'; state.error=e.message; return null;}
  }
  async function emit(event){
    const payload={...event,event_id:event.event_id||('ct-'+Date.now()),created_at:new Date().toISOString()};
    try{
      const r=await fetch(EVENT_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(!r.ok) throw new Error('Event API '+r.status);
      state.audit.push(payload); return {sent:true,event:payload};
    }catch(e){state.outbox.push(payload); state.audit.push({...payload,queued:true}); state.error=e.message; return {sent:false,queued:true,event:payload};}
  }
  async function flush(){
    if(!navigator.onLine) return {sent:0,remaining:state.outbox.length};
    let sent=0;
    while(state.outbox.length){const ev=state.outbox[0]; try{const r=await fetch(EVENT_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ev)}); if(!r.ok) throw new Error('flush failed'); state.outbox.shift(); sent++;}catch(e){state.error=e.message; break;}}
    return {sent,remaining:state.outbox.length};
  }
  window.SHELTON_FREIGHT_CONTROL_TOWER={state,assess,setMode,sync,emit,flush};
  window.addEventListener('online',flush);
})();