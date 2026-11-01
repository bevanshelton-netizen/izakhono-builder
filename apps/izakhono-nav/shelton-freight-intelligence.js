/* SHELTON FREIGHT Fleet Intelligence
 * API/data-first. Never fabricates live location, ETA, hazards or behaviour.
 */
(function(){
  'use strict';
  const API='/api/freight';
  const DEMO=false;
  const state={mode:'UNKNOWN',vehicles:[],journeys:[],events:[],metrics:{},lastUpdated:null,error:null};

  const num=(v)=>Number.isFinite(Number(v))?Number(v):null;
  function journeyMetrics(journeys,events){
    const total=journeys.length;
    const active=journeys.filter(j=>['departed','en_route','paused','exception'].includes(j.status)).length;
    const completed=journeys.filter(j=>['arrived','delivered','closed'].includes(j.status)).length;
    const exceptions=events.filter(e=>['delay','breakdown','security','safety','connectivity'].includes(e.type)).length;
    const safety=events.filter(e=>e.type==='safety').length;
    const delivery=journeys.filter(j=>j.status==='delivered'||j.delivery_confirmed===true).length;
    const onTime=journeys.filter(j=>j.on_time===true).length;
    return {total,active,completed,exceptions,safety,delivery,onTime,onTimeRate:total?Math.round(onTime/total*100):null};
  }
  function geofence(j,lat,lon){
    if(!j||!Number.isFinite(lat)||!Number.isFinite(lon)) return {status:'UNAVAILABLE'};
    const g=j.geofences||{};
    const points=[['origin',g.origin],['delivery',g.delivery]].filter(x=>x[1]&&Number.isFinite(Number(x[1].lat))&&Number.isFinite(Number(x[1].lon)));
    const hav=(a,b,c,d)=>{const r=Math.PI/180,x=(c-a)*r,y=(d-b)*r;const q=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 6371000*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));};
    const hits=points.map(p=>({name:p[0],distance_m:Math.round(hav(lat,lon,Number(p[1].lat),Number(p[1].lon)))})).filter(p=>p.distance_m<=Number((g.radius_m||250)));
    return {status:hits.length?'INSIDE':'OUTSIDE',zones:hits};
  }
  async function get(path){const r=await fetch(API+path,{cache:'no-store',headers:{accept:'application/json'}});if(!r.ok)throw new Error(path+' '+r.status);return r.json();}
  async function sync(){
    try{
      const [v,j,e]=await Promise.all([get('/vehicles'),get('/journeys'),get('/events')]);
      state.mode='LIVE';state.vehicles=v.items||v.vehicles||[];state.journeys=j.items||j.journeys||[];state.events=e.items||e.events||[];state.error=null;state.lastUpdated=new Date().toISOString();
    }catch(err){
      state.mode=DEMO?'DEMO':'UNAVAILABLE';state.error=String(err.message||err);state.vehicles=[];state.journeys=[];state.events=[];state.lastUpdated=new Date().toISOString();
    }
    state.metrics=journeyMetrics(state.journeys,state.events);
    window.dispatchEvent(new CustomEvent('shelton-freight-intelligence',{detail:state}));
    return state;
  }
  function snapshot(){return {mode:state.mode,metrics:state.metrics,lastUpdated:state.lastUpdated,error:state.error};}
  window.SHELTON_FREIGHT_INTELLIGENCE={state,sync,journeyMetrics,geofence,snapshot};
  sync();
})();
