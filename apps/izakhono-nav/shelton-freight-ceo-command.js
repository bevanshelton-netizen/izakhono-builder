/* SHELTON FREIGHT CEO Command Centre v0.1 */
(function(){
  const KEY='shelton-freight-ceo-command';
  const API='/api/freight/ceo-command';
  const EVENTS='/api/freight/ceo-command/events';
  const state={mode:'UNAVAILABLE',snapshot:null,outbox:[],audit:[],lastSync:null,error:null};
  function verified(x){return x && x.verified===true && x.demo!==true;}
  function posture(signals=[]){
    const v=signals.filter(verified);
    if(v.some(x=>x.severity==='CRITICAL')) return 'CRITICAL';
    if(v.some(x=>x.severity==='HIGH')) return 'HIGH';
    if(v.some(x=>x.severity==='WATCH')) return 'WATCH';
    return v.length?'NORMAL':'UNAVAILABLE';
  }
  function buildSnapshot(input){
    const data=input||{};
    const security=data.security_signals||[];
    const priority=posture(security);
    return {mode:state.mode,priority,metrics:data.metrics||{},fleet:data.fleet||{},journeys:data.journeys||{},customers:data.customers||{},finance:data.finance||{},network:data.network||{},maintenance:data.maintenance||{},actions:data.actions||[],evaluatedAt:new Date().toISOString()};
  }
  async function sync(){
    try{const r=await fetch(API,{headers:{accept:'application/json'}});if(!r.ok)throw new Error('CEO command feed unavailable');const data=await r.json();state.mode='LIVE';state.snapshot=buildSnapshot(data);state.lastSync=new Date().toISOString();state.error=null;return state.snapshot;}
    catch(e){state.mode='UNAVAILABLE';state.error=e.message;return null;}
  }
  function queue(action){state.outbox.push({...action,queuedAt:new Date().toISOString()});persist();return state.outbox.length;}
  async function act(action){
    const record={...action,actionId:'CEO-'+Date.now(),createdAt:new Date().toISOString()};state.audit.push(record);
    try{const r=await fetch(EVENTS,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(record)});if(!r.ok)throw new Error('event feed unavailable');return record;}
    catch(e){queue(record);state.error=e.message;return record;}
  }
  async function flush(){const pending=[...state.outbox];state.outbox=[];for(const x of pending){try{const r=await fetch(EVENTS,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(x)});if(!r.ok)throw new Error('flush failed');}catch(e){state.outbox.push(x);}}persist();return state.outbox.length;}
  function persist(){try{localStorage.setItem(KEY,JSON.stringify({outbox:state.outbox,audit:state.audit.slice(-200)}));}catch(e){}}
  function loadDemo(){state.mode='DEMO';state.snapshot=buildSnapshot({metrics:{fleetReadiness:'DEMO',activeJourneys:'DEMO',securityRisk:'DEMO',deliveryReliability:'DEMO',customerHealth:'DEMO',revenueStatus:'DEMO',profitabilityStatus:'DEMO',maintenanceExposure:'DEMO',corridorPosture:'DEMO',connectivityResilience:'DEMO'},security_signals:[{severity:'WATCH',verified:false,demo:true}],fleet:{status:'DEMO'},journeys:{status:'DEMO'},customers:{status:'DEMO'},finance:{status:'DEMO'},network:{status:'DEMO'},maintenance:{status:'DEMO'}});return state.snapshot;}
  function getState(){return JSON.parse(JSON.stringify(state));}
  window.SHELTON_FREIGHT_CEO={state,getState,sync,buildSnapshot,queue,act,flush,loadDemo};
})();