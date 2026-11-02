(() => {
  const KEY='shelton-freight-rules-engine';
  const state={mode:'UNAVAILABLE',decisions:[],outbox:[],audit:[],lastSync:null,error:null};
  const PRIORITY={SAFETY:1,SECURITY:2,OPERATIONS:3,MAINTENANCE:4,DELIVERY:5,CUSTOMER:6,FINANCIAL:7,NETWORK:8};
  const verified=s=>s && s.verified===true && s.demo!==true && s.stale!==true;
  function evaluate(signal={}){
    const v=verified(signal), sev=String(signal.severity||'').toUpperCase(), type=String(signal.type||signal.event_type||'').toLowerCase();
    let decision='INFORMATIONAL', priority='OPERATIONS', rule='unverified';
    if(!v){ if(signal.required_feed_available===false){decision='UNAVAILABLE';rule='missing-feed';} }
    else if(sev==='CRITICAL' && /panic|hijack|distress|tamper|security|safety/.test(type)){decision='ACTION_REQUIRED';priority=type.includes('security')||/hijack|tamper|distress/.test(type)?'SECURITY':'SAFETY';rule=priority==='SECURITY'?'security-critical':'safety-critical';}
    else if(sev==='HIGH'){decision='AUTHORIZE';priority='SAFETY';rule='verified-high';}
    else if(/maintenance|brake|tyre|engine|temperature|fault/.test(type)){decision='AUTHORIZE';priority='MAINTENANCE';rule='maintenance-grounding';}
    else if(/delivery|pod|late/.test(type)){decision='MONITOR';priority='DELIVERY';rule='delivery-exception';}
    else if(/revenue|payment|margin|customer/.test(type)){decision='DELEGATE';priority='FINANCIAL';rule='commercial-risk';}
    const d={id:crypto.randomUUID?crypto.randomUUID():'dec-'+Date.now(),rule,decision,priority,verified:v,input:signal,evaluatedAt:new Date().toISOString()};
    state.decisions.unshift(d); state.decisions=state.decisions.slice(0,100); return d;
  }
  async function post(path,payload){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error('HTTP '+r.status);return r.json().catch(()=>({ok:true}));}
  async function act(decision, action, authorization){
    if(!decision || !action)return null;
    const record={decision_id:decision.id,action,authorized_by:authorization||null,timestamp:new Date().toISOString()};
    state.audit.unshift(record);
    if(!authorization && ['ACTION_REQUIRED','AUTHORIZE'].includes(decision.decision)){record.outcome='AUTHORIZATION_REQUIRED';return record;}
    try{record.outcome=await post('/api/freight/decision-engine/actions',record);state.mode='LIVE';}
    catch(e){record.outcome='QUEUED_OFFLINE';state.outbox.push(record);state.mode='UNAVAILABLE';state.error=e.message;}
    return record;
  }
  async function sync(){try{const r=await fetch('/api/freight/decision-engine/decisions');if(!r.ok)throw new Error('HTTP '+r.status);const data=await r.json();state.decisions=data.decisions||data||[];state.mode='LIVE';state.lastSync=new Date().toISOString();state.error=null;return state;}catch(e){state.mode='UNAVAILABLE';state.error=e.message;return state;}}
  async function flush(){if(!state.outbox.length)return {flushed:0};const pending=[...state.outbox];let flushed=0;for(const x of pending){try{await post('/api/freight/decision-engine/actions',x);flushed++;state.outbox.shift();}catch(e){break;}}return {flushed,remaining:state.outbox.length};}
  function loadDemo(){state.mode='DEMO';return [
    evaluate({type:'route_deviation',severity:'WATCH',verified:true,vehicle_id:'SF-001'}),
    evaluate({type:'hijack_suspected',severity:'CRITICAL',verified:true,vehicle_id:'SF-014'}),
    evaluate({type:'service_due',severity:'HIGH',verified:true,vehicle_id:'SF-009'}),
    evaluate({type:'delivery_exception',severity:'WATCH',verified:true,vehicle_id:'SF-004'}),
    evaluate({type:'revenue_risk',severity:'WATCH',verified:false,vehicle_id:'SF-003',demo:true})
  ];}
  window.SHELTON_FREIGHT_DECISION_ENGINE={state,evaluate,act,sync,flush,loadDemo};
})();
