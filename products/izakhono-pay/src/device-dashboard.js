export function renderDeviceDashboard() {
  return String.raw\`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#080d1b">
<meta name="description" content="I-PAY turns your phone, tablet or computer into a merchant payment workspace.">
<link rel="manifest" href="/device.webmanifest">
<link rel="icon" href="/device-icon.svg" type="image/svg+xml">
<title>I-PAY Mobile — Merchant workspace</title>
<style>
:root{color-scheme:dark;--bg:#080d1b;--panel:#111a2d;--panel2:#17233b;--line:#263650;--ink:#f4f7ff;--muted:#9eacc4;--cyan:#69e4ee;--blue:#7d9cff;--green:#9ce6b0;--amber:#ffd28b;--red:#ff9a9a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 15% -5%,#1c3156 0,transparent 38%),var(--bg);color:var(--ink);min-height:100vh}button,input{font:inherit}button{cursor:pointer}.shell{max-width:1180px;margin:auto;padding:env(safe-area-inset-top) 20px calc(28px + env(safe-area-inset-bottom))}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 0;border-bottom:1px solid var(--line)}.brand{font-weight:950;letter-spacing:.08em;font-size:20px}.brand span{color:var(--cyan)}.topnote{font-size:12px;color:var(--muted);text-align:right}.device-pill,.pill{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:#101a2b;border-radius:999px;padding:7px 11px;color:var(--muted);font-size:11px;font-weight:750}.led{width:7px;height:7px;border-radius:50%;background:var(--green)}.hero{padding:34px 0 22px;display:flex;align-items:end;justify-content:space-between;gap:20px}.eyebrow{color:var(--cyan);font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.hero h1{font-size:clamp(32px,5vw,52px);letter-spacing:-.055em;line-height:1;margin:10px 0}.hero p{color:var(--muted);max-width:620px;margin:0;line-height:1.6}.hero-actions{display:flex;gap:8px;flex-wrap:wrap}.btn{border:1px solid var(--line);background:#17233a;color:var(--ink);padding:11px 14px;border-radius:12px;font-size:13px;font-weight:800}.btn.primary{background:linear-gradient(110deg,var(--cyan),#91b4ff);color:#07111e;border:0}.btn:disabled{opacity:.5;cursor:not-allowed}.layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,.8fr);gap:16px}.stack{display:grid;gap:16px}.card{background:linear-gradient(160deg,#14213a,#10182a);border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:0 18px 50px #0002}.card h2{font-size:18px;margin:0 0 5px;letter-spacing:-.02em}.sub{font-size:12px;color:var(--muted);line-height:1.5}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}.metric{background:#0c1525;border:1px solid #23334c;border-radius:15px;padding:14px;min-width:0}.metric small{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.1em}.metric strong{display:block;font-size:clamp(18px,2.4vw,25px);margin-top:5px;overflow-wrap:anywhere}.section-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:15px}.field{display:grid;gap:6px;margin:12px 0}.field label{font-size:10px;color:var(--muted);font-weight:850;letter-spacing:.1em;text-transform:uppercase}.field input{width:100%;background:#091222;border:1px solid #2a3b56;border-radius:11px;color:var(--ink);padding:13px;outline:none}.field input:focus{border-color:var(--cyan);box-shadow:0 0 0 3px #69e4ee18}.formgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.notice{font-size:11px;line-height:1.5;color:#c1cce0;background:#101d31;border:1px solid #263b57;border-radius:12px;padding:11px;margin-top:12px}.notice.warn{color:var(--amber)}.message{font-size:12px;color:var(--muted);min-height:18px;margin-top:9px}.link-result{display:none;margin-top:15px;border:1px solid #34506a;background:#0b1728;border-radius:15px;padding:14px}.link-url{font:12px/1.5 ui-monospace,monospace;overflow-wrap:anywhere;color:var(--cyan);margin:8px 0 12px}.link-actions{display:flex;gap:8px;flex-wrap:wrap}.qrwrap{display:none;text-align:center;margin-top:14px}.qrwrap canvas{background:#fff;border-radius:12px;padding:10px;max-width:100%;height:auto}.transactions{display:grid;gap:8px}.tx{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border:1px solid #253650;background:#0d1728;border-radius:13px}.tx-title{font-size:13px;font-weight:800;overflow-wrap:anywhere}.tx-meta{font-size:10px;color:var(--muted);margin-top:4px}.tx-side{text-align:right}.tx-amount{font-size:13px;font-weight:850}.state{font-size:10px;font-weight:850;text-transform:uppercase;color:var(--green);margin-top:4px}.state.pending{color:var(--amber)}.state.failed{color:var(--red)}.empty{color:var(--muted);font-size:12px;padding:16px;text-align:center;border:1px dashed #34445c;border-radius:12px}.connect{max-width:560px;margin:38px auto}.connect .card{padding:24px}.connect h1{font-size:30px;letter-spacing:-.04em;margin:8px 0}.hidden{display:none!important}.footer{padding:25px 0 10px;color:#73839e;font-size:10px;line-height:1.6}.device-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:14px}.device-tile{border:1px solid #263650;background:#0c1729;border-radius:13px;padding:12px}.device-tile b{display:block;font-size:12px}.device-tile span{display:block;color:var(--muted);font-size:10px;margin-top:4px}.offline{color:var(--amber)}@media(max-width:800px){.layout{grid-template-columns:1fr}.hero{display:block}.hero-actions{margin-top:16px}.topnote{max-width:150px}}@media(max-width:520px){.shell{padding-left:14px;padding-right:14px}.top{padding:14px 0}.brand{font-size:17px}.hero{padding-top:26px}.card{padding:16px;border-radius:17px}.metrics{gap:7px}.metric{padding:11px}.metric strong{font-size:17px}.formgrid{grid-template-columns:1fr}.device-grid{grid-template-columns:1fr}.btn{padding:11px 12px}}
</style>
</head>
<body>
<div id="connect" class="shell connect">
  <div class="top"><div class="brand">I-PAY<span>™</span></div><div class="device-pill"><i class="led"></i> DEVICE WORKSPACE</div></div>
  <section class="card" style="margin-top:26px">
    <div class="eyebrow">YOUR BUSINESS. ANY DEVICE.</div>
    <h1>Take payments from the devices you already own.</h1>
    <p class="sub">Connect your merchant account to open your I-PAY workspace on a phone, tablet or computer.</p>
    <form id="connectForm">
      <div class="field"><label for="merchantId">Merchant account ID</label><input id="merchantId" autocomplete="username" required placeholder="Your I-PAY merchant ID"></div>
      <div class="field"><label for="apiKey">Merchant API key</label><input id="apiKey" type="password" autocomplete="current-password" required placeholder="Your private merchant API key"></div>
      <button class="btn primary" style="width:100%;margin-top:8px" type="submit">Connect securely</button>
      <div id="connectMessage" class="message" role="status"></div>
    </form>
    <div class="notice">Your API key stays in this page's memory only. It is not written to browser storage. Use only your own merchant credentials and sign out when finished on a shared device.</div>
  </section>
  <div class="footer">I-PAY is payment orchestration software, not a bank or card scheme. Payment methods depend on your approved payment provider and merchant agreement.</div>
</div>
<div id="app" class="shell hidden">
  <header class="top"><div><div class="brand">I-PAY<span>™</span></div><div class="sub">Merchant workspace</div></div><div class="topnote"><span class="device-pill"><i class="led" id="onlineLed"></i><span id="deviceType">DEVICE READY</span></span><div id="connectionState" style="margin-top:6px">Connected</div></div></header>
  <section class="hero"><div><div class="eyebrow">ONE MERCHANT ACCOUNT · EVERY SCREEN</div><h1>Payments, wherever business happens.</h1><p>Use this device to create payment links, show customer QR codes, review transactions and print simple receipts.</p></div><div class="hero-actions"><button id="refresh" class="btn">Refresh activity</button><button id="install" class="btn hidden">Install I-PAY</button><button id="logout" class="btn">Sign out</button></div></section>
  <div class="layout">
    <div class="stack">
      <section class="card">
        <div class="section-head"><div><h2>Business overview</h2><div class="sub" id="merchantLabel">Connected merchant</div></div><span class="pill">LIVE DATA</span></div>
        <div class="metrics"><div class="metric"><small>Transactions</small><strong id="mTransactions">—</strong></div><div class="metric"><small>Processed volume</small><strong id="mVolume">—</strong></div><div class="metric"><small>Awaiting payment</small><strong id="mPending">—</strong></div></div>
      </section>
      <section class="card">
        <div class="section-head"><div><h2>Recent activity</h2><div class="sub">Provider-confirmed transaction records</div></div><span class="pill" id="txCount">0 ITEMS</span></div>
        <div id="transactions" class="transactions"><div class="empty">Connect and refresh to load activity.</div></div>
        <div class="message" id="activityMessage" role="status"></div>
      </section>
    </div>
    <aside class="stack">
      <section class="card">
        <div class="eyebrow">COLLECT A PAYMENT</div><h2 style="margin-top:7px">Create a payment link</h2><p class="sub">Set an amount and share a hosted checkout link with your customer.</p>
        <form id="linkForm">
          <div class="field"><label for="linkTitle">What is this payment for?</label><input id="linkTitle" maxlength="160" required placeholder="e.g. Order 1048"></div>
          <div class="formgrid"><div class="field"><label for="linkAmount">Amount (ZAR)</label><input id="linkAmount" type="number" min="1" max="1000000" step="0.01" inputmode="decimal" required placeholder="250.00"></div><div class="field"><label for="linkCurrency">Currency</label><input id="linkCurrency" value="ZAR" readonly></div></div>
          <button id="createLink" class="btn primary" style="width:100%" type="submit">Create secure payment link</button>
          <div id="linkMessage" class="message" role="status"></div>
        </form>
        <div id="linkResult" class="link-result">
          <b>Payment link ready</b><div id="linkUrl" class="link-url"></div>
          <div class="link-actions"><button id="copyLink" class="btn">Copy link</button><button id="shareLink" class="btn">Share</button><button id="showQr" class="btn">Show QR</button></div>
          <div id="qrWrap" class="qrwrap"><canvas id="qrCanvas" width="240" height="240"></canvas><div class="sub" style="margin-top:8px">Customer scans this code with their phone camera.</div></div>
        </div>
        <div class="notice warn">Creating a link does not mean a payment has been made. Only verified confirmation from the connected payment provider can mark a transaction paid.</div>
      </section>
      <section class="card">
        <h2>Works across your devices</h2><p class="sub">No dedicated terminal is needed for these software features.</p>
        <div class="device-grid"><div class="device-tile"><b>Phone</b><span>Share links, display QR, review activity.</span></div><div class="device-tile"><b>Tablet</b><span>Counter checkout and customer-facing QR.</span></div><div class="device-tile"><b>Computer</b><span>Business overview and printable receipts.</span></div></div>
        <div class="notice">Tap-to-Pay / Tap-to-Phone is not enabled here. It requires an approved acquiring partner, supported device, certified solution and explicit activation.</div>
      </section>
    </aside>
  </div>
  <footer class="footer">I-PAY device workspace · Provider processing and settlement remain with your approved payment partner. No card number, CVV or bank login is collected by this page.</footer>
</div>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js" defer></script>
<script>
(function(){
  var merchantId='',apiKey='',currentLink='',deferredInstall=null;
  var $=function(id){return document.getElementById(id)};
  var money=function(value){return 'R '+Number(value||0).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2})};
  var api=async function(path,options){
    options=options||{};options.headers=Object.assign({'authorization':'Bearer '+apiKey,'content-type':'application/json'},options.headers||{});
    var response=await fetch(path,options),data=await response.json().catch(function(){return {}});
    if(!response.ok)throw new Error((data.error&&data.error.message)||data.error||'Request failed ('+response.status+')');
    return data;
  };
  var showMessage=function(id,message,isError){$(id).textContent=message||'';$(id).style.color=isError?'#ff9a9a':''};
  var safeNode=function(tag,className,text){var node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node};
  var deviceName=function(){var ua=navigator.userAgent||'';if(/ipad|tablet/i.test(ua)||(/android/i.test(ua)&&!/mobile/i.test(ua)))return 'TABLET';if(/mobile|iphone|android/i.test(ua))return 'MOBILE';return 'DESKTOP'};
  $('deviceType').textContent=deviceName()+' · READY';
  var loadData=async function(){
    $('refresh').disabled=true;showMessage('activityMessage','Refreshing merchant activity…');
    try{
      var results=await Promise.all([api('/v1/merchants/'+encodeURIComponent(merchantId)+'/summary'),api('/v1/merchants/'+encodeURIComponent(merchantId)+'/transactions?limit=20')]);
      var summary=results[0],rows=results[1].data||[];
      $('mTransactions').textContent=Number(summary.transactions||0).toLocaleString();
      $('mVolume').textContent=money(summary.processed_volume);
      $('mPending').textContent=money(summary.pending_volume);
      $('txCount').textContent=rows.length+' ITEMS';
      $('merchantLabel').textContent='Merchant '+merchantId+' · '+(summary.currency||'ZAR');
      var list=$('transactions');list.replaceChildren();
      if(!rows.length)list.appendChild(safeNode('div','empty','No transactions to display yet.'));
      rows.forEach(function(row){
        var item=safeNode('div','tx'),left=safeNode('div',''),right=safeNode('div','tx-side');
        left.appendChild(safeNode('div','tx-title',row.description||row.id||'Payment'));
        left.appendChild(safeNode('div','tx-meta',(row.provider||'Payment provider')+' · '+(row.created_at?new Date(row.created_at).toLocaleString():'Date unavailable')));
        right.appendChild(safeNode('div','tx-amount',money(row.amount)+' '+(row.currency||'ZAR')));
        var state=safeNode('div','state '+(['failed','reversed','disputed'].indexOf(String(row.status).toLowerCase())>=0?'failed':(['initiated','pending','authorised'].indexOf(String(row.status).toLowerCase())>=0?'pending':'')),String(row.status||'unknown').replaceAll('_',' '));
        right.appendChild(state);
        if(String(row.status).toLowerCase()==='paid'||String(row.status).toLowerCase()==='settled'||String(row.status).toLowerCase()==='authorised'){
          var receipt=safeNode('button','btn','Receipt');receipt.type='button';receipt.style.marginTop='7px';receipt.addEventListener('click',function(){printReceipt(row)});right.appendChild(receipt);
        }
        item.appendChild(left);item.appendChild(right);list.appendChild(item);
      });
      showMessage('activityMessage','Updated just now.');
    }catch(error){showMessage('activityMessage',error.message,true)}
    finally{$('refresh').disabled=false}
  };
  var printReceipt=function(row){
    var w=window.open('','_blank','noopener,noreferrer');if(!w){showMessage('activityMessage','Allow pop-ups to print a receipt.',true);return}
    var doc=w.document;doc.open();doc.write('<!doctype html><html><head><title>I-PAY receipt</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:15px system-ui;max-width:520px;margin:40px auto;padding:20px;color:#111}.brand{font-weight:900;font-size:22px}.muted{color:#555}.line{border-top:1px solid #ddd;margin:20px 0}.amount{font-size:28px;font-weight:900}</style></head><body><div class="brand">I-PAY</div><p class="muted">Transaction receipt · Merchant copy</p><div class="line"></div><p>Reference<br><b>'+escapeHtml(row.id||'')+'</b></p><p>Description<br><b>'+escapeHtml(row.description||'Payment')+'</b></p><p>Status<br><b>'+escapeHtml(row.status||'Unknown')+'</b></p><p>Provider<br><b>'+escapeHtml(row.provider||'—')+'</b></p><p>Date<br><b>'+escapeHtml(row.created_at||'—')+'</b></p><div class="line"></div><div class="amount">'+escapeHtml(money(row.amount)+' '+(row.currency||'ZAR'))+'</div><p class="muted">This receipt reflects the transaction status recorded by I-PAY. It is not proof of settlement unless the status explicitly confirms settlement.</p><script>window.onload=function(){window.print()}<\/script></body></html>');doc.close();
  };
  var escapeHtml=function(value){return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  $('connectForm').addEventListener('submit',async function(event){
    event.preventDefault();merchantId=$('merchantId').value.trim();apiKey=$('apiKey').value.trim();showMessage('connectMessage','Checking merchant access…');
    try{await api('/v1/merchants/'+encodeURIComponent(merchantId));$('connect').classList.add('hidden');$('app').classList.remove('hidden');$('apiKey').value='';await loadData()}
    catch(error){apiKey='';showMessage('connectMessage',error.message,true)}
  });
  $('linkForm').addEventListener('submit',async function(event){
    event.preventDefault();var amount=Number($('linkAmount').value),title=$('linkTitle').value.trim();if(!Number.isFinite(amount)||amount<=0){showMessage('linkMessage','Enter a valid amount.',true);return}
    $('createLink').disabled=true;showMessage('linkMessage','Creating payment link…');
    try{
      var result=await api('/v1/payment-links',{method:'POST',body:JSON.stringify({merchant_id:merchantId,amount:amount,currency:'ZAR',title:title})});
      currentLink=new URL(result.url,location.origin).toString();$('linkUrl').textContent=currentLink;$('linkResult').style.display='block';$('qrWrap').style.display='none';showMessage('linkMessage','Link created. Share it with your customer.');$('linkAmount').value='';await loadData();
    }catch(error){showMessage('linkMessage',error.message,true)}
    finally{$('createLink').disabled=false}
  });
  $('copyLink').addEventListener('click',async function(){if(!currentLink)return;try{await navigator.clipboard.writeText(currentLink);showMessage('linkMessage','Payment link copied.')}catch(error){showMessage('linkMessage','Copy is unavailable. Select and copy the link above.',true)}});
  $('shareLink').addEventListener('click',async function(){if(!currentLink)return;if(navigator.share){try{await navigator.share({title:'I-PAY payment link',text:'Complete your payment securely:',url:currentLink})}catch(error){if(error.name!=='AbortError')showMessage('linkMessage','Sharing was not available.',true)}}else{try{await navigator.clipboard.writeText(currentLink);showMessage('linkMessage','Sharing is not supported here. Link copied instead.')}catch(error){showMessage('linkMessage','Use Copy link to share this checkout.',true)}}});
  $('showQr').addEventListener('click',function(){
    if(!currentLink)return;$('qrWrap').style.display='block';
    if(window.QRCode&&window.QRCode.toCanvas){window.QRCode.toCanvas($('qrCanvas'),currentLink,{width:240,margin:1,errorCorrectionLevel:'M'},function(error){if(error)showMessage('linkMessage','QR could not be generated on this device.',true)})}
    else showMessage('linkMessage','QR generator is unavailable. Copy or share the payment link instead.',true);
  });
  $('refresh').addEventListener('click',loadData);
  $('logout').addEventListener('click',function(){merchantId='';apiKey='';currentLink='';$('app').classList.add('hidden');$('connect').classList.remove('hidden');$('merchantId').value='';$('apiKey').value='';$('linkResult').style.display='none';$('connectMessage').textContent='Signed out. Your credentials have been cleared from memory.'});
  window.addEventListener('online',function(){$('connectionState').textContent='Connected';$('onlineLed').classList.remove('offline')});
  window.addEventListener('offline',function(){$('connectionState').textContent='Offline · live data unavailable';$('onlineLed').classList.add('offline')});
  window.addEventListener('beforeinstallprompt',function(event){event.preventDefault();deferredInstall=event;$('install').classList.remove('hidden')});
  $('install').addEventListener('click',async function(){if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('install').classList.add('hidden')});
  if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/device-sw.js').catch(function(){});
})();
</script>
</body></html>\`;
}

export const DEVICE_MANIFEST = {
  name: 'I-PAY Merchant Workspace',
  short_name: 'I-PAY',
  description: 'Your merchant payment workspace on any device.',
  start_url: '/devices',
  scope: '/',
  display: 'standalone',
  background_color: '#080d1b',
  theme_color: '#080d1b',
  icons: [{ src: '/device-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
};

export const DEVICE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#080d1b"/><path d="M112 146h288v58H112zm0 81h58v139h-58zm115 0h58v139h-58zm115 0h58v139h-58z" fill="#69e4ee"/><path d="M112 402h288v24H112z" fill="#91b4ff"/></svg>';

export const DEVICE_SERVICE_WORKER = String.raw\`const CACHE='ipay-device-shell-v1';
const SHELL=['/devices','/device.webmanifest','/device-icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||!SHELL.includes(url.pathname))return;
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}
    return response;
  })));
});\`;
