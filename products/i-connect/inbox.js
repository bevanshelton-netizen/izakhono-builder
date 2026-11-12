(() => {
  const $ = id => document.getElementById(id);
  const state = { organizationId: '', role: 'member', threads: [], activeId: null };
  const escapeText = value => String(value ?? '');
  const dateText = value => value ? new Date(value).toLocaleString() : '';
  const token = () => window.I_CONNECT_SESSION?.access_token || '';
  async function request(url, retry = true, options = {}) {
    const accessToken = token();
    if (!accessToken) throw new Error('Sign in to I-CONNECT to view customer conversations.');
    const response = await fetch(url, { ...options, headers: { Authorization: 'Bearer ' + accessToken, ...(options.headers || {}), ...(options.body ? {'Content-Type':'application/json'} : {}) } });
    if (response.status === 401 && retry && window.I_CONNECT_AUTH?.refresh && await window.I_CONNECT_AUTH.refresh()) return request(url, false, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'The inbox request could not be completed.');
    return data;
  }
  function showEmpty(node, text) { node.replaceChildren(); const div=document.createElement('div'); div.className='empty'; div.textContent=text; node.appendChild(div); }
  function renderThreads() {
    const host=$('threads'); host.replaceChildren();
    if (!state.threads.length) return showEmpty(host,'No conversations match this filter. New conversations appear when an approved channel is connected and events are processed.');
    for (const item of state.threads) {
      const button=document.createElement('button'); button.className='thread'+(item.id===state.activeId?' active':''); button.type='button';
      const line=document.createElement('div'); line.className='thread-line';
      const name=document.createElement('strong'); name.textContent=item.contact?.display_name || item.contact?.phone || item.contact?.email || 'Unknown customer';
      const time=document.createElement('time'); time.textContent=dateText(item.last_message_at || item.created_at);
      line.append(name,time);
      const preview=document.createElement('p'); preview.textContent=item.subject || item.contact?.phone || item.contact?.email || 'Conversation opened';
      const channel=document.createElement('div'); channel.className='channel'; channel.textContent=item.channel+' · '+item.priority+' priority';
      button.append(line,preview,channel); button.addEventListener('click',()=>loadMessages(item.id)); host.appendChild(button);
    }
  }
  async function manageThread(threadId, action, extra = {}) {
    try {
      await request('/api/inbox/threads/' + encodeURIComponent(threadId) + '/actions?organizationId=' + encodeURIComponent(state.organizationId), false, {
        method: 'POST',
        body: JSON.stringify({ organizationId: state.organizationId, action, ...extra })
      });
      await loadThreads();
    } catch (error) { window.alert(error.message); }
  }
  async function loadThreads() {
    if (!state.organizationId) return;
    $('threads').textContent='Loading conversations…';
    const status=$('filter').value;
    try {
      const url='/api/inbox/threads?organizationId='+encodeURIComponent(state.organizationId)+'&status='+encodeURIComponent(status)+'&limit=75';
      const data=await request(url); state.threads=data.threads||[];
      if (!state.threads.some(item=>item.id===state.activeId)) state.activeId=null;
      renderThreads();
      if (state.activeId) await loadMessages(state.activeId);
      else { $('conversationHead').textContent=''; const h=document.createElement('div'); const title=document.createElement('h2'); title.textContent='Select a conversation'; const sub=document.createElement('p'); sub.textContent='Customer messages will appear here.'; h.append(title,sub); $('conversationHead').appendChild(h); showEmpty($('messages'),'Choose a conversation from the left to view its history.'); }
    } catch(error) { showEmpty($('threads'),error.message); }
  }
  async function loadMessages(id) {
    state.activeId=id; renderThreads();
    const item=state.threads.find(thread=>thread.id===id);
    const head=$('conversationHead'); head.replaceChildren();
    const details=document.createElement('div'); const title=document.createElement('h2'); title.textContent=item?.contact?.display_name || item?.contact?.phone || item?.contact?.email || 'Customer conversation';
    const sub=document.createElement('p'); sub.textContent=(item?.channel||'channel')+' · '+(item?.status||'open')+' · '+(item?.priority||'normal')+' priority';
    details.append(title,sub);
    const actions=document.createElement('div'); actions.className='thread-actions';
    const makeAction=(label,action,extra={})=>{const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=label;button.addEventListener('click',()=>manageThread(id,action,extra));actions.appendChild(button);};
    if (item?.assigned_to === window.I_CONNECT_SESSION?.user?.id) makeAction('Release','release');
    else if (!item?.assigned_to) makeAction('Claim conversation','claim');
    if (['owner','admin','manager'].includes(state.role)) {
      if (item?.status !== 'closed') makeAction('Close','status',{status:'closed'});
      else makeAction('Reopen','status',{status:'open'});
      makeAction('Mark urgent','priority',{priority:'urgent'});
    } else if (item?.assigned_to === window.I_CONNECT_SESSION?.user?.id) {
      makeAction(item?.status === 'waiting_customer' ? 'Reopen' : 'Waiting for customer','status',{status:item?.status === 'waiting_customer' ? 'open' : 'waiting_customer'});
    }
    const badge=document.createElement('span'); badge.className='status'; badge.textContent=item?.status||'open'; head.append(details,actions,badge);
    const host=$('messages'); showEmpty(host,'Loading conversation history…');
    try {
      const data=await request('/api/inbox/threads/'+encodeURIComponent(id)+'/messages?organizationId='+encodeURIComponent(state.organizationId));
      host.replaceChildren();
      if (!(data.messages||[]).length) return showEmpty(host,'No messages have been stored for this conversation yet.');
      for (const msg of data.messages) {
        const bubble=document.createElement('div'); bubble.className='bubble '+msg.direction;
        bubble.textContent=msg.body || '['+msg.message_type+' message]';
        const time=document.createElement('time'); time.textContent=(msg.direction||'message')+' · '+dateText(msg.provider_timestamp||msg.created_at);
        bubble.appendChild(time); host.appendChild(bubble);
      }
      host.scrollTop=host.scrollHeight;
    } catch(error) { showEmpty(host,error.message); }
  }
  async function loadOrganizations() {
    try {
      const data=await request('/api/automation/organizations');
      const select=$('org'); select.replaceChildren();
      for (const org of data.organizations||[]) { const option=document.createElement('option'); option.value=org.id; option.textContent=org.name; option.dataset.role=org.role||'member'; select.appendChild(option); }
      if (!select.options.length) { showEmpty($('threads'),'Your sign-in has no active organisation membership yet. Ask an IZAKHONO administrator to provision access.'); return; }
      state.organizationId=select.value; state.role=select.selectedOptions[0]?.dataset.role||'member'; await loadThreads();
    } catch(error) { showEmpty($('threads'),error.message); }
  }
  $('org').addEventListener('change',async()=>{state.organizationId=$('org').value;state.role=$('org').selectedOptions[0]?.dataset.role||'member';state.activeId=null;await loadThreads();});
  $('filter').addEventListener('change',loadThreads);
  $('refresh').addEventListener('click',loadThreads);
  window.addEventListener('i-connect-auth-ready',loadOrganizations);
  if (window.I_CONNECT_AUTH_READY) window.I_CONNECT_AUTH_READY.then(loadOrganizations);
})();