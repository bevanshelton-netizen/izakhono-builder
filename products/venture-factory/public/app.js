let currentPlanId='';
let sessionToken=sessionStorage.getItem('izakhono-vf-session')||'';
let mfaChallengeToken='';
let customerOffer=null;

const q=s=>document.querySelector(s);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=a=>(a||[]).map(x=>'<li>'+esc(x)+'</li>').join('');

function ownerKey(){return q('#key').value.trim()}
function authHeaders(includeJson=false){
  const headers={};
  if(includeJson)headers['content-type']='application/json';
  if(ownerKey())headers['x-venture-factory-key']=ownerKey();
  else if(sessionToken)headers.authorization='Bearer '+sessionToken;
  return headers;
}
function zar(minor){return 'R'+(Number(minor||0)/100).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2})}
function checkoutKey(){
  let key=sessionStorage.getItem('izakhono-vf-checkout-key');
  if(!key){key='vf-'+Date.now()+'-'+Math.random().toString(36).slice(2,12);sessionStorage.setItem('izakhono-vf-checkout-key',key)}
  return key;
}
function setCustomerStatus(message){q('#customerStatus').textContent=message}
function showCheckoutIntent(intent){
  if(!intent)return;
  if(intent.checkout_method==='redirect'&&intent.checkout_url){location.assign(intent.checkout_url);return}
  if(intent.checkout_method==='form_post'&&intent.checkout_url&&intent.form_fields){
    const form=document.createElement('form');form.method='POST';form.action=intent.checkout_url;
    Object.entries(intent.form_fields).forEach(([name,value])=>{const input=document.createElement('input');input.type='hidden';input.name=name;input.value=String(value);form.appendChild(input)});
    document.body.appendChild(form);form.submit();return;
  }
  setCustomerStatus('Payment intent created. Open the checkout route supplied by IZAKHONO PAY.');
}

async function loadOffer(){
  try{
    const r=await fetch('/api/customer/offer',{cache:'no-store'});
    if(r.status===404){q('#customerPanel').hidden=true;return}
    const d=await r.json();if(!r.ok)throw new Error(d.error||'Offer unavailable');
    customerOffer=d;q('#customerPanel').hidden=false;
    q('#offerText').textContent=d.checkout_available&&d.amount_minor
      ?d.plan+' access · '+zar(d.amount_minor)+' · '+d.access_period_days+' days'
      :'Customer access is configured, but checkout is not yet enabled.';
    if(sessionToken)await refreshSession();
  }catch(e){q('#customerPanel').hidden=false;setCustomerStatus(e.message||String(e))}
}

async function refreshSession(){
  if(!sessionToken){q('#logoutCustomer').hidden=true;q('#subscribeCustomer').hidden=true;setCustomerStatus('Sign in with IZAKHONO ID.');return null}
  try{
    const r=await fetch('/api/customer/session',{headers:{authorization:'Bearer '+sessionToken},cache:'no-store'});
    const d=await r.json();
    if(r.status===401){sessionToken='';sessionStorage.removeItem('izakhono-vf-session');q('#logoutCustomer').hidden=true;q('#subscribeCustomer').hidden=true;setCustomerStatus('Session expired. Sign in again.');return null}
    if(!r.ok)throw new Error(d.error||'Session check failed');
    q('#logoutCustomer').hidden=false;
    q('#subscribeCustomer').hidden=Boolean(d.access?.active)||!d.checkout_available;
    setCustomerStatus(d.access?.active
      ?'Subscription active for '+(d.subject||'customer')+'.'
      :'Signed in as '+(d.subject||'customer')+'. Subscription required to create plans.');
    return d;
  }catch(e){setCustomerStatus(e.message||String(e));return null}
}

q('#loginCustomer').addEventListener('click',async()=>{
  const email=q('#customerEmail').value.trim();
  const password=q('#customerPassword').value;
  const entity=q('#customerEntity').value.trim()||'izakhono-africa';
  if(!email||!password){setCustomerStatus('Enter email and password.');return}
  q('#loginCustomer').disabled=true;setCustomerStatus('Signing in…');
  try{
    const r=await fetch('/api/customer/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,entity_slug:entity})});
    const d=await r.json();if(!r.ok)throw new Error(d.error||'Sign-in failed');
    if(d.mfa_required){
      mfaChallengeToken=d.challenge_token||'';
      if(!mfaChallengeToken)throw new Error('Identity service did not return an MFA challenge.');
      q('#mfaPanel').hidden=false;
      q('#customerMfaCode').focus();
      q('#customerPassword').value='';
      setCustomerStatus('Multi-factor authentication required. Enter your authenticator or recovery code.');
      return;
    }
    sessionToken=d.access_token||'';if(!sessionToken)throw new Error('Identity service returned no session token');
    sessionStorage.setItem('izakhono-vf-session',sessionToken);
    q('#customerPassword').value='';
    q('#mfaPanel').hidden=true;
    mfaChallengeToken='';
    await refreshSession();
  }catch(e){setCustomerStatus(e.message||String(e))}
  finally{q('#loginCustomer').disabled=false}
});

q('#verifyMfa').addEventListener('click',async()=>{
  const factor=q('#customerMfaCode').value.trim();
  if(!mfaChallengeToken||!factor){setCustomerStatus('Enter your authenticator or recovery code.');return}
  q('#verifyMfa').disabled=true;setCustomerStatus('Verifying multi-factor authentication…');
  try{
    const isTotp=/^\d{6}$/.test(factor.replace(/\s+/g,''));
    const r=await fetch('/api/customer/login/mfa',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        challenge_token:mfaChallengeToken,
        ...(isTotp?{code:factor}:{recovery_code:factor})
      })
    });
    const d=await r.json();if(!r.ok)throw new Error(d.error||'MFA verification failed');
    sessionToken=d.access_token||'';if(!sessionToken)throw new Error('Identity service returned no session token');
    sessionStorage.setItem('izakhono-vf-session',sessionToken);
    mfaChallengeToken='';
    q('#customerMfaCode').value='';
    q('#mfaPanel').hidden=true;
    await refreshSession();
  }catch(e){setCustomerStatus(e.message||String(e))}
  finally{q('#verifyMfa').disabled=false}
});

q('#logoutCustomer').addEventListener('click',async()=>{
  try{if(sessionToken)await fetch('/api/customer/logout',{method:'POST',headers:{authorization:'Bearer '+sessionToken}})}catch{}
  sessionToken='';mfaChallengeToken='';
  sessionStorage.removeItem('izakhono-vf-session');sessionStorage.removeItem('izakhono-vf-checkout-key');
  q('#mfaPanel').hidden=true;q('#customerMfaCode').value='';
  await refreshSession();
});

q('#subscribeCustomer').addEventListener('click',async()=>{
  if(!sessionToken){setCustomerStatus('Sign in before subscribing.');return}
  q('#subscribeCustomer').disabled=true;setCustomerStatus('Preparing secure checkout…');
  try{
    const r=await fetch('/api/customer/checkout',{
      method:'POST',
      headers:{'content-type':'application/json',authorization:'Bearer '+sessionToken,'idempotency-key':checkoutKey()},
      body:'{}'
    });
    const d=await r.json();if(!r.ok)throw new Error(d.error||'Checkout failed');
    setCustomerStatus('Checkout created. Access unlocks only after verified payment.');
    showCheckoutIntent(d.intent);
  }catch(e){setCustomerStatus(e.message||String(e))}
  finally{q('#subscribeCustomer').disabled=false}
});

q('#go').addEventListener('click',async()=>{
  const idea=q('#idea').value.trim();
  if(!idea){q('#status').textContent='Describe the idea first.';return}
  q('#go').disabled=true;q('#status').textContent='Building venture plan…';
  try{
    const r=await fetch('/api/plan',{method:'POST',headers:authHeaders(true),body:JSON.stringify({idea,country:q('#country').value,monthly_price_zar:Number(q('#price').value),target_monthly_revenue_zar:Number(q('#target').value)})});
    const d=await r.json();
    if(r.status===402){
      q('#subscribeCustomer').hidden=!d.checkout_available;
      throw new Error('An active Venture Factory subscription is required.');
    }
    if(!r.ok)throw new Error(d.error||'Plan failed');
    currentPlanId=d.id||'';
    q('#buildVenture').style.display=currentPlanId&&ownerKey()?'inline-block':'none';
    const p=d.plan;
    q('#name').textContent=p.venture.name;
    q('#offer').textContent=p.venture.one_line_offer;
    q('#customers').textContent=p.venture.customers_needed_for_target+' customers';
    q('#revenue').textContent='R'+p.venture.monthly_price_zar.toLocaleString('en-ZA')+'/month to target R'+p.venture.target_monthly_revenue_zar.toLocaleString('en-ZA')+' MRR';
    q('#intel').textContent=p.intelligence?.mode==='super-ai'?'SUPER AI':'Safe fallback';
    q('#intelNote').textContent=p.intelligence?.mode==='super-ai'?'Owner-routed AI enrichment active.':'Deterministic planner active.';
    q('#build').innerHTML=list(Object.values(p.build));
    q('#validation').innerHTML=list(p.market_validation.tests);
    q('#launch').innerHTML=list(p.launch_sequence);
    q('#raw').textContent=JSON.stringify(p,null,2);
    q('#results').style.display='block';
    q('#status').textContent='Plan created and stored by the Venture Factory engine.';
  }catch(e){q('#status').textContent=e.message||String(e)}
  finally{q('#go').disabled=false}
});

q('#buildVenture').addEventListener('click',async()=>{
  if(!currentPlanId){q('#buildStatus').textContent='Build a plan first.';return}
  if(!ownerKey()){q('#buildStatus').textContent='Owner key is required for Builder promotion.';return}
  q('#buildVenture').disabled=true;
  q('#buildStatus').textContent='Promoting plan into IZAKHONO Builder, generating and validating project…';
  try{
    const r=await fetch('/api/plans/'+encodeURIComponent(currentPlanId)+'/build',{method:'POST',headers:{'x-venture-factory-key':ownerKey()}});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Builder promotion failed');
    q('#buildStatus').textContent=d.already_built?'This plan is already in IZAKHONO Builder.':'Builder project validated. Public deployment remains a separate gate.';
    q('#raw').textContent=JSON.stringify(d,null,2)+'\n\n'+q('#raw').textContent;
    q('#buildVenture').textContent=d.already_built?'Already built':'Built in IZAKHONO';
  }catch(e){q('#buildStatus').textContent=e.message||String(e)}
  finally{q('#buildVenture').disabled=false}
});

q('#key').addEventListener('input',()=>{q('#buildVenture').style.display=currentPlanId&&ownerKey()?'inline-block':'none'});

const paymentState=new URLSearchParams(location.search).get('payment');
if(paymentState==='return')setCustomerStatus('Payment returned. Verifying entitlement…');
if(paymentState==='cancel')setCustomerStatus('Checkout was cancelled. No access change was made.');
loadOffer();
