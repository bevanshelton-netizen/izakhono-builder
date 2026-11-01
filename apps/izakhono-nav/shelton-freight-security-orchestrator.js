(function(){
  'use strict';
  const API='/api/freight/events';
  const state={mode:'UNAVAILABLE',workflow:'OBSERVE',queue:[],audit:[],lastAction:null,error:null};
  const emit=()=>window.dispatchEvent(new CustomEvent('shelton-freight-orchestrator-state',{detail:{...state,queue:[...state.queue],audit:[...state.audit]}}));
  const id=()=> 'SFO-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
  function evaluate(signal){
    const s=signal||{}; const verified=s.verified===true&&!s.demo; const type=s.type||''; const severity=String(s.severity||'WATCH').toUpperCase();
    if(!verified) return {workflow:'OBSERVE',reason:'Signal is unverified or demo-only',approval:'none'};
    if(severity==='CRITICAL'||(type==='driver_distress'&&['hijack_suspected','vehicle_tamper'].includes(s.related_type))) return {workflow:'ESCALATE',reason:'Verified critical security condition',approval:'operator_or_authorized_policy'};
    if(severity==='HIGH') return {workflow:'TRIAGE',reason:'Verified high-severity condition',approval:'operator'};
    if(severity==='WATCH') return {workflow:'CHECK_IN',reason:'Verified watch condition',approval:'policy'};
    return {workflow:'OBSERVE',reason:'No escalation threshold met',approval:'none'};
  }
  async function act(signal,requested){
    const decision=evaluate(signal); let workflow=decision.workflow;
    if(requested && ['OBSERVE','CHECK_IN','TRIAGE','ESCALATE','HOLD_OPERATIONS','AUTHORIZED_ASSISTANCE','RESOLVE','CLOSED'].includes(requested)) workflow=requested;
    const action={action_id:id(),timestamp:new Date().toISOString(),vehicle_id:signal&&signal.vehicle_id||null,driver_id:signal&&signal.driver_id||null,journey_id:signal&&signal.journey_id||null,trigger:signal&&signal.type||'manual',decision:workflow,reason:decision.reason,approval:decision.approval};
    state.lastAction=action; state.workflow=workflow; state.audit.unshift(action); state.audit=state.audit.slice(0,100);
    try{ const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({type:'security_check',severity:signal&&signal.severity||'INFO',source:'shelton-freight-orchestrator',action})}); if(!r.ok) throw new Error('Security action API unavailable'); state.mode='LIVE'; state.error=null; }
    catch(e){ state.mode='UNAVAILABLE'; state.error=e.message; state.queue.push(action); state.queue=state.queue.slice(-100); }
    emit(); return {...action,mode:state.mode};
  }
  async function flush(){ if(!navigator.onLine||!state.queue.length)return false; const pending=[...state.queue]; for(const action of pending){ try{const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'security_check',severity:'INFO',source:'shelton-freight-orchestrator-outbox',action})}); if(!r.ok)throw new Error(); state.queue=state.queue.filter(x=>x.action_id!==action.action_id); }catch(e){break;} } emit(); return state.queue.length===0; }
  function clear(){state.workflow='CLOSED';state.lastAction=null;emit();}
  window.SHELTON_FREIGHT_ORCHESTRATOR={state,evaluate,act,flush,clear};
  window.addEventListener('online',flush);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',emit);else emit();
})();
