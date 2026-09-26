let currentPlanId='';
const q=s=>document.querySelector(s);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=a=>(a||[]).map(x=>'<li>'+esc(x)+'</li>').join('');
q('#go').addEventListener('click',async()=>{
  const idea=q('#idea').value.trim();
  if(!idea){q('#status').textContent='Describe the idea first.';return}
  q('#go').disabled=true;q('#status').textContent='Building venture plan…';
  try{
    const r=await fetch('/api/plan',{method:'POST',headers:{'content-type':'application/json','x-venture-factory-key':q('#key').value.trim()},body:JSON.stringify({idea,country:q('#country').value,monthly_price_zar:Number(q('#price').value),target_monthly_revenue_zar:Number(q('#target').value)})});
    const d=await r.json();if(!r.ok)throw new Error(d.error||'Plan failed');
    currentPlanId=d.id||'';
    q('#buildVenture').style.display=currentPlanId?'inline-block':'none';
    const p=d.plan;q('#name').textContent=p.venture.name;q('#offer').textContent=p.venture.one_line_offer;q('#customers').textContent=p.venture.customers_needed_for_target+' customers';q('#revenue').textContent='R'+p.venture.monthly_price_zar.toLocaleString('en-ZA')+'/month to target R'+p.venture.target_monthly_revenue_zar.toLocaleString('en-ZA')+' MRR';q('#intel').textContent=p.intelligence?.mode==='super-ai'?'SUPER AI':'Safe fallback';q('#intelNote').textContent=p.intelligence?.mode==='super-ai'?'Owner-routed AI enrichment active.':'Deterministic planner active.';q('#build').innerHTML=list(Object.values(p.build));q('#validation').innerHTML=list(p.market_validation.tests);q('#launch').innerHTML=list(p.launch_sequence);q('#raw').textContent=JSON.stringify(p,null,2);q('#results').style.display='block';q('#status').textContent='Plan created and stored by the Venture Factory engine.';
  }catch(e){q('#status').textContent=e.message||String(e)}
  finally{q('#go').disabled=false}
});

q('#buildVenture').addEventListener('click',async()=>{
  if(!currentPlanId){q('#buildStatus').textContent='Build a plan first.';return}
  q('#buildVenture').disabled=true;
  q('#buildStatus').textContent='Promoting plan into IZAKHONO Builder, generating and validating project…';
  try{
    const r=await fetch('/api/plans/'+encodeURIComponent(currentPlanId)+'/build',{
      method:'POST',
      headers:{'x-venture-factory-key':q('#key').value.trim()}
    });
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Builder promotion failed');
    const b=d.build||{};
    q('#buildStatus').textContent=d.already_built
      ?'This plan is already in IZAKHONO Builder.'
      :'Builder project validated. Public deployment remains a separate gate.';
    q('#raw').textContent=JSON.stringify(d,null,2)+'\n\n'+q('#raw').textContent;
    q('#buildVenture').textContent=d.already_built?'Already built':'Built in IZAKHONO';
  }catch(e){q('#buildStatus').textContent=e.message||String(e)}
  finally{q('#buildVenture').disabled=false}
});
