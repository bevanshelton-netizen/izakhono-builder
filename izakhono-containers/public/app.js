const $ = s => document.querySelector(s);
const fmt = v => String(v ?? "—");
let data;

async function load(){
  data = await fetch("/api/dashboard").then(r=>r.json());
  render();
}
function render(){
  const s=data.stats;
  $("#stats").innerHTML = [
    ["Repositories",s.repositories],
    ["Running deployments",s.activeDeployments],
    ["Healthy nodes",s.healthyNodes],
    ["Critical vulnerabilities",s.criticalVulnerabilities]
  ].map(([a,b])=>`<div class="stat"><span>${a}</span><strong>${b}</strong></div>`).join("");

  $("#images").innerHTML=data.images.map(x=>`<div class="row"><div><b>${x.name}</b><div class="meta">:${x.tag} · ${x.updated}</div></div><div class="meta">${x.size}</div><span class="badge">${x.scan}</span></div>`).join("");
  $("#builds").innerHTML=data.builds.slice(0,5).map(x=>`<div class="row"><div><b>${x.project}</b><div class="meta">${x.id} · ${x.commit}</div></div><div class="meta">${x.duration}</div><span class="badge ${x.status==="failed"?"warn":""}">${x.status}</span></div>`).join("");
  $("#nodes").innerHTML=data.nodes.map(x=>`<div class="node"><div><b>${x.name}</b><div class="meta">${x.region} · ${x.workloads} workloads</div></div><div><span class="meta">CPU ${x.cpu}%</span><div class="meter"><i style="width:${x.cpu}%"></i></div></div><div><span class="meta">Memory ${x.memory}%</span><div class="meter"><i style="width:${x.memory}%"></i></div></div></div>`).join("");
  $("#nodeSelect").innerHTML=data.nodes.map(x=>`<option>${x.name}</option>`).join("");
}
document.querySelectorAll(".nav").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  const titles={overview:"Container Command Centre",registry:"Private Image Registry",builds:"IZAKHONO Build Cloud",deployments:"Application Deployments",nodes:"IZAKHONO Node Fabric",security:"Supply Chain Security",teams:"Teams & Access"};
  $("#viewTitle").textContent=titles[b.dataset.view]||"Container Command Centre";
}));
document.querySelectorAll("[data-jump]").forEach(b=>b.addEventListener("click",()=>document.querySelector(`[data-view="${b.dataset.jump}"]`).click()));
$("#copyLogin").addEventListener("click",async()=>{
  const cmd="docker login registry.izakhono.africa";
  try{await navigator.clipboard.writeText(cmd); $("#copyLogin").textContent="Copied"; setTimeout(()=>$("#copyLogin").textContent="Copy login command",1500)}catch{}
});
$("#newBuild").addEventListener("click",()=>$("#buildDialog").showModal());
$("#buildForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const body=Object.fromEntries(new FormData(e.target));
  const r=await fetch("/api/builds",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}).then(r=>r.json());
  $("#buildResult").textContent=r.message+" · "+r.build.id;
  await load();
});
$("#deployForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const body=Object.fromEntries(new FormData(e.target));
  const r=await fetch("/api/deployments",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}).then(r=>r.json());
  $("#deployResult").textContent=`${r.message}: ${r.deployment.app} → ${r.deployment.node}`;
  await load();
});
load().catch(err=>{document.body.insertAdjacentHTML("beforeend",`<pre>${fmt(err.message)}</pre>`)});
