const $=s=>document.querySelector(s);
const toast=$('#toast');
let toastTimer=null;
let authenticated=false;
let sessionConfigured=false;
let conversationId=null;
function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),3200)}
function addActivity(title,detail){const list=$('#activity-list');if(list.querySelector('.empty'))list.innerHTML='';const item=document.createElement('div');item.className='activity-item';const b=document.createElement('b');b.textContent=title;const small=document.createElement('small');small.textContent=detail;item.append(b,small);list.prepend(item)}
function showAuth(required,message=''){const panel=$('#auth-panel');panel.hidden=!required;document.querySelectorAll('.requires-auth').forEach(el=>el.classList.toggle('auth-hidden',required));$('#auth-message').textContent=message;if(required){$('#connection-state').textContent='SIGN IN REQUIRED';$('#login-secret').focus()}else if(!sessionConfigured){$('#connection-state').textContent='LOCAL PREVIEW'}}
async function api(path,options={}){const response=await fetch(path,{...options,credentials:'same-origin',headers:{...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}});let data={};try{data=await response.json()}catch{}if(!response.ok)throw new Error(data.error||'Request failed ('+response.status+')');return data}
async function loadSession(){try{const state=await api('/api/jarvis/v1/session');sessionConfigured=!!state.login_configured;authenticated=!!state.authenticated;if(sessionConfigured&&!authenticated){showAuth(true);return}if(authenticated){showAuth(false);$('#connection-state').textContent='OWNER SESSION ACTIVE';await loadWorkspace();return}}catch{}sessionConfigured=false;authenticated=false;showAuth(false)}
async function loadWorkspace(){try{const status=await api('/api/jarvis/v1/status');$('#connection-state').textContent=status.intelligence==='connected'?'AI CONNECTED':'OWNER SESSION ACTIVE';const conversations=await api('/api/jarvis/v1/conversations');if(conversations.items&&conversations.items.length){conversationId=conversations.items[0].id;const history=await api('/api/jarvis/v1/conversations/'+encodeURIComponent(conversationId)+'/messages');const list=$('#activity-list');list.innerHTML='';(history.items||[]).slice(-8).forEach(m=>addActivity(m.role==='assistant'?'J.A.R.V.I.S.':m.content,m.role==='assistant'?m.content.slice(0,240):'Owner command · saved to conversation'));}else{const created=await api('/api/jarvis/v1/conversations',{method:'POST',body:JSON.stringify({title:'J.A.R.V.I.S. session'})});conversationId=created.conversation.id}const node=document.querySelector('.node small');if(node)node.textContent='Owner session · D1 persistence';const note=document.querySelector('.demo-note');if(note)note.textContent='Authenticated owner session · Commands are stored securely; external actions remain approval-gated.';const activityFoot=document.querySelector('.activity-foot');if(activityFoot)activityFoot.textContent='Conversation and audit records are stored by the owner API.';await loadTasks()}catch(error){notify('Connected session, but workspace could not load: '+error.message)}}
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();const secret=$('#login-secret').value;if(!secret)return;const button=e.submitter;button.disabled=true;$('#auth-message').textContent='Authenticating securely…';try{await api('/api/jarvis/v1/session/login',{method:'POST',body:JSON.stringify({secret})});$('#login-secret').value='';authenticated=true;showAuth(false);$('#connection-state').textContent='OWNER SESSION ACTIVE';await loadWorkspace();notify('Secure owner session established.')}catch(error){$('#auth-message').textContent=error.message}finally{button.disabled=false}});
async function submit(){const value=$('#prompt').value.trim();if(!value){notify('Enter a command first.');return}if(!authenticated){addActivity(value,'Captured locally · Preview only · Not executed');$('#prompt').value='';notify('Local preview only. Configure secure owner login to connect the workspace.');return}const button=$('#send');button.disabled=true;button.textContent='Working…';try{if(!conversationId){const created=await api('/api/jarvis/v1/conversations',{method:'POST',body:JSON.stringify({title:value.slice(0,72)})});conversationId=created.conversation.id}const result=await api('/api/jarvis/v1/conversations/'+encodeURIComponent(conversationId)+'/messages',{method:'POST',body:JSON.stringify({text:value,client_message_id:crypto.randomUUID()})});addActivity('YOU',value);if(result.assistant_message){addActivity('J.A.R.V.I.S.',result.assistant_message.content);$('#connection-state').textContent='AI CONNECTED'}else{addActivity('J.A.R.V.I.S. STATUS','Message saved. Intelligence gateway is not connected yet.');notify('Your command was saved. AI gateway credentials still need configuration.')}$('#prompt').value=''}catch(error){notify('Command could not be submitted: '+error.message)}finally{button.disabled=false;button.innerHTML='Submit command <span>↗</span>'}}
$('#send').addEventListener('click',submit);
$('#prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();submit()}});
document.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>{$('#prompt').value=button.dataset.prompt;$('#prompt').focus()}));
document.querySelectorAll('[data-toast]').forEach(button=>button.addEventListener('click',()=>notify(button.dataset.toast)));
function tick(){const d=new Date();$('#clock').textContent=new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(d)}tick();setInterval(tick,30000);
const mic=$('#mic'),voiceStatus=$('#voice-status');const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!SpeechRecognition){mic.disabled=true;mic.style.opacity='.45';voiceStatus.textContent='Speech recognition unavailable in this browser'}else{const recognition=new SpeechRecognition();recognition.lang='en-ZA';recognition.interimResults=true;recognition.continuous=false;let active=false;mic.addEventListener('click',()=>{if(active){recognition.stop();return}try{recognition.start()}catch(e){notify('Voice input could not start. Check microphone permission.')}});recognition.onstart=()=>{active=true;mic.textContent='■';voiceStatus.textContent='Listening…'};recognition.onresult=e=>{let transcript='';for(let i=e.resultIndex;i<e.results.length;i++)transcript+=e.results[i][0].transcript;$('#prompt').value=transcript};recognition.onerror=e=>{voiceStatus.textContent='Voice input: '+e.error;notify('Voice input error: '+e.error)};recognition.onend=()=>{active=false;mic.textContent='♩';voiceStatus.textContent='Voice input ready'}}}

const agentTypes={
  coordinator:['coordination','project_plan'],
  'business-analyst':['analysis','business_report'],
  'research-briefing':['research_brief'],
  'project-planner':['project_plan','coordination'],
  reporting:['business_report','analysis']
};
const agentSelect=$('#agent-select'),typeSelect=$('#task-type');
function syncTaskTypes(){const allowed=agentTypes[agentSelect.value]||[];Array.from(typeSelect.options).forEach(o=>o.hidden=!allowed.includes(o.value));if(!allowed.includes(typeSelect.value))typeSelect.value=allowed[0]||''}
agentSelect.addEventListener('change',syncTaskTypes);syncTaskTypes();
function taskElement(task){
 const card=document.createElement('article');card.className='task-card';
 const head=document.createElement('div');head.className='task-card-head';
 const title=document.createElement('b');title.textContent=task.title;
 const state=document.createElement('span');state.className='task-state '+String(task.status||'').replace(/[^a-z_]/g,'');state.textContent=String(task.status||'').replace('_',' ').toUpperCase();
 head.append(title,state);card.append(head);
 const meta=document.createElement('small');meta.textContent=(task.agent_id||'agent')+' · '+(task.task_type||'task')+' · '+(task.priority||'normal')+' priority · '+(task.attempts||0)+'/'+(task.max_attempts||3)+' attempts';card.append(meta);
 if(task.result_text||task.result){const result=document.createElement('p');result.className='task-result';result.textContent=task.result_text||task.result;card.append(result)}
 if(task.error_code){const error=document.createElement('small');error.className='task-error';error.textContent='Last error: '+task.error_code;card.append(error)}
 const actions=document.createElement('div');actions.className='task-actions';
 if(['queued','retry_wait'].includes(task.status)){const run=document.createElement('button');run.type='button';run.textContent='Run agent';run.dataset.taskAction='run';run.dataset.taskId=task.id;actions.append(run)}
 if(['queued','retry_wait','running'].includes(task.status)){const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.dataset.taskAction='cancel';cancel.dataset.taskId=task.id;actions.append(cancel)}
 if(actions.childNodes.length)card.append(actions);
 return card;
}
async function loadTasks(){
 if(!authenticated)return;
 try{const data=await api('/api/jarvis/v1/tasks');const list=$('#task-list');list.innerHTML='';if(!data.items||!data.items.length){const empty=document.createElement('div');empty.className='empty';empty.innerHTML='<span>◈</span><b>No queued tasks</b><small>Create a task to begin.</small>';list.append(empty);return}data.items.forEach(task=>list.append(taskElement(task)))}catch(error){$('#task-message').textContent='Task queue unavailable: '+error.message}
}
$('#task-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!authenticated){notify('Sign in to queue agent tasks.');return}
 const button=$('#queue-task');button.disabled=true;$('#task-message').textContent='Saving task…';
 try{const result=await api('/api/jarvis/v1/tasks',{method:'POST',body:JSON.stringify({agent_id:agentSelect.value,task_type:typeSelect.value,title:$('#task-title').value,instruction:$('#task-instruction').value,priority:$('#task-priority').value,idempotency_key:crypto.randomUUID()})});$('#task-message').textContent=result.duplicate?'Existing task found.':'Task queued successfully.';$('#task-title').value='';$('#task-instruction').value='';await loadTasks();notify('Task added to the J.A.R.V.I.S. queue.')}catch(error){$('#task-message').textContent=error.message}finally{button.disabled=false}
});
$('#refresh-tasks').addEventListener('click',loadTasks);
$('#task-list').addEventListener('click',async e=>{
 const button=e.target.closest('button[data-task-action]');if(!button)return;
 const action=button.dataset.taskAction,id=button.dataset.taskId;button.disabled=true;button.textContent=action==='run'?'Running…':'Cancelling…';
 try{const result=await api('/api/jarvis/v1/tasks/'+encodeURIComponent(id)+'/'+action,{method:'POST'});if(result.result){const output=document.createElement('div');output.className='task-result';output.textContent=result.result;notify('Agent completed its task.')}else notify('Task status: '+result.status);await loadTasks()}catch(error){notify(error.message);button.disabled=false;button.textContent=action==='run'?'Run agent':'Cancel'}
});

loadSession();
