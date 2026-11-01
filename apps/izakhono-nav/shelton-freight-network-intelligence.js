(function(){
  'use strict';
  const API='/api/freight/network-intelligence';
  const EVENT_API='/api/freight/network-intelligence/events';
  const state={mode:'UNAVAILABLE',corridors:[],outbox:[],audit:[],lastSync:null,error:null};
  const bands=['PREFERRED','STABLE','WATCH','RESTRICTED','UNAVAILABLE'];
  function verified(s){return s&&s.verified===true&&s.demo!==true;}
  function evaluate(c){
    const signals=c&&c.signals||{};
    const verifiedCritical=(signals.critical_security||0)>0;
    const verifiedHigh=(signals.high_security||0)>0;
    const hazards=signals.verified_hazard_rate;
    const deviation=signals.verified_route_deviation_rate;
    const reliability=signals.delivery_reliability;
    const efficiency=signals.fuel_efficiency;
    if(!c||!c.history_sufficient)return {band:'UNAVAILABLE',reason:'Insufficient verified corridor history'};
    if(verifiedCritical)return {band:'RESTRICTED',reason:'Verified critical security signal requires human review'};
    if(verifiedHigh||((hazards??0)>0.15)||((deviation??0)>0.12))return {band:'WATCH',reason:'Verified safety or route-exception pressure'};
    if((reliability??0)>=0.95&&(efficiency??0)>=0.85&&(hazards??0)<=0.05)return {band:'PREFERRED',reason:'Strong verified safety, reliability and efficiency profile'};
    return {band:'STABLE',reason:'Verified corridor performance within operating tolerance'};
  }
  async function sync(){
    state.error=null;
    try{const r=await fetch(API,{headers:{accept:'application/json'}});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();state.corridors=Array.isArray(d.corridors)?d.corridors:[];state.mode='LIVE';state.lastSync=new Date().toISOString();return state.corridors;}
    catch(e){state.error=e.message;state.mode='UNAVAILABLE';return [];}
  }
  function queue(event){state.outbox.push({...event,queued_at:new Date().toISOString()});return state.outbox.length;}
  async function flush(){while(state.outbox.length){const event=state.outbox[0];try{const r=await fetch(EVENT_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(event)});if(!r.ok)throw Error('HTTP '+r.status);state.outbox.shift();}catch(e){state.error=e.message;break;}}return state.outbox.length;}
  function loadDemo(){state.mode='DEMO';state.corridors=[{id:'DEMO-C1',name:'Demo Freight Corridor',history_sufficient:true,signals:{verified_hazard_rate:0.02,verified_route_deviation_rate:0.03,delivery_reliability:0.97,fuel_efficiency:0.9,critical_security:0,high_security:0},demo:true}];return state.corridors;}
  function rank(){return state.corridors.map(c=>({...c,evaluation:evaluate(c)})).sort((a,b)=>bands.indexOf(a.evaluation.band)-bands.indexOf(b.evaluation.band));}
  window.SHELTON_FREIGHT_NETWORK={state,evaluate,sync,queue,flush,loadDemo,rank};
  window.addEventListener('online',flush);
})();