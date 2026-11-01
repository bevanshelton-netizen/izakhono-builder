(() => {
  const state={mode:'UNAVAILABLE',vehicles:{},journeys:{},outbox:[],audit:[],lastSync:null,error:null};
  const api='/api/freight/fuel-efficiency';
  const now=()=>new Date().toISOString();
  const verified=s=>s && s.verified===true && s.demo!==true;
  function evaluateVehicle(vehicleId, signals={}) {
    const fuel=Number(signals.fuelUsed), distance=Number(signals.distance);
    const hasCore=verified(signals) && Number.isFinite(fuel) && Number.isFinite(distance) && distance>0;
    if(!hasCore) return {vehicleId,band:'UNAVAILABLE',score:null,reason:'Insufficient verified fuel/distance data',evaluatedAt:now()};
    const efficiency=fuel/distance;
    const idle=Number.isFinite(Number(signals.idleMinutes))?Number(signals.idleMinutes):null;
    const score=Math.max(0,Math.min(100,100-(efficiency*10)-(idle===null?0:idle*0.05)));
    const band=score>=85?'EXCELLENT':score>=70?'EFFICIENT':score>=50?'WATCH':'REVIEW';
    return {vehicleId,band,score:Number(score.toFixed(1)),fuelUsed:fuel,distance,efficiency:Number(efficiency.toFixed(4)),idleMinutes:idle,evaluatedAt:now(),reason:band==='REVIEW'?'Verified efficiency requires operational review':'Verified efficiency within current operating band'};
  }
  async function sync(){state.error=null;try{const r=await fetch(api);if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();state.vehicles=data.vehicles||{};state.journeys=data.journeys||{};state.mode='LIVE';state.lastSync=now();return data;}catch(e){state.error=e.message;state.mode='UNAVAILABLE';return null;}}
  function queue(event){state.outbox.push({...event,queuedAt:now()});localStorage.setItem('sheltonFreightFuelOutbox',JSON.stringify(state.outbox));}
  async function flush(){if(!navigator.onLine)return;while(state.outbox.length){const event=state.outbox[0];try{const r=await fetch(api+'/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)});if(!r.ok)throw new Error(`HTTP ${r.status}`);state.outbox.shift();}catch(e){state.error=e.message;break;}}localStorage.setItem('sheltonFreightFuelOutbox',JSON.stringify(state.outbox));}
  function record(event){const item={...event,recordedAt:now()};state.audit.push(item);queue(item);return item;}
  function loadDemo(){state.mode='DEMO';state.vehicles={SF001:{vehicleId:'SF001',band:'EFFICIENT',score:78.4}};state.journeys={DEMO001:{distance:412,fuelUsed:138,verified:false,demo:true}};return state;}
  try{state.outbox=JSON.parse(localStorage.getItem('sheltonFreightFuelOutbox')||'[]');}catch{}
  window.SHELTON_FREIGHT_FUEL={state,evaluateVehicle,sync,loadDemo,record,flush,queue};
  window.addEventListener('online',flush);
})();