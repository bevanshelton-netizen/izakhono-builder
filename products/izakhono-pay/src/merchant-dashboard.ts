export function renderMerchantLogin(merchantId: string) {
  const safeId = merchantId.replace(/[^A-Za-z0-9_-]/g, '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>I-PAY™ — Merchant Sign In | by IZAKHONO</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:22px;background:radial-gradient(circle at 15% 10%,#155e75 0,transparent 32%),radial-gradient(circle at 85% 20%,#7c3aed 0,transparent 28%),linear-gradient(160deg,#04100c,#07131d 58%,#120b20);color:#f8fafc}.box{width:min(100%,460px);padding:30px;border:1px solid #ffffff24;border-radius:25px;background:#0b1726ed;box-shadow:0 30px 90px #0008}.brand{font-size:30px;font-weight:950;letter-spacing:-.05em}.brand span{color:#68e0c1}.byline{font-size:10px;letter-spacing:.16em;color:#9aabc0;font-weight:800}.eyebrow{margin-top:30px;color:#68e0c1;font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}h1{font-size:32px;letter-spacing:-.05em;margin:9px 0}p{color:#a9bac9;line-height:1.6;font-size:13px}label{display:block;margin:20px 0 8px;color:#cbd5e1;font-size:12px;font-weight:800}input{width:100%;padding:14px;border-radius:12px;border:1px solid #ffffff30;background:#07111d;color:#fff;font:inherit}button{width:100%;margin-top:14px;padding:14px;border:0;border-radius:12px;background:linear-gradient(110deg,#68e0c1,#e8c27a);color:#07111d;font-weight:900;cursor:pointer}button:disabled{opacity:.6;cursor:wait}#message{min-height:22px;margin-top:14px;color:#fca5a5;font-size:12px}.foot{margin-top:22px;color:#8294a8;font-size:11px}
</style></head><body><main class="box">
<div class="brand">I-<span>PAY™</span></div><div class="byline">BY IZAKHONO</div>
<div class="eyebrow">Merchant workspace</div><h1>Welcome back.</h1>
<p>Sign in to your I-PAY merchant control centre using an active merchant API key. Your key is sent only to the secure sign-in endpoint and is not saved in this browser.</p>
<form id="loginForm"><label for="apiKey">Merchant API key</label><input id="apiKey" type="password" name="api_key" autocomplete="off" spellcheck="false" required><button id="submit" type="submit">Sign in securely</button></form>
<div id="message" role="status" aria-live="polite"></div>
<div class="foot">Access is restricted to the merchant account associated with this key. Never share your API key.</div>
</main><script>
const merchantId=${JSON.stringify(safeId)};
const form=document.querySelector('#loginForm'),button=document.querySelector('#submit'),message=document.querySelector('#message'),field=document.querySelector('#apiKey');
form.addEventListener('submit',async(event)=>{event.preventDefault();message.textContent='';button.disabled=true;button.textContent='Signing in…';const apiKey=field.value;field.value='';try{const response=await fetch('/dashboard/'+encodeURIComponent(merchantId)+'/login',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({api_key:apiKey})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error==='invalid_merchant_credentials'?'The merchant API key was not recognised.':'Sign-in could not be completed.');location.replace('/dashboard/'+encodeURIComponent(merchantId));}catch(error){message.textContent=error.message||'Sign-in failed.';button.disabled=false;button.textContent='Sign in securely';}});
</script></body></html>`;
}

export function renderMerchantDashboard(merchantId: string) {
  const safeId = merchantId.replace(/[^A-Za-z0-9_-]/g, '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>I-PAY™ — Merchant Console | by IZAKHONO</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{margin:0;background:#070914;color:#f6f8ff}main{max-width:1180px;margin:auto;padding:32px 20px}.top{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:28px}.brand{font-weight:900;letter-spacing:.08em}.brand span{color:#63e6ff}.sub{color:#8f98b5;font-size:14px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card{background:#11162a;border:1px solid #252c47;border-radius:20px;padding:20px}.label{color:#8f98b5;font-size:13px}.value{font-size:28px;font-weight:900;margin-top:8px}.wide{grid-column:1/-1}.status{display:inline-flex;padding:6px 10px;border-radius:999px;background:#17243b;color:#63e6ff;font-size:12px;font-weight:800}.provider{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #252c47}.provider:last-child{border-bottom:0}.ok{color:#b9ff67}.warn{color:#ffd166}.err{color:#ff7b8b}.error{color:#ff7b8b}.loading{color:#8f98b5}.key{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:12px 0;border-bottom:1px solid #252c47}.key:last-child{border-bottom:0}.btn{border:1px solid #35405f;background:#18203a;color:#fff;border-radius:10px;padding:9px 12px;font-weight:800;cursor:pointer}.btn:hover{border-color:#63e6ff}.secret{margin-top:12px;padding:14px;border-radius:12px;background:#091b21;border:1px solid #2a6570;word-break:break-all}.form{display:flex;gap:10px;margin-top:14px}.input{flex:1;background:#090d1b;border:1px solid #2a3351;color:#fff;border-radius:10px;padding:11px}.small{font-size:12px;color:#8f98b5}@media(max-width:760px){.grid{grid-template-columns:1fr}.wide{grid-column:auto}.top{align-items:flex-start;flex-direction:column}.form{flex-direction:column}.key{align-items:flex-start;flex-direction:column}}
</style></head><body><main>
<div class="top"><div><div class="brand">I-<span>PAY™</span></div><div class="sub">by IZAKHONO · Merchant Control Centre</div></div><div id="status" class="status">Loading…</div></div>
<div id="app" class="grid"><div class="card wide loading">Loading merchant control centre…</div></div>
</main>
<script>
const merchantId=${JSON.stringify(safeId)};
const money=(n,c='ZAR')=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:c}).format(Number(n||0));
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path,options={}){const r=await fetch(path,{credentials:'same-origin',...options});let d=null;try{d=await r.json()}catch{}return {r,d}}
async function loadKeys(){const {r,d}=await api('/v1/merchants/'+encodeURIComponent(merchantId)+'/api-keys');if(!r.ok)throw new Error('keys');return d.data||[]}
async function createKey(){const label=document.getElementById('keyLabel').value.trim()||'Primary API key';const {r,d}=await api('/v1/merchants/'+encodeURIComponent(merchantId)+'/api-keys',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({label})});const out=document.getElementById('keyOut');if(!r.ok){out.innerHTML='<div class="error">Unable to create API key.</div>';return}out.innerHTML='<div class="secret"><strong>New API key — copy it now.</strong><br>'+esc(d.api_key)+'</div><div class="small">This secret will not be shown again.</div>';document.getElementById('keyLabel').value='';await renderKeys()}
async function revokeKey(id){if(!confirm('Revoke this API key?'))return;const {r}=await api('/v1/merchants/'+encodeURIComponent(merchantId)+'/api-keys/'+encodeURIComponent(id)+'/revoke',{method:'POST'});if(!r.ok){alert('Unable to revoke API key.');return}await renderKeys()}
async function renderKeys(){const keys=await loadKeys();const box=document.getElementById('keys');box.innerHTML=keys.length?keys.map(k=>'<div class="key"><div><strong>'+esc(k.label)+'</strong><div class="small">'+esc(k.key_prefix)+' · '+esc(k.status)+' · created '+esc(k.created_at)+'</div></div>'+(k.status==='active'?'<button class="btn" onclick="revokeKey('+JSON.stringify(k.id)+')">Revoke</button>':'<span class="small">Revoked</span>')+'</div>').join(''):'<div class="sub">No API keys issued yet.</div>'}
async function load(){
 const [{r,d},keys]=await Promise.all([api('/v1/merchants/'+encodeURIComponent(merchantId)+'/control-centre'),loadKeys()]);
 if(!r.ok){document.getElementById('app').innerHTML='<div class="card wide error">Unable to load merchant data.</div>';return}
 const f=d.financials||{}; const providers=d.providers||[];
 document.getElementById('status').textContent=esc(d.merchant?.status||'unknown');
 document.getElementById('app').innerHTML=
 '<div class="card"><div class="label">Processed volume</div><div class="value">'+money(f.processedVolume,d.currency)+'</div></div>'+\
 '<div class="card"><div class="label">Pending volume</div><div class="value">'+money(f.pendingVolume,d.currency)+'</div></div>'+\
 '<div class="card"><div class="label">Settled net</div><div class="value">'+money(f.settledNet,d.currency)+'</div></div>'+\
 '<div class="card"><div class="label">Transactions</div><div class="value">'+Number(f.transactions||0).toLocaleString()+'</div></div>'+\
 '<div class="card"><div class="label">Active payment links</div><div class="value">'+Number(f.activePaymentLinks||0).toLocaleString()+'</div></div>'+\
 '<div class="card"><div class="label">Requested refunds</div><div class="value">'+Number(f.requestedRefunds||0).toLocaleString()+'</div></div>'+\
 '<div class="card"><div class="label">KYB checks</div><div class="value">'+Number(d.compliance?.kybChecks||0).toLocaleString()+'</div></div>'+\
 '<div class="card wide"><div class="label">Provider health</div>'+ (providers.length?providers.map(p=>'<div class="provider"><span>'+esc(p.provider)+'</span><span class="'+(p.status==='healthy'?'ok':p.status==='degraded'?'warn':'err')+'">'+esc(p.status)+' · '+Number(p.failure_count||0)+' failures</span></div>').join(''):'<div class="sub" style="margin-top:12px">No provider health records.</div>')+'</div>'+\
 '<div class="card wide"><div class="label">API keys</div><div class="sub" style="margin-top:8px">Programmatic credentials for your merchant integrations. Raw secrets are shown only once.</div><div class="form"><input id="keyLabel" class="input" maxlength="120" placeholder="Key label, e.g. Production integration"><button class="btn" onclick="createKey()">Create API key</button></div><div id="keyOut"></div><div id="keys" style="margin-top:16px">'+(keys.length?keys.map(k=>'<div class="key"><div><strong>'+esc(k.label)+'</strong><div class="small">'+esc(k.key_prefix)+' · '+esc(k.status)+' · created '+esc(k.created_at)+'</div></div>'+(k.status==='active'?'<button class="btn" onclick="revokeKey('+JSON.stringify(k.id)+')">Revoke</button>':'<span class="small">Revoked</span>')+'</div>').join(''):'<div class="sub">No API keys issued yet.</div>')+'</div></div>';
}
load().catch(()=>{document.getElementById('app').innerHTML='<div class="card wide error">Control centre unavailable.</div>'});
</script></body></html>`;
}
