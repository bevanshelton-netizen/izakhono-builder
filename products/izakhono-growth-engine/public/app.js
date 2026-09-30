const $=id=>document.getElementById(id);
async function getJSON(url,opts){const r=await fetch(url,opts);const j=await r.json();if(!r.ok)throw new Error(j.error||"Request failed");return j}
function esc(v){return String(v??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[s]))}
async function load(){
  const [d,c]=await Promise.all([getJSON("/api/dashboard"),getJSON("/api/campaigns")]);
  $("campaignCount").textContent=d.campaigns;
  $("readyCount").textContent=d.direct_outreach_ready;
  $("leadCount").textContent=d.leads;
  $("crmCount").textContent=d.crm_pushed;
  $("campaigns").innerHTML=c.campaigns.map(x=>`<article class="campaign">
    <span class="pill">${esc(x.mode)}</span>
    <h3>${esc(x.display_name)}</h3>
    <p><strong>Audience:</strong> ${esc(x.audience)}</p>
    <p>${esc(x.offer)}</p>
    <p><strong>CTA:</strong> ${esc(x.cta)}</p>
    <div class="channels">${(x.channels||[]).map(esc).join(" • ")}</div>
    <p><a href="${x.slug==="growth-diagnostic"?"/growth-check/":"/l/"+encodeURIComponent(x.slug)}">${x.slug==="growth-diagnostic"?"Open Growth Check →":"Open campaign page →"}</a>${x.slug==="growth-diagnostic"?"":' · <a href="/api/campaigns/'+encodeURIComponent(x.slug)+'/launch-pack">Launch pack →</a>'}</p>
  </article>`).join("");
}
$("refresh").addEventListener("click",()=>load().catch(e=>alert(e.message)));
$("generator").addEventListener("submit",async e=>{
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const payload=Object.fromEntries(fd.entries());
  const out=await getJSON("/api/campaigns/generate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  $("generated").textContent=JSON.stringify(out,null,2);
});
load().catch(e=>{$("campaigns").textContent=e.message});
