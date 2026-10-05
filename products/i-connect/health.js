(function(){
  const el=document.getElementById('system-health');
  if(!el)return;
  const labels={webApp:'Web App',agentApp:'Agent App',database:'Database',carrier:'Carrier',payments:'Payments'};
  function render(data){
    const modules=data.modules||{};
    const rows=Object.keys(labels).map(k=>{
      const v=modules[k]||'unknown';
      const ok=v==='ready';
      const text=v==='missing_credentials'?'ACTIVATION REQUIRED':v.toUpperCase();
      return '<div class="health-chip '+(ok?'ok':'warn')+'"><span class="health-dot"></span><b>'+labels[k]+'</b><small>'+text+'</small></div>';
    }).join('');
    el.innerHTML='<div class="health-head"><div><strong>I-CONNECT SYSTEM READINESS</strong><span>'+(data.productionReady?'Production ready':'Production activation required')+'</span></div><button id="health-refresh">↻ Refresh</button></div><div class="health-grid">'+rows+'</div>';
    document.getElementById('health-refresh').onclick=check;
  }
  async function check(){
    el.classList.add('loading');
    try{const r=await fetch('/api/health',{cache:'no-store'});const d=await r.json();render(d);}catch(e){render({productionReady:false,modules:{webApp:'ready',agentApp:'ready',database:'unreachable',carrier:'unreachable',payments:'unreachable'}});}finally{el.classList.remove('loading');}
  }
  check(); setInterval(check,30000);
})();
