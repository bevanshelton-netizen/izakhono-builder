(function(){
  const KEY='sheltonFreightMaintenanceOperations';
  const state={mode:'UNAVAILABLE',vehicles:[],workOrders:[],outbox:[],audit:[],lastSync:null,error:null};
  const api='/api/freight/maintenance';
  const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
  const load=()=>{try{Object.assign(state,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(e){state.error=e.message;}};
  const now=()=>new Date().toISOString();
  const id=(p)=>p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
  function audit(action,payload){state.audit.push({id:id('AUD'),action,payload,at:now()});save();}
  function urgency(v){
    const s=v&&v.verifiedSignals||[];
    if(s.some(x=>['verified_fault_code','brake_wear','temperature_warning','tamper'].includes(x.type)&&x.severity==='CRITICAL')) return 'CRITICAL';
    if(s.some(x=>x.verified&&x.severity==='HIGH')) return 'URGENT';
    if(s.some(x=>x.verified&&['MEDIUM','WATCH'].includes(x.severity))) return 'SOON';
    return s.length?'ROUTINE':'UNAVAILABLE';
  }
  function evaluateVehicle(v){
    const u=urgency(v);
    let maintenanceState='UNAVAILABLE';
    if(u==='CRITICAL') maintenanceState='GROUNDED';
    else if(u==='URGENT') maintenanceState='URGENT';
    else if(u==='SOON') maintenanceState='SERVICE_DUE';
    else if(u==='ROUTINE') maintenanceState='WATCH';
    else if(v&&v.verified) maintenanceState='HEALTHY';
    return {vehicleId:v&&v.vehicleId,maintenanceState,urgency:u,verifiedSignals:(v&&v.verifiedSignals)||[],evaluatedAt:now()};
  }
  async function sync(){
    state.error=null;
    try{
      const r=await fetch(api+'/vehicles',{headers:{Accept:'application/json'}});
      if(!r.ok) throw new Error('Maintenance feed unavailable');
      const data=await r.json(); state.vehicles=Array.isArray(data)?data:(data.vehicles||[]); state.mode='LIVE'; state.lastSync=now(); audit('SYNC_LIVE',{count:state.vehicles.length}); save(); return state.vehicles;
    }catch(e){state.mode='UNAVAILABLE';state.error=e.message;save();return []}
  }
  async function createWorkOrder(order){
    const item={...order,id:order.id||id('WO'),createdAt:now(),state:order.state||'DRAFT'};
    try{
      const r=await fetch(api+'/work-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});
      if(!r.ok) throw new Error('Work-order API unavailable');
      const savedOrder=await r.json(); state.workOrders.push(savedOrder); state.mode='LIVE'; audit('CREATE_WORK_ORDER',savedOrder); save(); return savedOrder;
    }catch(e){state.outbox.push({type:'CREATE_WORK_ORDER',payload:item,queuedAt:now()});state.workOrders.push(item);state.mode='UNAVAILABLE';state.error=e.message;audit('QUEUE_WORK_ORDER',item);save();return item;}
  }
  async function flush(){
    const q=state.outbox.slice();state.outbox=[];
    for(const item of q){try{const r=await fetch(api+'/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});if(!r.ok)throw new Error('Replay rejected');audit('REPLAY',item);}catch(e){state.outbox.push(item);state.error=e.message;}}
    save();return state.outbox.length===0;
  }
  function loadDemo(){
    state.mode='DEMO';state.vehicles=[
      {vehicleId:'SF-DEMO-001',registration:'DEMO-001',verified:true,verifiedSignals:[{type:'service_due',severity:'MEDIUM',verified:true}]},
      {vehicleId:'SF-DEMO-002',registration:'DEMO-002',verified:true,verifiedSignals:[{type:'brake_wear',severity:'HIGH',verified:true}]},
      {vehicleId:'SF-DEMO-003',registration:'DEMO-003',verified:false,verifiedSignals:[]}
    ];state.lastSync=now();audit('LOAD_DEMO',{vehicles:3});save();return state.vehicles;
  }
  load();
  window.SHELTON_FREIGHT_MAINTENANCE={state,evaluateVehicle,sync,createWorkOrder,flush,loadDemo};
})();