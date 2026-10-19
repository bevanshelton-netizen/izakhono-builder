const API='https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-payment-health';
const TEST_KEY='izp_test_IZAKHONO_DEMO_2026';
const modal=document.querySelector('#modal');
const open=()=>modal.classList.remove('hidden');
const close=()=>modal.classList.add('hidden');
document.querySelector('#demoBtn').onclick=open;
document.querySelector('#merchantBtn').onclick=open;
document.querySelector('#merchantCta').onclick=open;
document.querySelector('#close').onclick=close;
modal.addEventListener('click',e=>{if(e.target===modal)close()});

document.querySelector('#createPayment').onclick=async()=>{
  const result=document.querySelector('#result');
  const amount=Math.round(Number(document.querySelector('#amount').value)*100);
  const description=document.querySelector('#description').value.trim();
  const email=document.querySelector('#email').value.trim();
  if(!Number.isSafeInteger(amount)||amount<=0){result.className='result error';result.textContent='Enter a valid amount.';return}
  result.className='result';result.textContent='Creating secure test payment…';
  const idem='demo-'+crypto.randomUUID();
  try{
    const r=await fetch(API+'/v1/payment-intents',{method:'POST',headers:{'content-type':'application/json','x-api-key':TEST_KEY,'idempotency-key':idem},body:JSON.stringify({amount_minor:amount,currency:'ZAR',description,customer_email:email,metadata:{source:'izakhono-pay-demo'}})});
    const d=await r.json();
    if(!r.ok)throw new Error(d.message||d.error||'Payment intent failed');
    const p=d.data;
    result.className='result ok';
    result.innerHTML=`Payment intent <strong>${p.reference}</strong> created in TEST mode.<br><a href="${p.checkout_url}" target="_blank" rel="noopener">Open hosted checkout →</a>`;
  }catch(e){result.className='result error';result.textContent=e.message}
};

fetch(API+'/health').then(r=>r.json()).then(x=>{
  if(x.ok)document.querySelector('.status').innerHTML='<span class="dot"></span> '+(x.livePayments?'LIVE':'TEST')+' ENVIRONMENT · REGULATED SETTLEMENT GATE ACTIVE';
}).catch(()=>{});