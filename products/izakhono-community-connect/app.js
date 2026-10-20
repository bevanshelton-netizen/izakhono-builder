const titles={overview:'Network Overview',customers:'Customers',plans:'Packages',vouchers:'Voucher Centre',devices:'Devices',network:'Network',billing:'Billing',security:'Security',ads:'WiFi Advertising'};
const plans=[['Daily 5 GB','R15','5 GB','24 hours'],['Weekly 30 GB','R50','30 GB','7 days'],['Monthly Unlimited','R199','Unlimited','30 days'],['Business 100 GB','R349','100 GB','30 days']];
const voucherState=[['VCH-82A4','Daily 5 GB','Active'],['VCH-91D7','Weekly 30 GB','Active'],['VCH-44BC','Daily 5 GB','Used'],['VCH-3A19','Monthly Unlimited','Active'],['VCH-77EF','Business 100 GB','Active'],['VCH-08CD','Weekly 30 GB','Used']];
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function showView(view){$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`));$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#page-title').textContent=titles[view]||'Network Overview');window.scrollTo({top:0,behavior:'smooth'})}
$$('.nav-item').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));$$('[data-view]').forEach(b=>{if(!b.classList.contains('nav-item'))b.addEventListener('click',()=>showView(b.dataset.view))});
$('#refresh').addEventListener('click',()=>{toast('Network telemetry refreshed');});
$('#quick-voucher').addEventListener('click',()=>{showView('vouchers');toast('Voucher centre ready');});
function renderPlans(){const wrap=$('#plan-cards');wrap.innerHTML=plans.map((p,i)=>`<article class="metric"><span>${p[0]}</span><strong>${p[1]}</strong><small>${p[2]} · ${p[3]}</small><button class="ghost" style="margin-top:15px;width:100%" data-plan="${i}">Sell package</button></article>`).join('');$$('[data-plan]').forEach(b=>b.addEventListener('click',()=>toast(`${plans[b.dataset.plan][0]} selected`)))}
function renderVouchers(filter=''){const wrap=$('#voucher-list');const rows=voucherState.filter(v=>v.join(' ').toLowerCase().includes(filter.toLowerCase()));wrap.innerHTML=rows.map(v=>`<div class="voucher"><b>${v[0]}</b><span>${v[1]} · <strong>${v[2]}</strong></span></div>`).join('')||'<div class="voucher">No vouchers found.</div>'}
$('#generate').addEventListener('click',()=>{const code='VCH-'+Math.random().toString(36).slice(2,6).toUpperCase();voucherState.unshift([code,'Daily 5 GB','Active']);renderVouchers($('#voucher-search').value);toast(`Voucher ${code} generated`)});
$('#voucher-search').addEventListener('input',e=>renderVouchers(e.target.value));
$$('.toggle').forEach(b=>b.addEventListener('click',()=>{b.classList.toggle('on');b.textContent=b.classList.contains('on')?'ON':'OFF';b.style.background=b.classList.contains('on')?'#daf4ed':'#eef1f4';b.style.color=b.classList.contains('on')?'#13836d':'#77889a';toast(`Security policy ${b.textContent}`)}));
renderPlans();renderVouchers();
