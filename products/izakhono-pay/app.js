const API='https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-payment-health';
const TEST_KEY='izp_test_IZAKHONO_DEMO_2026';
const modal=document.querySelector('#modal');
const merchantModal=document.querySelector('#merchantModal');
const open=()=>modal.classList.remove('hidden');
const close=()=>modal.classList.add('hidden');
const openMerchant=()=>merchantModal.classList.remove('hidden');
const closeMerchant=()=>merchantModal.classList.add('hidden');
document.querySelector('#demoBtn').onclick=open;
document.querySelector('#merchantBtn').onclick=openMerchant;
document.querySelector('#merchantCta').onclick=openMerchant;
document.querySelector('#close').onclick=close;
document.querySelector('#merchantClose').onclick=closeMerchant;
modal.addEventListener('click',e=>{if(e.target===modal)close()});
merchantModal.addEventListener('click',e=>{if(e.target===merchantModal)closeMerchant()});
const money=(minor,currency='ZAR')=>new Intl.NumberFormat('en-ZA',{style:'currency',currency}).format(Number(minor||0)/100);
const apiFetch=(path,options={})=>fetch(API+path,{...options,headers:{'content-type':'application/json','x-api-key':TEST_KEY,...(options.headers||{})}});

document.querySelector('#createPayment').onclick=async()=>{
  const result=document.querySelector('#result');
  const amount=Math.round(Number(document.querySelector('#amount').value)*100);
  const description=document.querySelector('#description').value.trim();
  const email=document.querySelector('#email').value.trim();
  if(!Number.isSafeInteger(amount)||amount<=0){result.className='result error';result.textContent='Enter a valid amount.';return}
  result.className='result';result.textContent='Creating secure test payment…';
  const idem='demo-'+crypto.randomUUID();
  try{
    const r=await apiFetch('/v1/payment-intents',{method:'POST',headers:{'idempotency-key':idem},body:JSON.stringify({amount_minor:amount,currency:'ZAR',description,customer_email:email,metadata:{source:'izakhono-pay-demo'}})});
    const d=await r.json();if(!r.ok)throw new Error(d.message||d.error||'Payment intent failed');
    const p=d.data;result.className='result ok';result.innerHTML=`Payment intent <strong>${p.reference}</strong> created in TEST mode.<br><button id="confirmTest" class="btn primary wide" style="margin-top:10px">Confirm test payment</button>`;
    document.querySelector('#confirmTest').onclick=async()=>{const btn=document.querySelector('#confirmTest');btn.disabled=true;btn.textContent='Confirming…';try{const cr=await fetch(API+'/v1/payment-intents/'+encodeURIComponent(p.reference)+'/sandbox-confirm',{method:'POST'});const cd=await cr.json();if(!cr.ok)throw new Error(cd.error||'Confirmation failed');result.innerHTML=`<strong>TEST PAYMENT SUCCEEDED.</strong><br>Reference: ${cd.data.reference}<br>Transaction: ${cd.data.transaction_id}`;loadConsole();}catch(e){btn.disabled=false;btn.textContent='Retry test payment';result.className='result error';result.textContent=e.message}};
  }catch(e){result.className='result error';result.textContent=e.message}
};

async function loadConsole(){
  const result=document.querySelector('#consoleResult');
  result.className='result';result.textContent='Loading merchant activity…';
  try{
    const r=await apiFetch('/v1/merchant/summary');const d=await r.json();if(!r.ok)throw new Error(d.message||d.error||'Console unavailable');
    const x=d.data;document.querySelector('#metricSucceeded').textContent=x.metrics.succeeded;document.querySelector('#metricTransactions').textContent=x.metrics.transactions;document.querySelector('#metricLinks').textContent=x.payment_links.length;document.querySelector('#metricGross').textContent=`Gross: ${money(x.metrics.gross_minor,x.merchant.default_currency||'ZAR')}`;
    const rows=document.querySelector('#txRows');rows.innerHTML=x.transactions.length?x.transactions.map(t=>`<tr><td><strong>${t.provider_reference||t.id.slice(0,12)}</strong></td><td>${t.provider_code}</td><td><span class="pill ${t.status}">${t.status}</span></td><td>${money(t.gross_amount_minor,t.currency)}</td><td>${new Date(t.created_at).toLocaleString('en-ZA')}</td></tr>`).join(''):'<tr><td colspan="5">No transactions yet.</td></tr>';
    result.textContent=`Connected to ${x.merchant.trading_name||x.merchant.legal_name} · ${x.merchant.status} · ${x.merchant.settlement_mode||'regulated-partner'}`;
  }catch(e){result.className='result error';result.textContent=e.message}
}
document.querySelector('#refreshConsole').onclick=loadConsole;
document.querySelector('#createLinkBtn').onclick=async()=>{
  const title=prompt('Payment link title','IZAKHONO PAY test order');if(!title)return;
  const amount=prompt('Amount in ZAR (leave blank for customer-entered amount)','499');const minor=amount===''?null:Math.round(Number(amount)*100);if(minor!==null&&(!Number.isSafeInteger(minor)||minor<=0)){alert('Invalid amount');return}
  const result=document.querySelector('#consoleResult');result.textContent='Creating payment link…';
  try{const r=await apiFetch('/v1/payment-links',{method:'POST',body:JSON.stringify({title,amount_minor:minor,currency:'ZAR'})});const d=await r.json();if(!r.ok)throw new Error(d.message||d.error);result.className='result ok';result.innerHTML=`<strong>TEST PAYMENT LINK CREATED.</strong><br><code>${d.data.url}</code>`;loadConsole();}catch(e){result.className='result error';result.textContent=e.message}
};

document.querySelector('#submitApplication').onclick=async()=>{
  const result=document.querySelector('#merchantResult');const legalName=document.querySelector('#legalName').value.trim();const contactName=document.querySelector('#contactName').value.trim();const email=document.querySelector('#merchantEmail').value.trim();
  if(!legalName||!contactName||!email){result.className='result error';result.textContent='Legal business name, contact name and email are required.';return}
  result.className='result';result.textContent='Submitting application…';
  try{const r=await fetch(API+'/v1/merchant-applications',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({legal_name:legalName,trading_name:document.querySelector('#tradingName').value.trim(),contact_name:contactName,email,phone:document.querySelector('#phone').value.trim(),website:document.querySelector('#website').value.trim(),country:'ZA',requested_product:'payments'})});const d=await r.json();if(!r.ok)throw new Error(d.message||d.error||'Application failed');result.className='result ok';result.innerHTML=`<strong>APPLICATION RECEIVED.</strong><br>Application ID: ${d.data.application_id}<br>${d.data.message}`;}catch(e){result.className='result error';result.textContent=e.message}
};

fetch(API+'/health').then(r=>r.json()).then(x=>{if(x.ok)document.querySelector('.status').innerHTML='<span class="dot"></span> '+(x.livePayments?'LIVE':'TEST')+' ENVIRONMENT · REGULATED SETTLEMENT GATE ACTIVE'}).catch(()=>{});
loadConsole();