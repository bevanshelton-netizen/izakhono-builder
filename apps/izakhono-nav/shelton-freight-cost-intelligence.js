(function(){
  'use strict';
  const API='/api/freight/cost-intelligence';
  const EVENTS='/api/freight/cost-intelligence/events';
  const state={mode:'UNAVAILABLE',vehicles:{},journeys:{},outbox:[],audit:[],lastSync:null,error:null};
  const now=()=>new Date().toISOString();
  const verified=v=>v && v.verified===true && v.demo!==true;
  function score(b){return b==='EFFICIENT'?90:b==='STABLE'?75:b==='WATCH'?55:b==='REVIEW'?30:null;}
  function evaluate(entity){
    const s=entity||{}; const signals=Array.isArray(s.signals)?s.signals:[];
    const good=signals.filter(verified); if(!good.length)return {band:'UNAVAILABLE',score:null,reasons:['No verified cost signals available'],evaluatedAt:now()};
    let points=75,reasons=[];
    for(const x of good){
      if(x.type==='fuel_cost_per_km' && Number.isFinite(x.value)){ if(x.direction==='favourable')points+=5; if(x.direction==='adverse'){points-=10;reasons.push('Fuel cost trend requires review');} }
      if(x.type==='idle_cost' && Number(x.value)>0){points-=5;reasons.push('Verified idle cost detected');}
      if(x.type==='maintenance_cost_exposure' && x.urgency==='CRITICAL'){points-=25;reasons.push('Critical maintenance exposure');}
      if(x.type==='route_efficiency' && x.direction==='favourable')points+=5;
      if(x.type==='budget_variance' && x.direction==='adverse'){points-=10;reasons.push('Adverse verified budget variance');}
    }
    points=Math.max(0,Math.min(100,points));
    let band=points>=85?'EFFICIENT':points>=70?'STABLE':points>=50?'WATCH':'REVIEW';
    if(good.some(x=>x.conflict===true)){band='REVIEW';reasons.push('Conflicting verified signals require human review');}
    return {id:s.id||null,band,score:points,reasons:reasons.length?reasons:['No adverse verified cost signals'],verifiedSignals:good.length,evaluatedAt:now()};
  }
  async function sync(){
    try{const r=await fetch(API,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);const data=await r.json();state.mode='LIVE';state.lastSync=now();state.error=null;return data;}catch(e){state.mode='UNAVAILABLE';state.error=e.message;return null;}
  }
  function queue(event){state.outbox.push({...event,queuedAt:now()});return state.outbox.length;}
  async function flush(){if(!navigator.onLine)return 0;let sent=0;const pending=[...state.outbox];state.outbox=[];for(const e of pending){try{const r=await fetch(EVENTS,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(e)});if(!r.ok)throw new Error('HTTP '+r.status);sent++;state.audit.push({action:'SYNC',event:e,time:now()});}catch(err){state.outbox.push(e);state.error=err.message;break;}}return sent;}
  function loadDemo(){state.mode='DEMO';return evaluate({id:'DEMO-TRUCK-01',signals:[{type:'fuel_cost_per_km',verified:false,demo:true},{type:'idle_cost',verified:false,demo:true}]});}
  window.SHELTON_FREIGHT_COST={state,evaluate,score, sync, queue, flush, loadDemo};
})();