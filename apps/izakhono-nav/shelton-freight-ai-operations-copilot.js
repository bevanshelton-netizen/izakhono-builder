(function(){
  'use strict';
  const state={mode:'UNAVAILABLE',brief:null,queue:[],audit:[],lastSync:null,error:null};
  const verified=x=>!!(x&&x.verified===true&&x.demo!==true);
  const priority=x=>{
    if(!verified(x)) return 'INFORMATIONAL';
    const s=String(x.severity||x.priority||'').toUpperCase();
    if(['CRITICAL','CRITICAL_SAFETY','CRITICAL_SECURITY'].includes(s)) return 'CRITICAL';
    if(['HIGH','OPERATIONAL_BLOCKER','MAINTENANCE_RISK'].includes(s)) return 'HIGH';
    if(['MEDIUM','WATCH','CUSTOMER_ESCALATION','FINANCIAL_RISK'].includes(s)) return 'MEDIUM';
    return 'LOW';
  };
  const explain=x=>{
    if(!verified(x)) return {summary:'No verified operational fact is available for this signal.',why:'The signal is unverified or demo data.',recommendation:'Observe only; do not create a real operational action.',authorization:false};
    const p=priority(x), type=String(x.type||x.category||'operational_signal').toLowerCase();
    const map={
      hijack_suspected:['Potential security event requires immediate human review.','Security risk can affect driver, vehicle and journey safety.','Escalate through the authorized security workflow.'],
      driver_distress:['Driver distress signal requires human attention.','Driver welfare and journey safety take priority.','Initiate the configured driver check-in/security workflow.'],
      route_deviation:['A verified route deviation has been detected.','Unexpected movement may indicate an operational or security exception.','Verify journey context and escalate if policy requires.'],
      unauthorized_stop:['A verified unauthorized stop has been detected.','An unexpected stop can create safety, security or delivery risk.','Check in with the driver and review the journey context.'],
      vehicle_tamper:['A verified vehicle tamper signal requires review.','Vehicle integrity may be compromised.','Escalate to the authorized security workflow.'],
      maintenance_risk:['A verified maintenance risk requires review.','Vehicle readiness may affect safe operations.','Review maintenance status before continuing affected operations.'],
      delivery_exception:['A verified delivery exception requires operational review.','The exception may affect customer commitments and downstream revenue.','Review delivery status and authorize the appropriate exception workflow.']
    };
    const m=map[type]||['A verified operational signal requires review.','The signal may affect fleet safety, security or operations.','Review the evidence and follow the authorized workflow.'];
    return {summary:m[0],why:m[1],recommendation:m[2],authorization:p==='CRITICAL'||p==='HIGH'||p==='MEDIUM'};
  };
  function ask(question,signals=[]){
    const verifiedSignals=signals.filter(verified);
    const answer=verifiedSignals.length?verifiedSignals.slice(0,5).map(s=>({signal:s.id||s.type,priority:priority(s),...explain(s)})):null;
    const record={id:'COP-'+Date.now(),question:String(question||''),verifiedEvidence:verifiedSignals.map(s=>s.id||s.type||'signal'),answer,createdAt:new Date().toISOString()};
    state.audit.unshift(record); return record;
  }
  async function sync(){
    try{const r=await fetch('/api/freight/ai-operations-copilot'); if(!r.ok) throw Error('API unavailable'); const d=await r.json(); state.brief=d; state.mode='LIVE'; state.lastSync=new Date().toISOString(); state.error=null; return d;}
    catch(e){state.mode='UNAVAILABLE';state.error=e.message;return null;}
  }
  function loadDemo(){
    const signal={id:'DEMO-COPILOT-001',type:'route_deviation',severity:'HIGH',verified:false,demo:true};
    const result=ask('What should operations know?', [signal]);
    state.mode='DEMO'; state.brief={summary:'Demo mode: no live operational claims are being made.',recommendation:result.answer}; return state.brief;
  }
  function queueRecommendation(recommendation){state.queue.push({id:'REC-'+Date.now(),recommendation,createdAt:new Date().toISOString(),status:'AWAITING_AUTHORIZATION'});return state.queue[state.queue.length-1];}
  function clear(){state.brief=null;state.queue=[];state.audit=[];state.error=null;}
  window.SHELTON_FREIGHT_AI_COPILOT={state,sync,loadDemo,ask,explain,queueRecommendation,clear};
})();
