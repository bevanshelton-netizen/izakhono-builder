(function(){
'use strict';
const KEY='shelton-freight-safety-autopilot-v1';
const state={mode:'UNAVAILABLE',posture:'UNKNOWN_NOT_CLEAR',score:0,signals:[],actions:[],history:[],lastEvaluation:null,error:null};
const emit=()=>window.dispatchEvent(new CustomEvent('shelton-freight-safety-autopilot-state',{detail:JSON.parse(JSON.stringify(state))}));
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state.history.slice(-100)))}catch(e){}};
const load=()=>{try{state.history=JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){state.history=[]}};
function verified(s){return s && s.verified===true && s.demo!==true;}
function evaluate(input){
 const signals=Array.isArray(input)?input:(input&&input.signals)||[];
 const v=signals.filter(verified), unv=signals.filter(s=>!verified(s));
 let score=0, posture='NORMAL';
 const types=v.map(s=>s.type);
 if(types.includes('driver_distress') && (types.includes('hijack_suspected')||types.includes('vehicle_tamper'))) {score=100;posture='CRITICAL'}
 else if(types.includes('hijack_suspected')||types.includes('vehicle_tamper')) {score=85;posture='HIGH'}
 else if(types.includes('route_deviation')&&types.includes('geofence_breach')) {score=70;posture='ELEVATED'}
 else if(types.includes('unauthorized_stop')||types.includes('driver_distress')) {score=60;posture='ELEVATED'}
 else if(types.includes('verified_hazard')||types.includes('connectivity_loss')) {score=35;posture='WATCH'}
 if(!signals.length) posture='UNKNOWN_NOT_CLEAR';
 const actions=[];
 if(posture==='CRITICAL'||posture==='HIGH') actions.push('open_or_update_incident','escalate_to_fleet_security');
 else if(posture==='ELEVATED') actions.push('open_or_update_incident','request_driver_check_in');
 else if(posture==='WATCH') actions.push('monitor');
 else if(posture==='UNKNOWN_NOT_CLEAR') actions.push('queue_for_reconnect');
 const result={posture,score,verified_count:v.length,unverified_count:unv.length,signals,actions,timestamp:new Date().toISOString()};
 state.posture=posture;state.score=score;state.signals=signals;state.actions=actions;state.lastEvaluation=result;state.error=null;
 state.history.push(result);save();emit();return result;
}
function ingest(source){
 try{
  if(source && source.signals) return evaluate(source.signals);
  if(window.SHELTON_FREIGHT_RISK&&typeof window.SHELTON_FREIGHT_RISK.evaluate==='function') return evaluate([{type:'risk_engine_signal',verified:true,source:'risk_engine',risk:window.SHELTON_FREIGHT_RISK.evaluate(source||{})}]);
  return evaluate([]);
 }catch(e){state.error=e.message;emit();return null}
}
load();
window.SHELTON_FREIGHT_SAFETY_AUTOPILOT={state,evaluate,ingest,history:()=>state.history.slice(),emit};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',emit);else emit();
})();