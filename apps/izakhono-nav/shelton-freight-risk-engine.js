(function(){
  'use strict';
  const VALID=['panic','hijack_suspected','unauthorized_stop','route_deviation','geofence_breach','vehicle_tamper','driver_distress','security_check','security_clearance','connectivity_loss','verified_hazard','journey_exception'];
  const SEV={INFO:10,WATCH:25,HIGH:60,CRITICAL:100};
  const out=[];
  function norm(e){
    if(!e||!VALID.includes(e.type)) return null;
    const severity=String(e.severity||'WATCH').toUpperCase();
    return {id:e.id||('RISK-'+Date.now()),type:e.type,severity:SEV[severity]?severity:'WATCH',score:SEV[severity]||25,verified:e.verified===true,source:e.source||'unknown',timestamp:e.timestamp||new Date().toISOString(),vehicle_id:e.vehicle_id||null,driver_id:e.driver_id||null,journey_id:e.journey_id||null,demo:e.demo===true};
  }
  function evaluate(events){
    const clean=(Array.isArray(events)?events:[]).map(norm).filter(Boolean);
    const verified=clean.filter(e=>e.verified && !e.demo);
    const unverified=clean.filter(e=>!e.verified || e.demo);
    let band='NORMAL', score=0, reasons=[];
    if(verified.length){
      score=Math.min(100,Math.max.apply(null,verified.map(e=>e.score)) + (verified.length>1?Math.min(25,(verified.length-1)*10):0));
      const types=new Set(verified.map(e=>e.type));
      if(verified.some(e=>e.severity==='CRITICAL')) {band='CRITICAL';reasons.push('verified critical signal');}
      else if(types.has('driver_distress') && (types.has('hijack_suspected')||types.has('vehicle_tamper'))) {band='CRITICAL';reasons.push('driver distress combined with security signal');}
      else if(types.has('security_check') && types.has('route_deviation')) {band='HIGH';reasons.push('security signal combined with route deviation');}
      else if(verified.some(e=>e.severity==='HIGH')) {band='HIGH';reasons.push('verified high-severity signal');}
      else if(verified.length>1) {band='ELEVATED';reasons.push('multiple verified signals');}
      else if(verified.some(e=>e.severity==='WATCH')) {band='WATCH';reasons.push('verified watch signal');}
    }
    if(!verified.length && unverified.length) {band='WATCH';reasons.push('unverified/demo signals require monitoring only');score=0;}
    let recommended='monitor';
    if(band==='WATCH') recommended='request_driver_check_in';
    if(band==='ELEVATED') recommended='acknowledge';
    if(band==='HIGH') recommended='escalate_to_fleet_security';
    if(band==='CRITICAL') recommended='request_authorized_assistance';
    return {band,score,reasons,verified_count:verified.length,unverified_count:unverified.length,recommended_action:recommended,decision_time:new Date().toISOString(),live_decisioning:false};
  }
  window.SHELTON_FREIGHT_RISK={evaluate,norm,valid_types:VALID};
})();
