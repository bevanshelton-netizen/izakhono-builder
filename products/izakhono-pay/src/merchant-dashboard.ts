export function renderMerchantDashboard(merchantId: string) {
  const safeId = merchantId.replace(/[^A-Za-z0-9_-]/g, '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>IZAKHONO PAY — Merchant Console</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{margin:0;background:#070914;color:#f6f8ff}main{max-width:1180px;margin:auto;padding:32px 20px}.top{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:28px}.brand{font-weight:900;letter-spacing:.08em}.brand span{color:#63e6ff}.sub{color:#8f98b5;font-size:14px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card{background:#11162a;border:1px solid #252c47;border-radius:20px;padding:20px}.label{color:#8f98b5;font-size:13px}.value{font-size:28px;font-weight:900;margin-top:8px}.wide{grid-column:1/-1}.status{display:inline-flex;padding:6px 10px;border-radius:999px;background:#17243b;color:#63e6ff;font-size:12px;font-weight:800}.provider{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #252c47}.provider:last-child{border-bottom:0}.ok{color:#b9ff67}.warn{color:#ffd166}.err{color:#ff7b8b}.error{color:#ff7b8b}.loading{color:#8f98b5}@media(max-width:760px){.grid{grid-template-columns:1fr}.wide{grid-column:auto}.top{align-items:flex-start;flex-direction:column}}
</style></head><body><main>
<div class="top"><div><div class="brand">IZAKHONO <span>PAY™</span></div><div class="sub">Merchant Control Centre</div></div><div id="status" class="status">Loading…</div></div>
<div id="app" class="grid"><div class="card wide loading">Loading merchant control centre…</div></div>
</main>
<script>
const merchantId=${JSON.stringify(safeId)};
const money=(n,c='ZAR')=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:c}).format(Number(n||0));
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){
 const r=await fetch('/v1/merchants/'+encodeURIComponent(merchantId)+'/control-centre');
 const d=await r.json();
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
 '<div class="card wide"><div class="label">Provider health</div>'+ (providers.length?providers.map(p=>'<div class="provider"><span>'+esc(p.provider)+'</span><span class="'+(p.status==='healthy'?'ok':p.status==='degraded'?'warn':'err')+'">'+esc(p.status)+' · '+Number(p.failure_count||0)+' failures</span></div>').join(''):'<div class="sub" style="margin-top:12px">No provider health records.</div>')+'</div>';
}
load().catch(()=>{document.getElementById('app').innerHTML='<div class="card wide error">Control centre unavailable.</div>'});
</script></body></html>`;
}
