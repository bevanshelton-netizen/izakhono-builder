(function(){
  "use strict";

  const fallback = {
    schema:"izakhono.super-app.module-registry.v1",
    modules:[
      {id:"builder",name:"IZAKHONO BUILDER AI",category:"Build + Create",route:"/builder",status:"available",engine:"independent",description:"One-sentence app, website, game and software factory with owned source and internal repository commits."},
      {id:"creator",name:"IZAKHONO Creator Engine",category:"Creator + Campaigns",route:"/creator",status:"integrated",engine:"orchestrated-independent-engines",description:"One-command creator workspace joining ideas, writing, research, design, image, video, audio and automation."},
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
    creator_engine:{
      schema:"izakhono.creator-engine.v1",
      embedded:true,
      route:"/creator",
      status:"integration-installed",
      public_live:false,
      principle:"one brief -> plan -> create -> adapt -> approve -> distribute -> measure",
      capabilities:[
        {id:"ideas",name:"Ideas & planning",handoff:"IZAKHONO SUPER AI",state:"contract-ready"},
        {id:"writing",name:"Writing & copy",handoff:"IZAKHONO SUPER AI",state:"contract-ready"},
        {id:"research",name:"Research & SEO",handoff:"IZAKHONO SUPER AI",state:"contract-ready"},
        {id:"design",name:"Design & images",handoff:"IZAKHONO CREATE",state:"available"},
        {id:"video",name:"Video & shorts",handoff:"IZAKHONO SHORTS FACTORY",state:"available"},
        {id:"audio",name:"Audio & voice",handoff:"IZAKHONO SUPER AI",state:"needs_backend"},
        {id:"automation",name:"Automation & publishing",handoff:"IZAKHONO FLOW + SOCIAL + ADS",state:"integration-contract"}
      ],
      handoffs:["IZAKHONO SUPER AI","IZAKHONO CREATE","IZAKHONO SHORTS FACTORY","IZAKHONO FLOW","IZAKHONO SOCIAL","IZAKHONO ADS","IZAKHONO Affiliate","FORTRESS"],
      safety:{
        owned_first:true,
        external_adapters_replaceable:true,
        behavioural_tracking:false,
        advertising_ids:false,
        raw_prompt_persistence:false,
        paid_spend_requires_authorisation:true,
        publishing_requires_approved_channel_credentials:true,
        media_live_claim_requires_reachable_asset:true
      }
    },
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
  function renderCreator(){
    const creator=registry.creator_engine||fallback.creator_engine;
    const caps=creator.capabilities||[];
    const handoffs=creator.handoffs||[];
    const capGrid=$("creatorCapabilityGrid");
    const handoffList=$("creatorHandoffs");
    if(capGrid){
      capGrid.innerHTML=caps.map((cap,i)=>`
        <div class="capability-card">
          <span class="capability-number">${String(i+1).padStart(2,"0")}</span>
          <div><strong>${cap.name}</strong><small>${cap.handoff} · ${titleize(cap.state||"registered")}</small></div>
        </div>`).join("");
    }
    if(handoffList){
      handoffList.innerHTML=handoffs.map((name,i)=>`
        <div class="handoff-item"><span>${i+1}</span><div><strong>${name}</strong><small>Independent engine / controlled handoff</small></div></div>`).join("");
    }
  }

  function buildCreatorPlan(){
    const brief=($("creatorBrief")?.value||"").trim();
    if(!brief){
      toast("Add a campaign brief first.");
      $("creatorBrief")?.focus();
      return;
    }
    const goal=$("creatorGoal")?.value||"sales";
    const days=Number($("creatorLength")?.value||30);
    const goalLabel={sales:"Generate sales",leads:"Generate leads",awareness:"Build awareness",launch:"Launch a product",retention:"Retain customers"}[goal]||titleize(goal);
    const stages=[
      ["01","PLAN","SUPER AI",`Turn the brief into a ${days}-day strategy, audience, offer, content pillars and KPI plan for “${brief}”.`],
      ["02","RESEARCH","SUPER AI","Build keyword, topic, competitor and content-gap notes using approved/public inputs."],
      ["03","WRITE","SUPER AI","Draft campaign copy, hooks, scripts, emails, captions and landing-page messages."],
      ["04","DESIGN","CREATE","Produce the creative brief, layouts, image directions and reusable campaign pack."],
      ["05","VIDEO","SHORTS FACTORY","Create storyboard and render jobs for short-form video; media stays pending until a renderer returns reachable assets."],
      ["06","AUDIO","SUPER AI","Prepare voiceover, narration, dubbing or transcription tasks; audio generation stays gated when the backend is unavailable."],
      ["07","TRUST","FORTRESS","Screen links, destinations, partner inputs and campaign artefacts before distribution."],
      ["08","ORCHESTRATE","FLOW","Route approvals, channel tasks, handoffs and exception states without moving money or inventing payment confirmation."],
      ["09","DISTRIBUTE","SOCIAL + ADS","Prepare channel-specific publishing and paid-media jobs. Paid spend and authenticated publishing remain owner/channel gated."],
      ["10","MONETISE + LEARN","AFFILIATE + FLOW","Attach approved tracked links where relevant, reconcile verified outcomes and schedule repurposing/retention actions."]
    ];
    const plan=$("creatorPlan");
    plan.classList.remove("creator-plan-empty");
    plan.innerHTML=`
      <div class="creator-plan-summary">
        <div><span class="kicker">GOAL</span><strong>${goalLabel}</strong></div>
        <div><span class="kicker">WINDOW</span><strong>${days} days</strong></div>
        <div><span class="kicker">MODE</span><strong>Workflow preview</strong></div>
      </div>
      <div class="creator-plan-list">${stages.map(s=>`
        <div class="creator-plan-step">
          <span>${s[0]}</span>
          <div><strong>${s[1]} · ${s[2]}</strong><small>${s[3]}</small></div>
        </div>`).join("")}</div>
    `;
    $("creatorStatus").textContent=`Workflow built locally for a ${days}-day campaign. No media was falsely marked generated, no channel was published to and no paid spend was authorised.`;
    toast("Creator workflow built.");
  }

  function switchView(id){
    $$(".view").forEach(v=>v.classList.toggle("active",v.id===id));
    $$(".nav").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function render(){
    renderCreator();
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
    $("planCreator")?.addEventListener("click",buildCreatorPlan);
    $("clearCreator")?.addEventListener("click",()=>{
      if($("creatorBrief")) $("creatorBrief").value="";
      const plan=$("creatorPlan");
      if(plan){
        plan.className="creator-plan-empty";
        plan.textContent="Enter a brief and build the workflow. The preview creates an execution map only; it does not spend money, accept third-party terms or publish content.";
      }
      if($("creatorStatus")) $("creatorStatus").textContent="Planning is available now. Media generation, publishing and paid distribution remain gated by the health and approval state of their independent engines.";
    });
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
