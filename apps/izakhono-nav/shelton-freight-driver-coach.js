(function(){
  'use strict';
  const KEY='shelton-freight-driver-coach';
  const state={mode:'UNAVAILABLE',level:'CLEAR',signals:[],coaching:[],outbox:[],audit:[],lastEvaluation:null};
  const cfg={cooldownMs:60000,maxOutbox:100};
  const now=()=>new Date().toISOString();
  function mode(){
    if(window.SHELTON_FREIGHT_COMMAND?.state?.mode)return String(window.SHELTON_FREIGHT_COMMAND.state.mode).toUpperCase();
    if(navigator.onLine===false)return 'OFFLINE';
    return 'DEMO';
  }
  function verified(s){return s && s.verified===true;}
  function levelFor(signals){
    if(signals.some(s=>verified(s)&&(s.type==='driver_distress'||s.type==='hijack_suspected')))return 'SAFETY_HOLD_RECOMMENDED';
    if(signals.some(s=>verified(s)&&(s.type==='verified_hazard'||s.type==='fatigue_checkin_missed'||s.type==='unauthorized_stop'||s.type==='vehicle_health_warning')))return 'CAUTION';
    if(signals.some(s=>verified(s)))return 'ADVISORY';
    return signals.length?'ADVISORY':'CLEAR';
  }
  function advice(s){
    const map={verified_hazard:'Reduce exposure and follow the safest verified corridor available.',fatigue_checkin_missed:'Driver check-in is overdue. Request a safety check-in before continuing.',route_deviation:'Confirm the intended route and assess the deviation before continuing.',unauthorized_stop:'Confirm driver and vehicle status and move to a safe authorized location when appropriate.',connectivity_loss:'Connectivity is unavailable. Continue only within the approved offline operating posture.',vehicle_health_warning:'Review vehicle condition and consider a safe inspection or stop.',driver_distress:'Driver distress detected. Follow the authenticated security response workflow.',hijack_suspected:'Hijack indicator detected. Follow the authenticated security response workflow.'};
    return map[s.type]||'Review the current safety posture before continuing.';
  }
  function evaluate(signals){
    signals=Array.isArray(signals)?signals.filter(Boolean):[];
    state.mode=mode(); state.signals=signals; state.level=levelFor(signals); state.coaching=signals.map(s=>({type:s.type,level:state.level,message:advice(s),at:now()})); state.lastEvaluation=now();
    state.audit.push({at:now(),event:'EVALUATED',level:state.level,verified:signals.filter(verified).length,mode:state.mode});
    if(state.audit.length>200)state.audit.shift();
    persist(); return snapshot();
  }
  function requestCheckin(reason){
    const action={id:'coach_'+Date.now(),type:'driver_checkin_request',reason:reason||'safety_coaching',created_at:now(),mode:state.mode};
    if(window.SHELTON_FREIGHT_ORCHESTRATOR?.act){try{window.SHELTON_FREIGHT_ORCHESTRATOR.act({verified:true,severity:'WATCH',type:'driver_checkin_request'},'CHECK_IN');}catch(e){}}
    queue(action); return action;
  }
  function queue(action){
    state.outbox.push(action); if(state.outbox.length>cfg.maxOutbox)state.outbox.shift(); state.audit.push({at:now(),event:'QUEUED',action}); persist();
  }
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}
  function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x)Object.assign(state,x);}catch(e){}state.mode=mode();}
  function snapshot(){return JSON.parse(JSON.stringify(state));}
  function start(intervalMs=15000){
    load(); stop(); state.timer=setInterval(()=>{state.mode=mode();persist();},Math.max(5000,intervalMs)); return snapshot();
  }
  function stop(){if(state.timer){clearInterval(state.timer);state.timer=null;}}
  load();
  window.SHELTON_FREIGHT_DRIVER_COACH={state,snapshot,evaluate,requestCheckin,start,stop};
})();