(function(){
'use strict';
const STORE='shelton-freight-security-ops-v1';
const STATES=['NEW','TRIAGED','ACKNOWLEDGED','ESCALATED','RESPONDING','RESOLVED','CLOSED'];
const BAND_ORDER={CRITICAL:5,HIGH:4,ELEVATED:3,WATCH:2,NORMAL:1,UNKNOWN_NOT_CLEAR:0};
const POSTURE={NORMAL:'NORMAL_OPERATIONS',WATCH:'ENHANCED_MONITORING',ELEVATED:'DRIVER_CHECK_IN',HIGH:'FLEET_SECURITY_REVIEW',CRITICAL:'CRITICAL_SECURITY_RESPONSE',UNKNOWN_NOT_CLEAR:'UNKNOWN_NOT_CLEAR'};
const now=()=>new Date().toISOString();
function load(){try{return JSON.parse(localStorage.getItem(STORE)||'{"audit":[],"selection":null}')}catch{return{audit:[],selection:null}}}
function save(x){try{localStorage.setItem(STORE,JSON.stringify(x))}catch{}}
function emit(){window.dispatchEvent(new CustomEvent('shelton-freight-security-operations',{detail:state}))}
function collect(){
 const si=window.SHELTON_FREIGHT_SECURITY_INTELLIGENCE?.state||{};
 const fortress=window.SHELTON_FREIGHT_FORTRESS?.state||{};
 const incidents=window.SHELTON_FREIGHT_INCIDENTS?.current?.()||[];
 const command=window.SHELTON_FREIGHT_COMMAND?.state||{};
 return {si,fortress,incidents,command};
}
function normalizeIncident(i){return {id:i.incident_id||i.event_id||i.id||null,type:i.event_class||i.type||i.event_type||'security',severity:String(i.severity||'WATCH').toUpperCase(),state:i.state||i.status||'NEW',vehicle_id:i.vehicle_id||null,driver_id:i.driver_id||null,journey_id:i.journey_id||null,verified:i.verified===true&&!i.demo,timestamp:i.updated_at||i.timestamp||i.created_at||null,source:i.source||'unknown'};}
function build(){
 const d=collect(); const profiles=[...(d.si.vehicles||[]),...(d.si.drivers||[]),...(d.si.journeys||[])];
 const incidents=d.incidents.map(normalizeIncident);
 if(d.fortress.lastEvent){const f=normalizeIncident(d.fortress.lastEvent);if(!incidents.some(x=>x.id&&x.id===f.id))incidents.push(f)}
 incidents.sort((a,b)=>(BAND_ORDER[b.severity]||0)-(BAND_ORDER[a.severity]||0));
 const priority=incidents.filter(i=>i.state!=='CLOSED').sort((a,b)=>(BAND_ORDER[b.severity]||0)-(BAND_ORDER[a.severity]||0));
 const top=profiles[0]||{}; const band=top.band||'UNKNOWN_NOT_CLEAR';
 return {mode:d.si.mode||d.fortress.mode||'UNAVAILABLE',generated_at:now(),posture:POSTURE[band]||'UNKNOWN_NOT_CLEAR',band,score:Number(top.score)||0,profiles,incidents,priority,source_status:d.si.sources||{},audit:load().audit.slice(-50),selected:load().selection||null};
}
let state=build();
function refresh(){state=build();emit();return state}
function select(id){state.selected=id;const s=load();s.selection=id;save(s);emit();return state}
function audit(action,target,detail){const s=load();s.audit=(s.audit||[]).concat({audit_id:'AUD-'+Date.now(),timestamp:now(),action,target:target||null,detail:detail||'',mode:state.mode}).slice(-50);save(s);state.audit=s.audit;emit();return s.audit.at(-1)}
async function operatorAction(action,incident){
 const allowed=['triage','acknowledge','escalate','request_driver_check_in','resolve','close'];if(!allowed.includes(action))throw Error('Unsupported operator action');
 const target=incident?.id||state.selected; audit(action,target,'Operator action recorded by Security Operations Centre');
 if(incident&&window.SHELTON_FREIGHT_INCIDENTS?.transition){const next={triage:'TRIAGED',acknowledge:'ACKNOWLEDGED',escalate:'ESCALATED',resolve:'RESOLVED',close:'CLOSED'}[action];if(next)await window.SHELTON_FREIGHT_INCIDENTS.transition(target,next)}
 if(action==='request_driver_check_in'&&window.SHELTON_FREIGHT_FORTRESS?.record){await window.SHELTON_FREIGHT_FORTRESS.record({event_type:'security_check',severity:'WATCH',vehicle_id:incident?.vehicle_id||null,driver_id:incident?.driver_id||null,journey_id:incident?.journey_id||null,source:'security_operations',demo:false})}
 refresh();return state;
}
window.SHELTON_FREIGHT_SECURITY_OPERATIONS={state,refresh,select,audit,operatorAction,states:STATES,postures:POSTURE};
window.addEventListener('shelton-freight-security-intelligence',refresh);
window.addEventListener('shelton-freight-security-state',refresh);
window.addEventListener('shelton-freight-incidents',refresh);
refresh();
})();
