/* SHELTON FREIGHT COMMAND — runtime orchestration layer
 * Safe-by-default: backend is authoritative; demo data is explicitly labelled.
 */
(function(){
  'use strict';
  const API='/api/freight';
  const DEMO='/apps/izakhono-nav/shelton-freight-demo-data.json';
  const state={mode:'DEMO',vehicles:[],journeys:[],events:[],lastSync:null,error:null};
  async function get(path){
    const r=await fetch(API+path,{credentials:'include',headers:{Accept:'application/json'},cache:'no-store'});
    if(!r.ok) throw new Error('API '+r.status);
    return r.json();
  }
  async function demo(){
    const r=await fetch(DEMO,{cache:'no-store'});
    if(!r.ok) throw new Error('Demo data unavailable');
    return r.json();
  }
  function normalize(x){return {vehicles:Array.isArray(x.vehicles)?x.vehicles:[],journeys:Array.isArray(x.journeys)?x.journeys:[],events:Array.isArray(x.events)?x.events:[]};}
  async function sync(){
    state.error=null;
    try{
      const [vehicles,journeys,events]=await Promise.all([get('/vehicles'),get('/journeys'),get('/events')]);
      Object.assign(state,normalize({vehicles:vehicles.vehicles||vehicles,journeys:journeys.journeys||journeys,events:events.events||events}),{mode:'LIVE',lastSync:new Date().toISOString()});
    }catch(e){
      try{Object.assign(state,normalize(await demo()),{mode:'DEMO',lastSync:new Date().toISOString(),error:e.message});}
      catch(d){state.error=d.message;}
    }
    document.dispatchEvent(new CustomEvent('shelton-freight-data',{detail:JSON.parse(JSON.stringify(state))}));
    return state;
  }
  window.SHELTON_FREIGHT_COMMAND={state,sync,api:API};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',sync); else sync();
})();
