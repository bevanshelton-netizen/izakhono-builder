(function(){
  'use strict';
  const STORE='shelton-freight-security-intelligence-v1';
  const BANDS=['NORMAL','WATCH','ELEVATED','HIGH','CRITICAL','UNKNOWN_NOT_CLEAR'];
  const POSTURES=['NORMAL_OPERATIONS','ENHANCED_MONITORING','DRIVER_CHECK_IN','FLEET_SECURITY_REVIEW','HOLD_OPERATIONS_PENDING_REVIEW','CRITICAL_SECURITY_RESPONSE','UNKNOWN_NOT_CLEAR'];
  const valid=v=>v!==null&&typeof v==='object';
  const now=()=>new Date().toISOString();
  function load(){try{return JSON.parse(localStorage.getItem(STORE)||'{"history":[]}')}catch(e){return {history:[]}}}
  function save(s){try{localStorage.setItem(STORE,JSON.stringify(s))}catch(e){}}
  function riskBand(v){return BANDS.includes(v)?v:'UNKNOWN_NOT_CLEAR'}
  function posture(b){return ({NORMAL:'NORMAL_OPERATIONS',WATCH:'ENHANCED_MONITORING',ELEVATED:'DRIVER_CHECK_IN',HIGH:'FLEET_SECURITY_REVIEW',CRITICAL:'CRITICAL_SECURITY_RESPONSE',UNKNOWN_NOT_CLEAR:'UNKNOWN_NOT_CLEAR'})[b]}
  function collect(){
    const risk=window.SHELTON_FREIGHT_RISK;
    const fortress=window.SHELTON_FREIGHT_FORTRESS;
    const intelligence=window.SHELTON_FREIGHT_INTELLIGENCE;
    const command=window.SHELTON_FREIGHT_COMMAND;
    const sources={risk:!!risk,fortress:!!fortress,intelligence:!!intelligence,command:!!command};
    let events=[];
    if(risk&&Array.isArray(risk.state?.signals)) events=events.concat(risk.state.signals);
    if(fortress&&fortress.state?.lastEvent) events.push(fortress.state.lastEvent);
    const vehicles=(command&&Array.isArray(command.state?.vehicles))?command.state.vehicles:[];
    const journeys=(command&&Array.isArray(command.state?.journeys))?command.state.journeys:[];
    return {sources,events,vehicles,journeys,mode:(risk?.state?.mode||fortress?.state?.mode||'UNAVAILABLE')};
  }
  function profile(entity,events){
    const related=events.filter(e=>!entity.id || e.vehicle_id===entity.id || e.driver_id===entity.id || e.journey_id===entity.id);
    const verified=related.filter(e=>e.verified===true && e.demo!==true);
    const unverified=related.filter(e=>e.verified!==true || e.demo===true);
    let band='UNKNOWN_NOT_CLEAR',score=0;
    if(verified.length){
      const evaluated=window.SHELTON_FREIGHT_RISK?.evaluate ? window.SHELTON_FREIGHT_RISK.evaluate(verified) : null;
      if(evaluated){band=riskBand(evaluated.band);score=Number(evaluated.score)||0}
      else {band='WATCH';score=10}
    } else if(unverified.length) {band='WATCH';score=0}
    const contributors=related.slice(-8).map(e=>({type:e.type||e.event_type||'signal',severity:e.severity||'INFO',verified:e.verified===true&&!e.demo,timestamp:e.timestamp||e.created_at||null}));
    return {id:entity.id||null,name:entity.name||entity.display_name||entity.registration||entity.vehicle_id||entity.driver_id||entity.journey_id||'Unknown',band,score,posture:posture(band),verifiedSignals:verified.length,unverifiedSignals:unverified.length,contributors,mode:verified.length?'LIVE':(unverified.length?'DEMO':'UNAVAILABLE')};
  }
  function build(){
    const d=collect();
    const vehicles=d.vehicles.map(v=>profile({id:v.vehicle_id||v.id,name:v.registration||v.vehicle_id},d.events));
    const journeys=d.journeys.map(j=>profile({id:j.journey_id||j.id,name:j.reference||j.journey_id},d.events));
    const driverIds=[...new Set(d.events.map(e=>e.driver_id).filter(Boolean))];
    const drivers=driverIds.map(id=>profile({id,name:id},d.events));
    const all=vehicles.concat(drivers,journeys).filter(Boolean);
    const order={CRITICAL:5,HIGH:4,ELEVATED:3,WATCH:2,NORMAL:1,UNKNOWN_NOT_CLEAR:0};
    all.sort((a,b)=>(order[b.band]-order[a.band])||(b.score-a.score));
    const fleet=all.length?all[0]:{band:'UNKNOWN_NOT_CLEAR',score:0,posture:'UNKNOWN_NOT_CLEAR'};
    return {mode:d.mode,generated_at:now(),fleet_posture:fleet.posture,fleet_band:fleet.band,top_score:fleet.score,vehicles,drivers,journeys,sources:d.sources,history:load().history.slice(-24)};
  }
  function refresh(){const result=build();const s=load();s.history=(s.history||[]).concat({timestamp:result.generated_at,band:result.fleet_band,score:result.top_score,posture:result.fleet_posture,mode:result.mode}).slice(-24);save(s);state=result;window.dispatchEvent(new CustomEvent('shelton-freight-security-intelligence',{detail:result}));return result}
  let state=build();
  window.SHELTON_FREIGHT_SECURITY_INTELLIGENCE={state,refresh,profile,posture,bands:BANDS,postures:POSTURES};
  refresh();
})();