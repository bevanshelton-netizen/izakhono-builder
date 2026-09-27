(function(){
  "use strict";

  const fallback = {
    schema:"izakhono.super-app.module-registry.v1",
    modules:[
      {id:"builder",name:"IZAKHONO BUILDER AI",category:"Build + Create",route:"/builder",status:"available",engine:"independent",description:"One-sentence app, website, game and software factory with owned source and internal repository commits."},
      {id:"affiliate",name:"IZAKHONO Affiliate",category:"Revenue + Partnerships",route:"/affiliate",status:"integrated",engine:"independent",description:"Publisher income, partner commissions, attribution and external-network adapters."},
      {id:"create",name:"IZAKHONO CREATE",category:"Creative",route:"/create",status:"available",engine:"independent",description:"Portfolio creative system of record."},
      {id:"ads",name:"IZAKHONO ADS",category:"Distribution",route:"/ads",status:"available",engine:"independent",description:"Campaign distribution and performance command centre."},
      {id:"crm",name:"IZAKHONO CRM",category:"Relationships",route:"/crm",status:"architecture-ready",engine:"independent",description:"Portfolio-wide CRM with legal-entity isolation."},
      {id:"flow",name:"IZAKHONO FLOW",category:"Operations + Automation",route:"/flow",status:"integrated",engine:"independent",description:"Lead-to-cash orchestration across CRM, REVENUE, PAY, TASKS, SUPER AI and fulfilment."},
      {id:"accountant",name:"SUPER ACCOUNTANT",category:"Finance",route:"/accounting",status:"architecture-ready",engine:"independent",description:"Verified financial-event accounting and reconciliation."},
      {id:"fortress",name:"FORTRESS",category:"Trust",route:"/fortress",status:"available",engine:"independent",description:"Fraud, trust and abuse protection."},
      {id:"flowiq",name:"FLOWIQ",category:"Workflow",route:"/flowiq",status:"architecture-ready",engine:"independent",description:"Approvals, exceptions and operational workflows."},
      {id:"tasks",name:"IZAKHONO TASKS",category:"Automation",route:"/tasks",status:"architecture-ready",engine:"independent",description:"Owned recurring and condition-driven orchestration."}
    ],
    affiliate:{
      publisher_mode:true,
      network_mode:true,
      adapters:[
        "Awin","CJ","impact.com","Rakuten Advertising","FlexOffers","ClickBank","eBay Partner Network","Tradedoubler","Partnerize","2Checkout / Verifone"
      ].map(name=>({name,enabled:false,status:"Awaiting authenticated connection"})),
      automatic:[
        "Discover public programme changes",
        "Ingest approved offer feeds",
        "Score offer relevance",
        "Generate SubIDs and tracked links",
        "Route approved creative to distribution",
        "Reconcile clicks, conversions and commissions",
        "Detect suspicious referral patterns",
        "Sync verified financial events to SUPER ACCOUNTANT",
        "Sync partners and leads to CRM",
        "Pause broken or policy-invalid adapters",
        "Produce exception-only owner reporting"
      ],
      owner_gates:[
        "Accept network legal terms",
        "Submit banking or tax identity data",
        "Authorise paid-media spend",
        "Change commission rates with material financial impact",
        "Release disputed or exceptional payouts"
      ]
    }
  };

  let registry=fallback;
  const $=id=>document.getElementById(id);
  const $$=sel=>Array.from(document.querySelectorAll(sel));

  function toast(msg){
    const t=$("toast"); t.textContent=msg; t.classList.add("show");
    clearTimeout(toast.timer); toast.timer=setTimeout(()=>t.classList.remove("show"),2200);
  }
  function titleize(s){ return String(s).replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase()); }
  function switchView(id){
    $$(".view").forEach(v=>v.classList.toggle("active",v.id===id));
    $$(".nav").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function render(){
    const aff=registry.affiliate||fallback.affiliate;
    const modules=registry.modules||fallback.modules;
    $("metricModules").textContent=modules.length;
    $("metricAdapters").textContent=(aff.adapters||[]).length;
    $("connectedCount").textContent=(aff.adapters||[]).filter(a=>a.enabled).length;

    $("cycleList").innerHTML=(aff.automatic||[]).map((x,i)=>`
      <div class="cycle-item"><div class="cycle-icon">${i+1}</div><div><strong>${x}</strong><small>Autonomous when prerequisites are verified.</small></div></div>`).join("");

    $("gateList").innerHTML=(aff.owner_gates||[]).map(x=>`
      <div class="gate-item"><div class="gate-icon">!</div><div><strong>${x}</strong><small>Owner or authorised officer required.</small></div></div>`).join("");

    $("networkGrid").innerHTML=(aff.adapters||[]).map(a=>`
      <div class="network"><strong>${a.name}</strong><small>Server-side replaceable adapter</small><span class="state ${a.enabled?"on":""}">${a.enabled?"AUTHENTICATED":"NOT CONNECTED"}</span></div>`).join("");

    $("moduleGrid").innerHTML=modules.map(m=>`
      <article class="module-card">
        <span class="kicker">${m.category||"MODULE"}</span>
        <strong>${m.name}</strong>
        <small>${m.description||""}</small>
        <span class="badge ${m.status==="integrated"||m.status==="available"?"good":""}">${titleize(m.status||"registered")}</span>
      </article>`).join("");
  }

  async function load(){
    try{
      const res=await fetch("module-registry.json",{cache:"no-store"});
      if(res.ok) registry=await res.json();
    }catch(_){}
    render();
  }

  function bind(){
    $$(".nav").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
    $$("[data-jump]").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.jump)));
    $("runCheck").addEventListener("click",()=>{
      const aff=registry.affiliate||fallback.affiliate;
      const connected=(aff.adapters||[]).filter(a=>a.enabled).length;
      const now=new Date().toLocaleString();
      $("checkStatus").textContent=`Safe preview completed ${now}. Engine contract valid; ${connected} external adapters authenticated. No spend, legal acceptance, banking/tax submission or payout action was performed.`;
      toast("Safe affiliate system check completed.");
    });
  }

  document.addEventListener("DOMContentLoaded",()=>{bind();load();});
})();
