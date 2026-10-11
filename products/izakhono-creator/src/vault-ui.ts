export const vaultUiScript = `<script>
(function(){
  function boot(){
    const library=document.getElementById('library');
    if(!library)return;
    if(document.getElementById('vault-control-room'))return;
    const panel=document.createElement('div');panel.id='vault-control-room';panel.className='card';
    panel.innerHTML='<div class="muted">CONTROL ROOM</div><h2 style="margin:5px 0">Take management</h2><p class="muted">Choose the winning take for each shot or create a new take without losing the previous version.</p><div id="vault-actions" class="toolbar"></div><div id="vault-selection" class="status">Select a completed take to manage it.</div>';
    library.parentElement.insertBefore(panel,library);
    render();
  }
  async function render(){
    const box=document.getElementById('vault-actions');if(!box||typeof assets==='undefined')return;
    const groups={};assets.forEach(a=>{const k=a.shotIndex==null?'unassigned':String(a.shotIndex);(groups[k]??=[]).push(a)});
    box.innerHTML=Object.entries(groups).map(([shot,items])=>'<div style="width:100%;margin-top:10px"><b>SHOT '+(shot==='unassigned'?'—':String(Number(shot)+1).padStart(2,'0'))+'</b><div class="toolbar" style="margin-top:5px">'+items.map(a=>{const selected=Boolean(a.metadata&&a.metadata.selected);return '<button class="'+(selected?'primary':'secondary')+'" onclick="window.vaultSelect(\''+esc(a.id)+'\')">'+esc(a.provider||'take')+' • '+esc(a.status)+(selected?' • WINNER':'')+'</button><button class="secondary" onclick="window.vaultRegenerate(\''+esc(a.id)+'\')">Regenerate</button>'}).join('')+'</div></div>').join('')||'<div class="muted">No takes yet.</div>';
  }
  function esc(v){return String(v??'').replace(/[&<>\\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\"':'&quot;'}[c]));}
  window.vaultSelect=async function(id){
    const ok=confirm('Make this take the selected winner for its shot?');if(!ok)return;
    try{const r=await fetch('/api/assets/'+encodeURIComponent(id)+'/select',{method:'POST'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Selection failed');document.getElementById('vault-selection').textContent='Winner selected. The previous takes remain in the Vault.';await refreshAssets();render();}catch(e){document.getElementById('vault-selection').textContent=e.message;}
  };
  window.vaultRegenerate=async function(id){
    const creativeChange=window.prompt('Optional creative change for the new take:','');
    if(creativeChange===null)return;
    const ok=confirm('Generate a new take for this shot? Provider charges may apply.');if(!ok)return;
    try{const r=await fetch('/api/assets/'+encodeURIComponent(id)+'/regenerate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:creativeChange||undefined})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Regeneration failed');document.getElementById('vault-selection').textContent='New take submitted. The Vault will retain the previous version.';await refreshAssets();render();}catch(e){document.getElementById('vault-selection').textContent=e.message;}
  };
  const oldRefresh=window.refreshAssets;window.refreshAssets=async function(){await oldRefresh();render();};
  const observer=new MutationObserver(()=>render());observer.observe(document.getElementById('library'),{childList:true});
  setTimeout(boot,0);
})();
</script>`;
