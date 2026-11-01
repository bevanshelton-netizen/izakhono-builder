(function(){
  'use strict';
  const API='/api/freight/ceo-command-centre';
  const EVENT_API=API+'/events';
  const state={mode:'UNAVAILABLE',kpis:{},queue:[],actions:[],lastSync:null,error:null,outbox:[]};
  const verified=v=>v && v.verified===true && v.demo!==true;
  const scorePosture=(signals)=>{
    const s=(signals||[]).filter(verified);
    if(!s.length)return 'UNAVAILABLE';
    if(s.some(x=>x.severity==='CRITICAL'))return 'CRITICAL';
    if(s.some(x=>x.severity==='HIGH'))return 'HIGH';
    if(s.some(x=>x.severity==='ELEVATED'))return 'ELEVATED';
    if(s.some(x=>x.severity==='WATCH'))return 'WATCH';
    return 'GREEN';
  };
  async function sync(){
    try{
      const r=await fetch(API,{headers:{Accept:'application/json'}});
      if(!r.ok)throw new Error('CEO command feed unavailable');
      const d=await r.json(); state.mode='LIVE'; state.kpis=d.kpis||{}; state.queue=d.decision_queue||[]; state.lastSync=new Date().toISOString(); state.error=null; return state;
    }catch(e){state.mode='UNAVAILABLE';state.error=e.message;return state;}
  }
  function evaluate(signals){const posture=scorePosture(signals);return {posture,verifiedSignals:(signals||[]).filter(verified).length,evaluatedAt:new Date().toISOString()};}
  async function act(action,payload){
    const item={action,payload:payload||{},createdAt:new Date().toISOString(),mode:state.mode};
    state.actions.unshift(item);
    try{const r=await fetch(EVENT_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});if(!r.ok)throw new Error('Action feed unavailable');return item;}catch(e){state.outbox.push(item);state.error=e.message;return item;}
  }
  async function flush(){const pending=[...state.outbox];state.outbox=[];for(const x of pending){try{const r=await fetch(EVENT_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(x)});if(!r.ok)throw new Error();}catch(e){state.outbox.push(x);}}return state.outbox.length;}
  function loadDemo(){state.mode='DEMO';state.kpis={fleetPosture:'WATCH',activeJourneys:'DEMO',safetyRisk:'WATCH',securityRisk:'WATCH',deliveryReliability:'DEMO',customerHealth:'DEMO',revenue:'DEMO',grossMargin:'DEMO',maintenanceExposure:'DEMO',corridorPosture:'STABLE'};state.queue=[];return state;}
  window.SHELTON_FREIGHT_CEO={state,sync,evaluate,act,flush,loadDemo};
  window.addEventListener('online',flush);
})();