(() => {
  const API='/api/freight/customer-service';
  const EVENTS='/api/freight/customer-service/events';
  const state={mode:'UNAVAILABLE',cases:[],outbox:[],audit:[],lastSync:null,error:null};
  const verified=v=>v===true;
  function band(c){
    if(!c) return 'UNAVAILABLE';
    if(c.verifiedSecurity||c.verifiedCargoException) return 'ESCALATED';
    if(c.verifiedDeliveryBreach||c.actionRequired) return 'WATCH';
    return 'STABLE';
  }
  function evaluate(input={}){
    const c={...input,serviceBand:band(input)};
    if(!input.customerId||!input.shipmentId) c.serviceBand='UNAVAILABLE';
    if(input.verified===false) c.serviceBand='UNAVAILABLE';
    return c;
  }
  async function sync(){
    try{const r=await fetch(API,{headers:{Accept:'application/json'}});if(!r.ok)throw Error(`HTTP ${r.status}`);const data=await r.json();state.cases=Array.isArray(data.cases)?data.cases.map(evaluate):[];state.mode='LIVE';state.lastSync=new Date().toISOString();state.error=null;return state.cases}catch(e){state.mode='UNAVAILABLE';state.error=e.message;return []}
  }
  function queue(event){state.outbox.push({...event,queuedAt:new Date().toISOString()});return state.outbox.length}
  async function createCase(input){const item=evaluate(input);item.createdAt=item.createdAt||new Date().toISOString();state.cases.unshift(item);state.audit.push({action:'CASE_CREATED',shipmentId:item.shipmentId,at:item.createdAt});try{const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});if(!r.ok)throw Error(`HTTP ${r.status}`);state.mode='LIVE';return item}catch(e){queue(item);state.mode='UNAVAILABLE';state.error=e.message;return item}}
  async function flush(){if(!navigator.onLine)return 0;let sent=0;while(state.outbox.length){const item=state.outbox[0];try{const r=await fetch(EVENTS,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});if(!r.ok)throw Error();state.outbox.shift();sent++}catch(e){break}}return sent}
  function loadDemo(){state.mode='DEMO';state.cases=[evaluate({customerId:'DEMO-CUST-01',shipmentId:'DEMO-SHIP-01',journeyId:'DEMO-JRN-01',verified:true,verifiedDeliveryBreach:true,actionRequired:true,caseType:'late_delivery'}),evaluate({customerId:'DEMO-CUST-02',shipmentId:'DEMO-SHIP-02',journeyId:'DEMO-JRN-02',verified:true,proofOfDeliveryStatus:'PENDING',caseType:'proof_of_delivery'})];return state.cases}
  function snapshot(){return JSON.parse(JSON.stringify(state))}
  window.addEventListener('online',flush);
  window.SHELTON_FREIGHT_CUSTOMER_SERVICE={state,sync,createCase,evaluate,queue,flush,loadDemo,snapshot};
})();