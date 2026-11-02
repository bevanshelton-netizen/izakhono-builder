(function(){
  const API='/api/freight/digital-twin';
  const state={mode:'UNAVAILABLE',entities:{},relations:[],events:[],outbox:[],lastSync:null,error:null};
  const verified=e=>!!e && e.verified===true && e.demo!==true;
  const validMode=m=>['LIVE','DEMO','UNAVAILABLE'].includes(m)?m:'UNAVAILABLE';
  function upsert(entity){
    if(!entity||!entity.type||!entity.id)return false;
    const key=entity.type+':'+entity.id;
    const previous=state.entities[key]||null;
    state.entities[key]={...entity,verified:verified(entity)};
    if(previous && previous.state!==entity.state) audit({entity_type:entity.type,entity_id:entity.id,previous_state:previous.state,new_state:entity.state,source:entity.source||'unknown',verified:verified(entity),reason:entity.reason||'state update'});
    return true;
  }
  function audit(e){state.events.push({...e,event_id:'dt-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),timestamp:new Date().toISOString()});}
  function ingest(snapshot){
    if(!snapshot||typeof snapshot!=='object')return;
    state.mode=validMode(snapshot.mode);
    (snapshot.entities||[]).forEach(upsert);
    state.relations=Array.isArray(snapshot.relations)?snapshot.relations.filter(r=>r&&r.from&&r.to):state.relations;
    state.lastSync=new Date().toISOString(); state.error=null;
  }
  async function sync(){
    try{const r=await fetch(API,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);ingest(await r.json());return snapshot();}
    catch(e){state.error=e.message;state.mode='UNAVAILABLE';return snapshot();}
  }
  function queue(event){if(!event)return;state.outbox.push({...event,queued_at:new Date().toISOString()});}
  async function flush(){
    if(!navigator.onLine)return {flushed:0,remaining:state.outbox.length};
    let flushed=0;
    while(state.outbox.length){const event=state.outbox[0];try{const r=await fetch(API+'/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)});if(!r.ok)break;state.outbox.shift();flushed++;}catch(_){break;}}
    return {flushed,remaining:state.outbox.length};
  }
  function get(type,id){return state.entities[type+':'+id]||null;}
  function snapshot(){return JSON.parse(JSON.stringify({mode:state.mode,entities:Object.values(state.entities),relations:state.relations,events:state.events.slice(-100),outbox:state.outbox,lastSync:state.lastSync,error:state.error}));}
  function loadDemo(){
    state.mode='DEMO'; state.entities={}; state.relations=[]; state.events=[];
    [['vehicle','SF-001','IN_TRANSIT'],['vehicle','SF-002','SERVICE_DUE'],['driver','DRV-001','ASSIGNED'],['driver','DRV-002','WATCH'],['journey','JNY-001','EN_ROUTE'],['delivery','DEL-001','DELIVERED'],['customer','CUS-001','HEALTHY'],['corridor','COR-001','PREFERRED']].forEach(x=>upsert({type:x[0],id:x[1],state:x[2],verified:false,demo:true,source:'demo'}));
    state.relations=[{from:'driver:DRV-001',to:'vehicle:SF-001',type:'assigned_to'},{from:'vehicle:SF-001',to:'journey:JNY-001',type:'executes'},{from:'journey:JNY-001',to:'delivery:DEL-001',type:'serves'},{from:'delivery:DEL-001',to:'customer:CUS-001',type:'belongs_to'},{from:'journey:JNY-001',to:'corridor:COR-001',type:'uses'}];
    state.lastSync=new Date().toISOString();
    return snapshot();
  }
  window.SHELTON_FREIGHT_DIGITAL_TWIN={state,sync,flush,queue,get,ingest,loadDemo,snapshot};
})();