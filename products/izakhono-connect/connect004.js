(() => {
  const SUPABASE_URL = 'https://yfawrenhudjomhnglfhq.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_3KY--8Y_uuKEdfdumC2txg__OWTRo2p';
  const cx = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_KEY);
  if (!cx) return;
  const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  let currentUser = null;
  let threadRoot = null;

  const style = document.createElement('style');
  style.textContent = `
    .connect004-tools{display:flex;gap:8px;align-items:center;margin-left:auto}
    .connect004-btn{border:1px solid rgba(255,255,255,.12);background:#101823;color:#dce8f4;border-radius:10px;padding:7px 10px;cursor:pointer;font:inherit}
    .connect004-btn:hover{border-color:#2bb7d8}
    .connect004-badge{display:inline-flex;min-width:18px;height:18px;align-items:center;justify-content:center;border-radius:999px;background:#e7b84b;color:#111;font-size:11px;font-weight:800;margin-left:5px}
    .connect004-panel{position:fixed;right:18px;top:70px;width:min(420px,calc(100vw - 36px));max-height:70vh;overflow:auto;z-index:50;background:#0d141e;border:1px solid rgba(255,255,255,.13);border-radius:16px;box-shadow:0 20px 60px #0008;padding:14px}
    .connect004-panel h3{margin:0 0 10px}.connect004-item{padding:10px;border-radius:10px;background:#131d29;margin:7px 0;cursor:pointer}.connect004-item small{display:block;color:#8ea2b5;margin-top:4px}
    .connect004-thread{position:fixed;right:0;top:0;bottom:0;width:min(440px,100vw);z-index:60;background:#0b121a;border-left:1px solid rgba(255,255,255,.12);box-shadow:-20px 0 60px #0008;display:flex;flex-direction:column}
    .connect004-thread-head{padding:16px;border-bottom:1px solid rgba(255,255,255,.1);display:flex;align-items:center;gap:10px}.connect004-thread-head strong{flex:1}.connect004-thread-body{padding:16px;overflow:auto;flex:1}.connect004-root{padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:12px;margin-bottom:14px}.connect004-reply{padding:10px 0;border-bottom:1px solid rgba(255,255,255,.07)}.connect004-reply:last-child{border-bottom:0}.connect004-compose{padding:12px;border-top:1px solid rgba(255,255,255,.1);display:flex;gap:8px}.connect004-compose textarea{flex:1;resize:none;background:#101923;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px}
    .connect004-thread-trigger{opacity:0;float:right;border:0;background:transparent;color:#7fbfd0;cursor:pointer;font-size:11px}.bubble-row:hover .connect004-thread-trigger{opacity:1}
  `;
  document.head.appendChild(style);

  async function user(){ if(currentUser) return currentUser; const {data}=await cx.auth.getUser(); currentUser=data?.user||null; return currentUser; }
  function addTools(){
    if(document.getElementById('connect004-tools')) return;
    const top=document.querySelector('.top'); if(!top) return;
    const box=document.createElement('div'); box.id='connect004-tools'; box.className='connect004-tools';
    box.innerHTML='<button class="connect004-btn" id="connect004-notify">Notifications <span id="connect004-notify-count"></span></button>';
    top.appendChild(box);
    document.getElementById('connect004-notify').onclick=toggleNotifications;
    refreshNotifications();
  }
  async function refreshNotifications(){
    const u=await user(); if(!u) return;
    const {data}=await cx.from('connect_notifications').select('id,title,body,created_at,read_at,message_id').eq('user_id',u.id).order('created_at',{ascending:false}).limit(30);
    const unread=(data||[]).filter(n=>!n.read_at).length; const c=document.getElementById('connect004-notify-count'); if(c)c.innerHTML=unread?`<span class="connect004-badge">${unread}</span>`:'';
    const p=document.getElementById('connect004-notify-panel'); if(p) renderNotifications(data||[],p);
  }
  function renderNotifications(items,p){
    p.innerHTML='<h3>Notifications</h3>'+(items.length?items.map(n=>`<div class="connect004-item" data-notification="${esc(n.id)}" data-message="${esc(n.message_id||'')}"><b>${esc(n.title)}</b><small>${esc(n.body||'')}</small></div>`).join(''):'<div class="connect004-item">No notifications yet.</div>');
    p.querySelectorAll('[data-notification]').forEach(el=>el.onclick=async()=>{await cx.from('connect_notifications').update({read_at:new Date().toISOString()}).eq('id',el.dataset.notification); await refreshNotifications(); if(el.dataset.message) openThread(el.dataset.message);});
  }
  function toggleNotifications(){
    let p=document.getElementById('connect004-notify-panel'); if(p){p.remove();return;}
    p=document.createElement('div');p.id='connect004-notify-panel';p.className='connect004-panel';document.body.appendChild(p);refreshNotifications();
  }
  async function openThread(messageId){
    const u=await user(); if(!u) return;
    const {data:root}=await cx.from('connect_messages').select('id,conversation_id,sender_id,body,created_at').eq('id',messageId).maybeSingle();
    if(!root)return;
    const {data:replies}=await cx.from('connect_messages').select('id,sender_id,body,created_at').eq('parent_message_id',messageId).is('deleted_at',null).order('created_at',{ascending:true});
    closeThread(); threadRoot=document.createElement('aside');threadRoot.className='connect004-thread';
    threadRoot.innerHTML=`<div class="connect004-thread-head"><strong>Thread</strong><button class="connect004-btn" id="connect004-close">Close</button></div><div class="connect004-thread-body"><div class="connect004-root"><b>${root.sender_id===u.id?'You':'Message'}</b><div>${esc(root.body||'')}</div><small>${new Date(root.created_at).toLocaleString()}</small></div><div id="connect004-replies">${renderReplies(replies||[],u.id)}</div></div><form class="connect004-compose" id="connect004-reply-form"><textarea id="connect004-reply" rows="2" maxlength="4000" placeholder="Reply in thread…"></textarea><button class="connect004-btn">Send</button></form>`;
    document.body.appendChild(threadRoot); document.getElementById('connect004-close').onclick=closeThread;
    document.getElementById('connect004-reply-form').onsubmit=async e=>{e.preventDefault();const body=document.getElementById('connect004-reply').value.trim();if(!body)return;const {error}=await cx.from('connect_messages').insert({conversation_id:root.conversation_id,sender_id:u.id,body,message_type:'text',parent_message_id:root.id});if(error){alert(error.message);return;}document.getElementById('connect004-reply').value='';openThread(root.id);};
  }
  function renderReplies(rows,u){return rows.length?rows.map(r=>`<div class="connect004-reply"><b>${r.sender_id===u?'You':'Reply'}</b><div>${esc(r.body||'')}</div><small>${new Date(r.created_at).toLocaleString()}</small></div>`).join(''):'<div class="connect004-item">No replies yet. Start the thread.</div>';}
  function closeThread(){if(threadRoot){threadRoot.remove();threadRoot=null;}}
  function decorateMessages(){
    document.querySelectorAll('.bubble-row').forEach(row=>{
      if(row.querySelector('.connect004-thread-trigger'))return;
      const id=row.id || row.closest('[id]')?.id; if(!id || !/^[0-9a-f-]{20,}$/.test(id))return;
      const b=document.createElement('button');b.className='connect004-thread-trigger';b.textContent='Thread';b.title='Open thread';b.onclick=e=>{e.stopPropagation();openThread(id);};row.appendChild(b);
    });
  }
  async function markVisibleChannelRead(){
    const rows=[...document.querySelectorAll('.bubble-row')]; const id=rows.map(r=>r.id).find(x=>/^[0-9a-f-]{20,}$/.test(x)); if(!id)return;
    const {data:m}=await cx.from('connect_messages').select('conversation_id').eq('id',id).maybeSingle(); if(!m)return;
    const {data:ch}=await cx.from('connect_channels').select('id').eq('conversation_id',m.conversation_id).maybeSingle(); if(ch) await cx.rpc('connect_mark_channel_read',{p_channel_id:ch.id});
  }
  const observer=new MutationObserver(()=>{addTools();decorateMessages();}); observer.observe(document.body,{childList:true,subtree:true});
  setInterval(()=>{addTools();decorateMessages();markVisibleChannelRead();refreshNotifications();},12000);
  addTools(); decorateMessages();
})();
