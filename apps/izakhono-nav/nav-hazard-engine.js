(function(){
  const VALID_TYPES=new Set(['flooding','pothole','road_closure','collision','crime_hotspot','civil_disruption','poor_lighting','weather_visibility','animal_crossing','road_surface']);
  const WEIGHTS={travel_time:0.30,distance:0.15,road_class:0.20,verified_hazards:0.25,connectivity_resilience:0.10};
  const STALE_HOURS=24, DEFAULT_FEED='/api/nav/hazards';
  if(!window.IZAKHONO_HAZARD_FEED) window.IZAKHONO_HAZARD_FEED=DEFAULT_FEED;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function fresh(ts,now){const t=Date.parse(ts);return Number.isFinite(t)&&now-t<=STALE_HOURS*3600000&&now>=t;}
  function parseHazards(payload,now=Date.now()){
    const rows=Array.isArray(payload)?payload:(payload&&Array.isArray(payload.records)?payload.records:[]),accepted=[],rejected=[];
    rows.forEach(h=>{const ok=h&&h.id&&VALID_TYPES.has(h.type)&&Number.isFinite(+h.lat)&&Number.isFinite(+h.lon)&&Number.isFinite(+h.severity)&&h.source&&h.timestamp&&fresh(h.timestamp,now);if(ok)accepted.push({...h,lat:+h.lat,lon:+h.lon,severity:clamp(+h.severity,0,100)});else rejected.push(h&&h.id||'unknown');});
    return {accepted,rejected,staleAfterHours:STALE_HOURS};
  }
  function pointSegmentKm(p,a,b){const lat=p[1]*Math.PI/180,kx=111.32*Math.cos(lat),ky=110.57,px=p[0]*kx,py=p[1]*ky,ax=a[0]*kx,ay=a[1]*ky,bx=b[0]*kx,by=b[1]*ky,dx=bx-ax,dy=by-ay,t=clamp(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));}
  function routeHazards(route,hazards){const c=route&&route.geometry&&route.geometry.coordinates||[];if(c.length<2)return[];return hazards.filter(h=>{const p=[h.lon,h.lat],radius=Math.max(.25,Math.min(3,.75+h.severity/80));for(let i=1;i<c.length;i++)if(pointSegmentKm(p,c[i-1],c[i])<=radius)return true;return false;});}
  function riskBand(score){return score<25?'LOW RISK':score<50?'GUARDED':score<75?'ELEVATED':'HIGH RISK';}
  function scoreRoute(route,hazards,context={}){
    const hits=routeHazards(route,hazards), hazardScore=clamp(hits.reduce((s,h)=>s+h.severity*(h.type==='road_closure'?1.5:(h.type==='crime_hotspot'||h.type==='civil_disruption'?1.25:1)),0),0,100);
    const durationNorm=context.maxDuration?clamp((route.duration||0)/context.maxDuration,0,1):0;
    const distanceNorm=context.maxDistance?clamp((route.distance||0)/context.maxDistance,0,1):0;
    const roadRisk=route.road_class_risk==null?50:clamp(+route.road_class_risk,0,100);
    const connectivity=route.connectivity_risk==null?50:clamp(+route.connectivity_risk,0,100);
    const score=Math.round(WEIGHTS.travel_time*durationNorm*100+WEIGHTS.distance*distanceNorm*100+WEIGHTS.road_class*roadRisk+WEIGHTS.verified_hazards*hazardScore+WEIGHTS.connectivity_resilience*connectivity);
    return {score,band:riskBand(score),verifiedHazards:hits.length,hazards:hits.map(h=>({id:h.id,type:h.type,severity:h.severity,source:h.source,timestamp:h.timestamp})),provisional:hazards.length===0,confidence:hazards.length?'verified-hazard-inputs':'no-verified-hazard-data'};
  }
  function rankRoutes(routes,hazards){
    if(!Array.isArray(routes)||!routes.length)return[];
    const maxDuration=Math.max(...routes.map(r=>r.duration||0),1),maxDistance=Math.max(...routes.map(r=>r.distance||0),1);
    return routes.map(r=>({...r,_nav:scoreRoute(r,hazards,{maxDuration,maxDistance})})).sort((a,b)=>a._nav.score-b._nav.score);
  }
  async function verifiedFeed(){
    const endpoint=window.IZAKHONO_HAZARD_FEED||DEFAULT_FEED;
    if(!endpoint)return [];
    try{const r=await originalFetch(endpoint,{headers:{Accept:'application/json'},cache:'no-store'});if(!r.ok)return[];const text=await r.text();if(text.length>500000)return[];return parseHazards(JSON.parse(text)).accepted;}catch(e){return[];}
  }
  const originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const response=await originalFetch(input,init);
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!/router\.project-osrm\.org\/route\/v1\/driving\//.test(url))return response;
    try{
      const payload=await response.clone().json();
      if(!Array.isArray(payload.routes)||payload.routes.length<2)return response;
      const hazards=await verifiedFeed();
      const ranked=rankRoutes(payload.routes,hazards);
      const body=JSON.stringify({...payload,routes:ranked});
      return new Response(body,{status:response.status,statusText:response.statusText,headers:{'Content-Type':'application/json'}});
    }catch(e){return response;}
  };
  window.IZAKHONONavHazards={VALID_TYPES,WEIGHTS,STALE_HOURS,DEFAULT_FEED,parseHazards,routeHazards,scoreRoute,rankRoutes,riskBand,verifiedFeed};
})();
