(function(){
  'use strict';
  const KEY='shelton-freight-command-automation-v1';
  const API='/api/freight/command-automation';
  const state={mode:'UNAVAILABLE',queue:[],workflows:[],audit:[],lastSync:null,error:null};
  function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');Object.assign(state,x);}catch(e){state.error=e.message;}}
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){state.error=e.message;}}
  function id(prefix){return prefix+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);}
  function verified(x){return !!x && x.verified===true && x.demo!==true;}
  function priority(signal){
    if(!verified(signal)) return 'INFORMATIONAL';
    if(['critical_safety','critical_security'].includes(signal.category)||signal.severity==='CRITICAL') return 'CRITICAL';
    if(signal.category==='operational_blocker') return 'HIGH';
    if(signal.category==='maintenance_risk') return 'HIGH';
    if(signal.category==='customer_escalation') return 'MEDIUM';
    return 'LOW';
  }
  function decide(signal){
    if(!verified(signal)) return {action:null,authorization:'none',priority:'INFORMATIONAL',reason:'Signal is unverified or demo data.'};
    const p=priority(signal);
    const map={critical_safety:'SECURITY_ESCALATION',critical_security:'SECURITY_ESCALATION',operational_blocker:'OPERATIONS_HOLD_REVIEW',maintenance_risk:'MAINTENANCE_HOLD_REVIEW',customer_escalation:'CUSTOMER_UPDATE_REVIEW',financial_risk:'EXECUTIVE_ALERT',network_risk:'EXECUTIVE_ALERT',commercial_opportunity:'COMMERCIAL_FOLLOW_UP'};
    return {action:map[signal.category]||'EXECUTIVE_ALERT',authorization:'human_required',priority:p,reason:'Verified signal matched controlled automation policy.'};
  }
  function ingest(signal){
    const d=decide(signal); const item={id:id('wf'),createdAt:new Date().toISOString(),signal,decision:d,status:d.action?'QUEUED':'DEFERRED'};
    state.workflows.unshift(item); state.audit.unshift({id:id('audit'),type:'WORKFLOW_CREATED',workflowId:item.id,at:item.createdAt,decision:d});
    if(d.action) state.queue.push(item); persist(); emit(); return item;
  }
  async function sync(){
    state.error=null;
    try{const r=await fetch(API,{headers:{Accept:'application/json'}}); if(!r.ok) throw new Error('HTTP '+r.status); const data=await r.json(); state.mode='LIVE'; state.lastSync=new Date().toISOString(); if(Array.isArray(data.workflows)) state.workflows=data.workflows; if(Array.isArray(data.queue)) state.queue=data.queue; persist(); emit(); return data;}
    catch(e){state.mode='UNAVAILABLE';state.error=e.message;persist();emit();return null;}
  }
  async function authorize(workflowId, approvedBy, note){
    const w=state.workflows.find(x=>x.id===workflowId); if(!w) throw new Error('Workflow not found');
    if(w.decision.authorization!=='human_required') throw new Error('Authorization not required');
    const record={workflowId,approvedBy:String(approvedBy||'operator'),note:String(note||''),at:new Date().toISOString()};
    state.audit.unshift({id:id('audit'),type:'AUTHORIZATION_RECORDED',...record});
    w.status='IN_PROGRESS'; w.authorization=record;
    try{const r=await fetch(API+'/authorizations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)}); if(!r.ok) throw new Error('HTTP '+r.status); state.mode='LIVE'; w.status='COMPLETED';}
    catch(e){state.mode='UNAVAILABLE';state.queue.push({workflowId,record});w.status='AWAITING_AUTHORIZATION';state.error=e.message;}
    persist();emit();return w;
  }
  async function act(workflowId, action){
    const w=state.workflows.find(x=>x.id===workflowId); if(!w) throw new Error('Workflow not found');
    const safe=['DRIVER_CHECK_IN','SECURITY_ESCALATION','MAINTENANCE_HOLD_REVIEW','DELIVERY_EXCEPTION','CUSTOMER_UPDATE_REVIEW','EXECUTIVE_ALERT','OPERATIONS_HOLD_REVIEW','COMMERCIAL_FOLLOW_UP'];
    if(!safe.includes(action)) throw new Error('Unsupported action');
    const payload={workflowId,action,at:new Date().toISOString()}; state.audit.unshift({id:id('audit'),type:'ACTION_REQUESTED',...payload});
    try{const r=await fetch(API+'/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error('HTTP '+r.status);state.mode='LIVE';w.status='COMPLETED';}
    catch(e){state.mode='UNAVAILABLE';state.error=e.message;state.queue.push(payload);w.status='QUEUED';}
    persist();emit();return w;
  }
  async function flush(){const pending=[...state.queue];state.queue=[];for(const item of pending){try{const r=await fetch(API+'/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});if(!r.ok)throw new Error('HTTP '+r.status);state.mode='LIVE';}catch(e){state.queue.push(item);state.mode='UNAVAILABLE';state.error=e.message;break;}}persist();emit();return state.queue.length===0;}
  function loadDemo(){state.mode='DEMO';state.workflows=[{id:'demo-wf-001',createdAt:new Date().toISOString(),signal:{category:'maintenance_risk',severity:'HIGH',verified:false,demo:true,entityId:'TRUCK-001'},decision:{action:'none',authorization:'none',priority:'INFORMATIONAL',reason:'Demo data only; no operational action.'},status:'DEFERRED'}];state.queue=[];state.audit=[];persist();emit();}
  function clear(){state.workflows=[];state.queue=[];state.audit=[];state.error=null;persist();emit();}
  function emit(){window.dispatchEvent(new CustomEvent('shelton-freight-command-automation',{detail:JSON.parse(JSON.stringify(state))}));}
  load(); window.SHELTON_FREIGHT_COMMAND_AUTOMATION={state,ingest,decide,sync,authorize,act,flush,loadDemo,clear}; emit();
})();