(function(){
  'use strict';
  const KEY='shelton-freight-safety-autopilot-v2';
  const cfg={pollMs:10000,checkinTimeoutMs:120000,cooldownMs:180000};
  const state={mode:'UNAVAILABLE',running:false,vehicles:new Map(),outbox:[],audit:[],lastSignals:new Map(),lastAction:null,error:null};
  const now=()=>new Date().toISOString();
  const api=async(path,opts={})=>{const r=await fetch(path,{headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts});if(!r.ok)throw new Error('HTTP '+r.status);return r.json();};
  function mode(){
    const live=!!(window.SHELTON_FREIGHT_INTELLIGENCE||window.SHELTON_FREIGHT_RISK||window.SHELTON_FREIGHT_ORCHESTRATOR);
    state.mode=live?'LIVE':'UNAVAILABLE';
    if(window.SHELTON_FREIGHT_COMMAND?.state?.mode==='DEMO')state.mode='DEMO';
    return state.mode;
  }
  function fingerprint(s){return [s.vehicle_id||'',s.journey_id||'',s.type||s.signal||'',s.severity||''].join('|');}
  function cooldown(s){const k=fingerprint(s),last=state.lastSignals.get(k);if(!last)return false;return Date.now()-last<cfg.cooldownMs&&s.severity!=='CRITICAL';}
  function audit(s,action,workflow,reason){const e={timestamp:now(),vehicle_id:s.vehicle_id||null,journey_id:s.journey_id||null,signal:s.type||s.signal||'unknown',severity:s.severity||'UNKNOWN',workflow,action,operator:'SAFETY_AUTOPILOT',mode:state.mode,reason};state.audit.push(e);state.lastAction=e;return e;}
  function decide(s){
    if(!s||s.verified===false)return ['OBSERVE','unverified signal'];
    const sev=(s.severity||s.risk_band||'WATCH').toUpperCase();
    if(sev==='CRITICAL'||(s.driver_distress&&s.security))return ['ESCALATE','verified critical safety condition'];
    if(sev==='HIGH'||(s.route_deviation&&s.security))return ['TRIAGE','verified high-risk condition'];
    if(sev==='ELEVATED')return ['CHECK_IN','elevated verified risk'];
    if(s.driver_checkin_timeout)return ['CHECK_IN','driver check-in timeout'];
    if(s.multiple_verified_watch)return ['CHECK_IN','multiple verified watch signals'];
    if(s.connectivity_loss)return ['OBSERVE_AND_QUEUE','connectivity loss; preserve offline safety state'];
    return ['OBSERVE','no automatic escalation threshold met'];
  }
  async function act(s){
    mode();
    if(cooldown(s))return {ignored:true,reason:'cooldown'};
    const [workflow,reason]=decide(s), action=workflow==='ESCALATE'?'Escalate':workflow==='TRIAGE'?'Triage':workflow==='CHECK_IN'?'Driver Check-In':'Observe';
    const rec=audit(s,action,workflow,reason);state.lastSignals.set(fingerprint(s),Date.now());
    try{
      if(window.SHELTON_FREIGHT_ORCHESTRATOR?.act){await window.SHELTON_FREIGHT_ORCHESTRATOR.act(s,action);}
      else if(state.mode==='LIVE'){await api('/api/freight/events',{method:'POST',body:JSON.stringify({type:'safety_autopilot_action',...rec})});}
      else if(state.mode==='UNAVAILABLE')state.outbox.push(rec);
    }catch(e){state.outbox.push(rec);state.error=e.message;}
    persist();return rec;
  }
  async function poll(){
    try{
      mode();
      if(state.mode==='LIVE'){
        let data=null;
        try{data=await api('/api/freight/security/intelligence');}catch(_){try{data=await api('/api/freight/vehicles');}catch(__){data=null;}}
        if(Array.isArray(data?.signals))for(const s of data.signals)await act(s);
        if(Array.isArray(data?.vehicles))for(const v of data.vehicles){if(v.driver_checkin_timeout)await act({...v,type:'driver_checkin_timeout',severity:'HIGH',verified:true});}
      }
      persist();
    }catch(e){state.error=e.message;persist();}
  }
  function persist(){try{localStorage.setItem(KEY,JSON.stringify({mode:state.mode,running:state.running,outbox:state.outbox,audit:state.audit.slice(-100),lastAction:state.lastAction,error:state.error,lastSignals:[...state.lastSignals]}));}catch(_){} }
  function restore(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x){Object.assign(state,x);state.lastSignals=new Map(x.lastSignals||[]);state.vehicles=new Map();}}catch(_){} }
  function start(){if(state.running)return;state.running=true;mode();state.timer=setInterval(poll,cfg.pollMs);poll();persist();return snapshot();}
  function stop(){state.running=false;clearInterval(state.timer);persist();return snapshot();}
  async function flush(){if(!navigator.onLine)return {flushed:0,offline:true};let n=0;while(state.outbox.length){const e=state.outbox[0];try{if(window.SHELTON_FREIGHT_ORCHESTRATOR?.act)await window.SHELTON_FREIGHT_ORCHESTRATOR.act(e,e.action);else await api('/api/freight/events',{method:'POST',body:JSON.stringify(e)});state.outbox.shift();n++;}catch(_){break;}}persist();return {flushed:n,remaining:state.outbox.length};}
  function snapshot(){return {mode:state.mode,running:state.running,outbox:state.outbox.length,audit:state.audit.length,lastAction:state.lastAction,error:state.error};}
  window.SHELTON_FREIGHT_SAFETY_AUTOPILOT={start,stop,poll,act,flush,snapshot,config:cfg,state};
  restore();mode();window.addEventListener('online',flush);window.addEventListener('offline',persist);
})();