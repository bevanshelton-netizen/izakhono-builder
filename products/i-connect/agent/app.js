const incoming=document.getElementById('incoming'),active=document.getElementById('active'),accept=document.getElementById('accept'),skip=document.getElementById('skip'),toast=document.getElementById('toast'),statusBtn=document.getElementById('statusBtn');
const CONFIG={token:localStorage.getItem('ic_access_token'),organizationId:localStorage.getItem('ic_organization_id')};
const LIVE=Boolean(CONFIG.token&&CONFIG.organizationId);
let seconds=0,timerId=null,muted=false,held=false,currentCallId=null;

function notify(t){toast.textContent=t;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800)}
function format(){return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0')}
function modeBadge(){const b=document.createElement('div');b.style.cssText='position:fixed;right:12px;top:12px;z-index:20;padding:6px 10px;border-radius:999px;font:700 11px system-ui;background:'+ (LIVE?'#0d7a46':'#754f00') +';color:white';b.textContent=LIVE?'LIVE API MODE':'DEMO MODE';document.body.appendChild(b)}
async function api(path,body){const r=await fetch('../api/'+path,{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+CONFIG.token},body:JSON.stringify(body||{})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.message||data.error||'request_failed');return data}
async function heartbeat(state='ready'){if(!LIVE)return;try{await api('agent-session',{organization_id:CONFIG.organizationId,state,device_label:navigator.userAgent.slice(0,120)})}catch(e){notify('Session: '+e.message)}}
async function nextCall(){if(!LIVE)return;try{const r=await api('queue-next',{organization_id:CONFIG.organizationId});const row=Array.isArray(r.data)?r.data[0]:r.data;if(!row){document.getElementById('callerName').textContent='Queue clear';document.getElementById('callerNumber').textContent='No calls waiting';accept.disabled=true;return}currentCallId=row.call_id;document.getElementById('callerName').textContent='Customer';document.getElementById('callerNumber').textContent=row.customer_number_masked||'Masked number';accept.disabled=false}catch(e){notify('Queue: '+e.message)}}
async function event(type,payload={}){if(!LIVE||!currentCallId)return;try{await api('call-event',{call_id:currentCallId,event_type:type,payload})}catch(e){notify('Event: '+e.message)}}
async function requestBridge(){if(!LIVE||!currentCallId)return;const r=await api('call-bridge',{call_id:currentCallId,action:'bridge'});return r}

async function startCall(){
  incoming.classList.add('hidden');active.classList.remove('hidden');statusBtn.textContent='● ON CALL';statusBtn.className='busy';seconds=0;document.getElementById('timer').textContent='00:00';timerId=setInterval(()=>{seconds++;document.getElementById('timer').textContent=format()},1000);
  if(!LIVE){notify('Demo call accepted — bridge not live');return}
  await heartbeat('busy');await event('accepted');
  try{await event('bridge_requested');await requestBridge();notify('Carrier bridge requested')}catch(e){notify('Bridge unavailable: '+e.message)}
}
async function endCall(){
  clearInterval(timerId);active.classList.add('hidden');incoming.classList.remove('hidden');statusBtn.textContent='● READY';statusBtn.className='ready';
  if(LIVE){await event('completed',{duration_seconds:seconds});await heartbeat('ready');currentCallId=null;await nextCall();notify('Call completed')}else notify('Demo call completed')
}
accept.onclick=()=>startCall().catch(e=>notify(e.message));
skip.onclick=async()=>{if(LIVE&&currentCallId){await event('abandoned',{reason:'agent_skipped'});currentCallId=null;await heartbeat('ready');await nextCall()}notify(LIVE?'Call returned to queue':'Demo call skipped')};
document.getElementById('end').onclick=()=>endCall().catch(e=>notify(e.message));
document.getElementById('mute').onclick=e=>{muted=!muted;e.textContent=muted?'Unmute':'Mute';notify(muted?'Microphone muted':'Microphone live')};
document.getElementById('hold').onclick=async e=>{held=!held;e.textContent=held?'Resume':'Hold';await event(held?'held':'resumed');notify(held?'Call on hold':'Call resumed')};
document.getElementById('transfer').onclick=()=>notify('Transfer directory opened');
statusBtn.onclick=async()=>{if(LIVE){await heartbeat(statusBtn.className==='ready'?'paused':'ready');notify('Agent status updated')}else notify('Demo agent status')};

modeBadge();
if(LIVE){heartbeat('ready').then(nextCall);setInterval(()=>heartbeat(statusBtn.className==='busy'?'busy':'ready'),30000)}else{notify('Demo mode — production credentials not configured on this device')}
/* Production path: authenticated agent -> atomic queue claim -> I-CONNECT carrier bridge -> registered private endpoint -> customer. */