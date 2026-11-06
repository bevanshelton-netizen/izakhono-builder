const $=s=>document.querySelector(s);
const toast=$('#toast');
let toastTimer=null;
let authenticated=false;
let sessionConfigured=false;
let conversationId=null;
function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),3200)}
const portfolio=[
 {name:'Izakhono Africa',kind:'Manufacturing & group operations',focus:'Uniforms · Matric jackets · PPE · Sportswear',source:'Owner portfolio context',state:'PROFILE REGISTERED'},
 {name:'Edu-Build Institute',kind:'Education & training',focus:'ECD teacher training · NQF Level 4 & 5 · Campuses',source:'Owner portfolio context',state:'PROFILE REGISTERED'},
 {name:'Classique Furniture',kind:'Furniture manufacturing',focus:'Furniture production and commercial opportunities',source:'Owner portfolio context',state:'PROFILE REGISTERED'},
 {name:'KG Industrial',kind:'Industrial services',focus:'Ship repair · East London Harbour',source:'Owner portfolio context',state:'PROFILE REGISTERED'},
 {name:'Free Bird Agri-Quip',kind:'Agriculture',focus:'Poultry and egg-layer operations',source:'Owner portfolio context',state:'PROFILE REGISTERED'},
 {name:'KORA Network',kind:'Media & market access platform',focus:'African storytelling · visibility · market access',source:'Owner portfolio context',state:'PROFILE REGISTERED'},
 {name:'BEVAN SHELTON',kind:'Fashion & lifestyle brand',focus:'Urban apparel · African heritage influence',source:'Owner portfolio context',state:'PROFILE REGISTERED'},
 {name:'IZAKHONO Technology',kind:'Digital infrastructure & products',focus:'J.A.R.V.I.S. · Builder · owned-first infrastructure',source:'Owner portfolio context',state:'PROFILE REGISTERED'}
];
function renderPortfolio(){
 const grid=$('#portfolio-grid');if(!grid)return;grid.innerHTML='';
 portfolio.forEach(item=>{
  const card=document.createElement('article');card.className='portfolio-card';
  const head=document.createElement('div');head.className='portfolio-card-head';
  const title=document.createElement('b');title.textContent=item.name;
  const state=document.createElement('span');state.textContent=item.state;
  head.append(title,state);card.append(head);
  const kind=document.createElement('small');kind.className='portfolio-kind';kind.textContent=item.kind;card.append(kind);
  const focus=document.createElement('p');focus.textContent=item.focus;card.append(focus);
  const source=document.createElement('small');source.className='portfolio-source';source.textContent='SOURCE · '+item.source+' · LIVE FEED NOT CONNECTED';card.append(source);
  grid.append(card);
 });
}
function addActivity(title,detail){const list=$('#activity-list');if(list.querySelector('.empty'))list.innerHTML='';const item=document.createElement('div');item.className='activity-item';const b=document.createElement('b');b.textContent=title;const small=document.createElement('small');small.textContent=detail;item.append(b,small);list.prepend(item)}
function showAuth(required,message=''){const panel=$('#auth-panel');panel.hidden=!required;document.querySelectorAll('.requires-auth').forEach(el=>el.classList.toggle('auth-hidden',required));$('#auth-message').textContent=message;if(required){$('#connection-state').textContent='SIGN IN REQUIRED';$('#login-secret').focus()}else if(!sessionConfigured){$('#connection-state').textContent='LOCAL PREVIEW'}}
async function api(path,options={}){const response=await fetch(path,{...options,credentials:'same-origin',headers:{...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}});let data={};try{data=await response.json()}catch{}if(!response.ok)throw new Error(data.error||'Request failed ('+response.status+')');return data}
async function loadSession(){try{const state=await api('/api/jarvis/v1/session');sessionConfigured=!!state.login_configured;authenticated=!!state.authenticated;if(sessionConfigured&&!authenticated){showAuth(true);return}if(authenticated){showAuth(false);$('#connection-state').textContent='OWNER SESSION ACTIVE';await loadWorkspace();return}}catch{}sessionConfigured=false;authenticated=false;showAuth(false)}
async function loadWorkspace(){try{const status=await api('/api/jarvis/v1/status');$('#connection-state').textContent=status.intelligence==='connected'?'AI CONNECTED':status.intelligence==='configured'?'AI GATEWAY READY':'OWNER SESSION ACTIVE';const conversations=await api('/api/jarvis/v1/conversations');if(conversations.items&&conversations.items.length){conversationId=conversations.items[0].id;const history=await api('/api/jarvis/v1/conversations/'+encodeURIComponent(conversationId)+'/messages');const list=$('#activity-list');list.innerHTML='';(history.items||[]).slice(-8).forEach(m=>addActivity(m.role==='assistant'?'J.A.R.V.I.S.':m.content,m.role==='assistant'?m.content.slice(0,240):'Owner command · saved to conversation'));}else{const created=await api('/api/jarvis/v1/conversations',{method:'POST',body:JSON.stringify({title:'J.A.R.V.I.S. session'})});conversationId=created.conversation.id}const node=document.querySelector('.node small');if(node)node.textContent='Owner session · D1 persistence';const note=document.querySelector('.demo-note');if(note)note.textContent='Authenticated owner session · Commands are stored securely; external actions remain approval-gated.';const activityFoot=document.querySelector('.activity-foot');if(activityFoot)activityFoot.textContent='Conversation and audit records are stored by the owner API.';renderPortfolio();await loadTasks();await loadActions();await loadContext()}catch(error){notify('Connected session, but workspace could not load: '+error.message)}}
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();const secret=$('#login-secret').value;if(!secret)return;const button=e.submitter;button.disabled=true;$('#auth-message').textContent='Authenticating securely…';try{await api('/api/jarvis/v1/session/login',{method:'POST',body:JSON.stringify({secret})});$('#login-secret').value='';authenticated=true;showAuth(false);$('#connection-state').textContent='OWNER SESSION ACTIVE';await loadWorkspace();notify('Secure owner session established.')}catch(error){$('#auth-message').textContent=error.message}finally{button.disabled=false}});
async function submit(){const value=$('#prompt').value.trim();if(!value){notify('Enter a command first.');return}if(!authenticated){addActivity(value,'Captured locally · Preview only · Not executed');$('#prompt').value='';notify('Local preview only. Configure secure owner login to connect the workspace.');return}const button=$('#send');button.disabled=true;button.textContent='Working…';try{if(!conversationId){const created=await api('/api/jarvis/v1/conversations',{method:'POST',body:JSON.stringify({title:value.slice(0,72)})});conversationId=created.conversation.id}const result=await api('/api/jarvis/v1/conversations/'+encodeURIComponent(conversationId)+'/messages',{method:'POST',body:JSON.stringify({text:value,client_message_id:crypto.randomUUID()})});addActivity('YOU',value);if(result.assistant_message){addActivity('J.A.R.V.I.S.',result.assistant_message.content);$('#connection-state').textContent='AI CONNECTED'}else{addActivity('J.A.R.V.I.S. STATUS','Message saved. Intelligence gateway is not connected yet.');notify('Your command was saved. AI gateway credentials still need configuration.')}$('#prompt').value=''}catch(error){notify('Command could not be submitted: '+error.message)}finally{button.disabled=false;button.innerHTML='Submit command <span>↗</span>'}}
$('#send').addEventListener('click',submit);
$('#prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();submit()}});
document.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>{$('#prompt').value=button.dataset.prompt;$('#prompt').focus()}));
document.querySelectorAll('[data-toast]').forEach(button=>button.addEventListener('click',()=>notify(button.dataset.toast)));
function tick(){const d=new Date();$('#clock').textContent=new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(d)}tick();setInterval(tick,30000);
const mic=$('#mic'),voiceStatus=$('#voice-status');const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!SpeechRecognition){mic.disabled=true;mic.style.opacity='.45';voiceStatus.textContent='Speech recognition unavailable in this browser'}else{const recognition=new SpeechRecognition();recognition.lang='en-ZA';recognition.interimResults=true;recognition.continuous=false;let active=false;mic.addEventListener('click',()=>{if(active){recognition.stop();return}try{recognition.start()}catch(e){notify('Voice input could not start. Check microphone permission.')}});recognition.onstart=()=>{active=true;mic.textContent='■';voiceStatus.textContent='Listening…'};recognition.onresult=e=>{let transcript='';for(let i=e.resultIndex;i<e.results.length;i++)transcript+=e.results[i][0].transcript;$('#prompt').value=transcript};recognition.onerror=e=>{voiceStatus.textContent='Voice input: '+e.error;notify('Voice input error: '+e.error)};recognition.onend=()=>{active=false;mic.textContent='♩';voiceStatus.textContent='Voice input ready'}}

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
 try{const result=await api('/api/jarvis/v1/tasks',{method:'POST',body:JSON.stringify({agent_id:agentSelect.value,task_type:typeSelect.value,title:$('#task-title').value,instruction:$('#task-instruction').value,priority:$('#task-priority').value,context_ids:Array.from(document.querySelectorAll('#context-list input[data-context-id]:checked')).map(input=>input.dataset.contextId),idempotency_key:crypto.randomUUID()})});$('#task-message').textContent=result.duplicate?'Existing task found.':'Task queued successfully.';$('#task-title').value='';$('#task-instruction').value='';document.querySelectorAll('#context-list input[data-context-id]').forEach(input=>{input.checked=false});await loadTasks();notify('Task added to the J.A.R.V.I.S. queue.')}catch(error){$('#task-message').textContent=error.message}finally{button.disabled=false}
});
$('#refresh-tasks').addEventListener('click',loadTasks);
$('#task-list').addEventListener('click',async e=>{
 const button=e.target.closest('button[data-task-action]');if(!button)return;
 const action=button.dataset.taskAction,id=button.dataset.taskId;button.disabled=true;button.textContent=action==='run'?'Running…':'Cancelling…';
 try{const result=await api('/api/jarvis/v1/tasks/'+encodeURIComponent(id)+'/'+action,{method:'POST'});if(result.result){const output=document.createElement('div');output.className='task-result';output.textContent=result.result;notify('Agent completed its task.')}else notify('Task status: '+result.status);await loadTasks()}catch(error){notify(error.message);button.disabled=false;button.textContent=action==='run'?'Run agent':'Cancel'}
});

loadSession();


function actionElement(item){
 const card=document.createElement('article');card.className='task-card';
 const head=document.createElement('div');head.className='task-card-head';
 const title=document.createElement('b');title.textContent=item.action_type+' → '+item.target;
 const state=document.createElement('span');state.className='task-state '+String(item.status||'');state.textContent=String(item.status||'').toUpperCase();
 head.append(title,state);card.append(head);
 const meta=document.createElement('small');meta.textContent='Payload fingerprint · '+String(item.payload_hash||'').slice(0,23)+'… · Expires '+new Date(Number(item.expires_at)*1000).toLocaleString();card.append(meta);
 const payload=document.createElement('pre');payload.className='action-payload';payload.textContent=typeof item.payload_json==='string'?item.payload_json:JSON.stringify(item.payload||{},null,2);card.append(payload);
 if(item.status==='approved'){const execute=document.createElement('button');execute.type='button';execute.textContent='Execute approved internal audit record';execute.dataset.actionDecision='execute';execute.dataset.actionId=item.id;execute.dataset.payloadHash=item.payload_hash;const controls=document.createElement('div');controls.className='task-actions';controls.append(execute);card.append(controls)}
 if(item.status==='proposed'){
  const controls=document.createElement('div');controls.className='task-actions';
  for(const decision of ['approve','reject','cancel']){const b=document.createElement('button');b.type='button';b.textContent=decision[0].toUpperCase()+decision.slice(1);b.dataset.actionDecision=decision;b.dataset.actionId=item.id;b.dataset.payloadHash=item.payload_hash;controls.append(b)}
  card.append(controls);
 }
 const note=document.createElement('small');note.textContent='Decision only — execution is not enabled.';card.append(note);
 return card;
}
async function loadActions(){
 if(!authenticated)return;
 try{const data=await api('/api/jarvis/v1/actions');const list=$('#action-list');list.innerHTML='';
 if(!data.items||!data.items.length){const empty=document.createElement('div');empty.className='empty';empty.innerHTML='<span>◇</span><b>No action proposals</b><small>Proposed operations will appear here.</small>';list.append(empty);return}
 data.items.forEach(item=>list.append(actionElement(item)));
 }catch(error){$('#action-message').textContent='Action register unavailable: '+error.message}
}
$('#action-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!authenticated){notify('Sign in to create action proposals.');return}
 const button=$('#propose-action');button.disabled=true;$('#action-message').textContent='Creating immutable proposal…';
 try{let payload;try{payload=JSON.parse($('#action-payload').value)}catch{throw new Error('Payload must be valid JSON.')}
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Payload must be a JSON object.');
 const result=await api('/api/jarvis/v1/actions',{method:'POST',body:JSON.stringify({action_type:$('#action-type').value,target:$('#action-target').value,payload})});
 $('#action-message').textContent='Proposal created · '+result.proposal.payload_hash;$('#action-type').value='';$('#action-target').value='';$('#action-payload').value='{}';await loadActions();notify('Action proposal recorded. Nothing was executed.');
 }catch(error){$('#action-message').textContent=error.message}finally{button.disabled=false}
});
$('#refresh-actions').addEventListener('click',loadActions);
$('#action-list').addEventListener('click',async e=>{
 const button=e.target.closest('button[data-action-decision]');if(!button)return;
 const decision=button.dataset.actionDecision;button.disabled=true;
 try{
  const body=decision==='cancel'?{}:{expected_payload_hash:button.dataset.payloadHash};
  const result=await api('/api/jarvis/v1/actions/'+encodeURIComponent(button.dataset.actionId)+'/'+(decision==='execute'?'execute':decision),{method:'POST',body:JSON.stringify(body)});
  notify(decision==='execute'?'Internal audit adapter completed. No external system was contacted.':'Proposal '+result.status+'. No external action was executed.');await loadActions();
 }catch(error){notify(error.message);button.disabled=false}
});

const contextScope=$('#context-scope'),contextProject=$('#context-project');
contextScope.addEventListener('change',()=>{contextProject.disabled=contextScope.value!=='project';contextProject.required=contextScope.value==='project';});
function contextElement(record){
 const card=document.createElement('article');card.className='context-card';
 const top=document.createElement('div');top.className='context-card-head';
 const label=document.createElement('span');label.className='context-scope';label.textContent=record.scope==='project'?'PROJECT · '+(record.project_id||''):'COMPANY';
 const type=document.createElement('small');type.textContent=String(record.record_type||'reference').replace(/_/g,' ');
 top.append(label,type);card.append(top);
 const title=document.createElement('b');title.className='context-title';title.textContent=record.title;card.append(title);
 const content=document.createElement('p');content.className='context-content';content.textContent=record.content;card.append(content);
 if(Array.isArray(record.tags)&&record.tags.length){const tags=document.createElement('small');tags.className='context-tags';tags.textContent=record.tags.join(' · ');card.append(tags)}
 const footer=document.createElement('label');footer.className='context-attach';
 const check=document.createElement('input');check.type='checkbox';check.dataset.contextId=record.id;check.setAttribute('aria-label','Attach '+record.title+' to next task');
 const text=document.createElement('span');text.textContent='Attach to next task';
 footer.append(check,text);card.append(footer);
 return card;
}
async function loadContext(){
 if(!authenticated)return;
 try{
  const filter=$('#context-filter').value;
  const data=await api('/api/jarvis/v1/context'+(filter==='all'?'':'?scope='+encodeURIComponent(filter)));
  const list=$('#context-list');list.innerHTML='';
  if(!data.items||!data.items.length){const empty=document.createElement('div');empty.className='empty';empty.innerHTML='<span>⌕</span><b>No knowledge records yet</b><small>Add a company or project record to build the shared knowledge base.</small>';list.append(empty);return}
  data.items.forEach(record=>list.append(contextElement(record)));
 }catch(error){$('#context-message').textContent='Knowledge library unavailable: '+error.message}
}
$('#context-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!authenticated){notify('Sign in to manage company knowledge.');return}
 const button=$('#save-context');button.disabled=true;$('#context-message').textContent='Saving owner-scoped record…';
 try{
  const scope=contextScope.value;
  const result=await api('/api/jarvis/v1/context',{method:'POST',body:JSON.stringify({
   scope,project_id:scope==='project'?contextProject.value.trim():null,
   record_type:$('#context-type').value,title:$('#context-title').value.trim(),
   content:$('#context-content').value.trim(),
   tags:$('#context-tags').value.split(',').map(tag=>tag.trim()).filter(Boolean).slice(0,20)
  })});
  $('#context-message').textContent='Saved · '+result.record.id;
  $('#context-title').value='';$('#context-content').value='';$('#context-tags').value='';
  await loadContext();notify('Knowledge record saved to the owner-scoped library.');
 }catch(error){$('#context-message').textContent=error.message}
 finally{button.disabled=false}
});
$('#refresh-context').addEventListener('click',loadContext);
$('#context-filter').addEventListener('change',loadContext);
