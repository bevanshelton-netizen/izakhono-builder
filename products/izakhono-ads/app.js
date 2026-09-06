(function(){
  "use strict";

  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const state = {
    campaigns: [],
    leads: [],
    creativeCount: 6,
    videoCount: 0,
    videoBlob: null,
    storyboard: []
  };

  const STORAGE = {
    campaigns:"izakhono_ads_campaigns_v1",
    leads:"izakhono_ads_leads_v1",
    creativeCount:"izakhono_ads_creatives_v1",
    videoCount:"izakhono_ads_videos_v1"
  };

  function read(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(_){ return fallback; }
  }

  function save(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){}
  }

  function toast(message){
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(()=>el.classList.remove("show"), 2400);
  }

  function money(n){ return "R" + Math.round(Number(n || 0)).toLocaleString("en-ZA"); }

  function initState(){
    state.campaigns = read(STORAGE.campaigns, [{
      id:"faisready-launch",
      name:"FAISReady National Launch",
      product:"FAISReady",
      goal:"Lead generation",
      status:"Draft / Paused",
      channels:["Facebook","Instagram","TikTok","YouTube"],
      budget:500,
      offer:"R399 launch package",
      note:"South Africa's Regulatory Examination Preparation Platform — RE1 • RE3 • RE4 • RE5."
    }]);
    state.leads = read(STORAGE.leads, []);
    state.creativeCount = read(STORAGE.creativeCount, 6);
    state.videoCount = read(STORAGE.videoCount, 0);
  }

  function switchView(id){
    $$(".view").forEach(v=>v.classList.toggle("active", v.id===id));
    $$(".nav-btn").forEach(b=>b.classList.toggle("active", b.dataset.view===id));
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function bindNavigation(){
    $$(".nav-btn").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.view)));
    $$("[data-jump]").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.jump)));
  }

  function renderCampaigns(){
    const wrap = $("campaignList");
    wrap.innerHTML = "";
    state.campaigns.forEach(c=>{
      const el = document.createElement("article");
      el.className = "panel";
      el.innerHTML = `
        <div class="panel-head">
          <h3>${escapeHtml(c.name)}</h3>
          <span class="pill gold">${escapeHtml(c.status)}</span>
        </div>
        <p>${escapeHtml(c.note || "")}</p>
        <div class="tag-row">${(c.channels||[]).map(x=>`<span>${escapeHtml(x)}</span>`).join("")}</div>
        <div class="metric-big"><span>Planned budget</span><strong>${money(c.budget)}</strong></div>
        <div class="button-row">
          <button class="secondary campaign-edit" data-id="${c.id}">Edit</button>
          <button class="primary campaign-create" data-id="${c.id}">Create ads</button>
        </div>`;
      wrap.appendChild(el);
    });
    $("metricCampaigns").textContent = state.campaigns.length;
    $$(".campaign-create").forEach(b=>b.addEventListener("click",()=>{
      switchView("creative");
      toast("Campaign loaded into Creative Studio.");
    }));
    $$(".campaign-edit").forEach(b=>b.addEventListener("click",()=>{
      const c = state.campaigns.find(x=>x.id===b.dataset.id);
      const name = prompt("Campaign name", c.name);
      if(name){
        c.name=name.trim();
        save(STORAGE.campaigns,state.campaigns);
        renderCampaigns();
      }
    }));
  }

  function newCampaign(){
    const name = prompt("New campaign name","New IZAKHONO Campaign");
    if(!name) return;
    state.campaigns.unshift({
      id:"cmp-"+Date.now(),
      name:name.trim(),
      product:name.trim(),
      goal:"Lead generation",
      status:"Draft / Paused",
      channels:["Facebook","Instagram"],
      budget:500,
      offer:"",
      note:"New owner-controlled campaign. Publishing remains paused."
    });
    save(STORAGE.campaigns,state.campaigns);
    renderCampaigns();
    switchView("campaigns");
    toast("Campaign created in paused state.");
  }

  function duplicateCampaign(){
    const base = state.campaigns[0];
    state.campaigns.unshift({...base,id:"cmp-"+Date.now(),name:base.name+" — Copy",status:"Draft / Paused"});
    save(STORAGE.campaigns,state.campaigns);
    renderCampaigns();
    toast("Campaign duplicated.");
  }

  function runCopilot(){
    const promptText = $("copilotPrompt").value.trim();
    const output = $("copilotOutput");
    if(!promptText){ output.textContent="Describe the campaign first."; return; }
    output.textContent =
`CAMPAIGN POSITIONING
Turn preparation into possibility: FAISReady helps people move toward regulated financial-services roles with structured RE1, RE3, RE4 and RE5 preparation.

CORE MESSAGE
“Prepare with confidence. Progress with purpose. Build your future in financial services.”

LAUNCH MIX
• Facebook / Instagram: career-development image + short video ads
• TikTok / Reels / Shorts: 12–15 second vertical video
• YouTube: 15–20 second explainer / retargeting video
• LinkedIn: professional career-progression creative
• Google: high-intent RE preparation search terms once an account is connected

OWNER SAFETY GATES
• Keep every campaign paused until an ad account is connected
• Do not claim guaranteed exam passes or employment
• Confirm the R399 offer and landing-page flow before spend
• Track source, campaign and creative through UTMs

NEXT ACTION
Generate 3–5 creative variants and one 15-second vertical video, then compare them before approving any live spend.`;
    toast("Campaign plan generated.");
  }

  function creativeData(){
    return {
      brand:$("creativeBrand").value.trim() || "IZAKHONO",
      offer:$("creativeOffer").value.trim(),
      price:$("creativePrice").value.trim(),
      audience:$("creativeAudience").value.trim(),
      tone:$("creativeTone").value,
      platform:$("creativePlatform").value
    };
  }

  function creativeVariants(d){
    return [
      {
        label:"Hopeful career angle",
        headline:"Your next opportunity can start with preparation.",
        body:`${d.brand} helps you prepare for ${d.offer}. Learn with structure, practise with purpose and track your progress. ${d.price}.`,
        cta:"START PREPARING"
      },
      {
        label:"Confidence angle",
        headline:"Walk into your Regulatory Examination better prepared.",
        body:`Build confidence with focused preparation, practical revision and clear progress tools from ${d.brand}. Designed for ${d.audience}.`,
        cta:"SEE THE PROGRAMME"
      },
      {
        label:"Momentum angle",
        headline:"RE1 • RE3 • RE4 • RE5. One place to move forward.",
        body:`Stop piecing your preparation together. ${d.brand} brings the learning journey into one focused platform. ${d.price}.`,
        cta:"GET READY"
      }
    ];
  }

  function generateCreative(){
    const d = creativeData();
    const variants = creativeVariants(d);
    $("creativeOutput").innerHTML = variants.map(v=>`
      <div class="copy-card">
        <strong>${escapeHtml(v.label)}</strong>
        <p><b>Headline:</b> ${escapeHtml(v.headline)}</p>
        <p><b>Copy:</b> ${escapeHtml(v.body)}</p>
        <p><b>CTA:</b> ${escapeHtml(v.cta)}</p>
      </div>`).join("");
    state.creativeCount += variants.length;
    save(STORAGE.creativeCount,state.creativeCount);
    $("metricCreatives").textContent = state.creativeCount;
    drawImageAd();
    toast("Ad pack generated.");
  }

  function wrapText(ctx,text,x,y,maxWidth,lineHeight,maxLines){
    const words = String(text).split(/\s+/);
    const lines=[];
    let line="";
    for(const word of words){
      const test=line ? line+" "+word : word;
      if(ctx.measureText(test).width>maxWidth && line){
        lines.push(line); line=word;
        if(lines.length===maxLines-1) break;
      } else line=test;
    }
    if(line && lines.length<maxLines) lines.push(line);
    return lines.map((l,i)=>ctx.fillText(l,x,y+i*lineHeight));
  }

  function drawImageAd(){
    const canvas=$("imageCanvas"),ctx=canvas.getContext("2d");
    const d=creativeData();
    const w=canvas.width,h=canvas.height;
    const grad=ctx.createLinearGradient(0,0,w,h);
    grad.addColorStop(0,"#061b36");grad.addColorStop(.62,"#0a2e55");grad.addColorStop(1,"#0f7b54");
    ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    ctx.fillStyle="rgba(216,172,67,.22)";ctx.beginPath();ctx.arc(875,190,240,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#f1cd72";ctx.font="800 34px Arial";ctx.fillText("BUILT FOR SOUTH AFRICA",72,100);
    ctx.fillStyle="#ffffff";ctx.font="900 94px Arial";ctx.fillText(d.brand.toUpperCase(),72,220);
    ctx.fillStyle="#ffffff";ctx.font="800 56px Arial";
    wrapText(ctx,"Prepare with confidence. Progress with purpose.",72,340,880,68,3);
    ctx.fillStyle="#d8e6f3";ctx.font="500 36px Arial";
    wrapText(ctx,d.offer,72,575,880,48,4);
    ctx.fillStyle="#f1cd72";ctx.font="900 52px Arial";ctx.fillText(d.price || "LAUNCH OFFER",72,810);
    ctx.fillStyle="#ffffff";ctx.beginPath();roundRect(ctx,72,870,410,100,24);ctx.fill();
    ctx.fillStyle="#061b36";ctx.font="900 31px Arial";ctx.fillText("START PREPARING",112,932);
    ctx.fillStyle="#b8cedf";ctx.font="600 24px Arial";ctx.fillText("IZAKHONO ADS • OWNER-CONTROLLED CREATIVE",72,1030);
  }

  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  }

  function downloadCanvas(canvas,name){
    const link=document.createElement("a");
    link.download=name;
    link.href=canvas.toDataURL("image/png");
    link.click();
  }

  function buildStoryboard(){
    const title=$("videoTitle").value.trim();
    const message=$("videoMessage").value.trim();
    const offer=$("videoOffer").value.trim();
    const cta=$("videoCta").value.trim();
    const length=Number($("videoLength").value);
    const s=[
      {label:"SCENE 1",duration:Math.max(2,Math.round(length*.2)),title:"A new opportunity starts with preparation",body:title || "Your next move starts here"},
      {label:"SCENE 2",duration:Math.max(2,Math.round(length*.25)),title:"RE1 • RE3 • RE4 • RE5",body:message},
      {label:"SCENE 3",duration:Math.max(2,Math.round(length*.2)),title:"Learn • Practise • Track progress",body:"A focused preparation journey built for South Africa."},
      {label:"SCENE 4",duration:Math.max(2,Math.round(length*.18)),title:offer || "Launch offer",body:"Take the next step with confidence."},
      {label:"SCENE 5",duration:Math.max(2,Math.round(length*.17)),title:cta || "START PREPARING",body:$("videoBrand").value.trim()+" — Built in Africa for the world"}
    ];
    state.storyboard=s;
    $("storyboard").innerHTML=s.map(x=>`
      <div class="scene"><span>${x.label} • ${x.duration}s</span><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.body)}</p></div>`).join("");
    drawVideoFrame(0,0,s);
    toast("Storyboard generated.");
    return s;
  }

  function setVideoCanvasSize(){
    const [w,h]=$("videoFormat").value.split("x").map(Number);
    const c=$("videoCanvas");
    c.width=w;c.height=h;
    return {w,h};
  }

  function drawVideoFrame(sceneIndex,progress,scenes){
    const canvas=$("videoCanvas"),ctx=canvas.getContext("2d");
    const {w,h}=setVideoCanvasSize();
    const scene=scenes[sceneIndex] || scenes[0];
    const grad=ctx.createLinearGradient(0,0,w,h);
    grad.addColorStop(0,"#061b36");
    grad.addColorStop(.55,"#0a2e55");
    grad.addColorStop(1,"#0f7b54");
    ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);

    const pulse=.5+.5*Math.sin(progress*Math.PI);
    ctx.fillStyle=`rgba(216,172,67,${.14+.16*pulse})`;
    ctx.beginPath();ctx.arc(w*.78,h*.18,Math.min(w,h)*(.16+.02*pulse),0,Math.PI*2);ctx.fill();
    ctx.fillStyle="rgba(46,194,126,.12)";
    ctx.beginPath();ctx.arc(w*.15,h*.82,Math.min(w,h)*(.20+.015*pulse),0,Math.PI*2);ctx.fill();

    const margin=w*.09;
    ctx.fillStyle="#f1cd72";
    ctx.font=`800 ${Math.round(Math.min(w,h)*.027)}px Arial`;
    ctx.fillText(($("videoBrand").value.trim()||"FAISReady").toUpperCase(),margin,h*.10);

    ctx.fillStyle="#ffffff";
    ctx.font=`900 ${Math.round(Math.min(w,h)*.065)}px Arial`;
    wrapText(ctx,scene.title,margin,h*.30,w-margin*2,Math.round(Math.min(w,h)*.078),4);

    ctx.fillStyle="#d8e6f3";
    ctx.font=`500 ${Math.round(Math.min(w,h)*.031)}px Arial`;
    wrapText(ctx,scene.body,margin,h*.58,w-margin*2,Math.round(Math.min(w,h)*.043),5);

    const barY=h*.91;
    ctx.fillStyle="rgba(255,255,255,.18)";ctx.fillRect(margin,barY,w-margin*2,8);
    ctx.fillStyle="#f1cd72";ctx.fillRect(margin,barY,(w-margin*2)*progress,8);

    ctx.fillStyle="#ffffff";
    ctx.font=`800 ${Math.round(Math.min(w,h)*.024)}px Arial`;
    ctx.fillText(scene.label,margin,h*.96);
  }

  async function renderVideo(){
    const canvas=$("videoCanvas");
    const status=$("renderStatus");
    const scenes=state.storyboard.length?state.storyboard:buildStoryboard();
    const totalSeconds=Number($("videoLength").value);
    const fps=30;

    if(!canvas.captureStream || typeof MediaRecorder==="undefined"){
      status.textContent="This browser does not support local video recording. Try Chrome or Edge.";
      toast("Video recording is not supported in this browser.");
      return;
    }

    const stream=canvas.captureStream(fps);
    const mimeCandidates=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"];
    const mime=mimeCandidates.find(m=>MediaRecorder.isTypeSupported(m)) || "";
    const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});
    const chunks=[];
    recorder.ondataavailable=e=>{ if(e.data && e.data.size) chunks.push(e.data); };

    status.textContent="Rendering video locally…";
    $("renderVideo").disabled=true;
    $("downloadVideo").disabled=true;

    const done=new Promise(resolve=>{
      recorder.onstop=()=>{
        state.videoBlob=new Blob(chunks,{type:mime||"video/webm"});
        const url=URL.createObjectURL(state.videoBlob);
        const preview=$("videoPreview");
        preview.src=url;preview.style.display="block";
        canvas.style.display="none";
        $("downloadVideo").disabled=false;
        state.videoCount+=1;
        save(STORAGE.videoCount,state.videoCount);
        $("metricVideos").textContent=state.videoCount;
        status.textContent="Video rendered. Preview or download it below.";
        $("renderVideo").disabled=false;
        resolve();
      };
    });

    recorder.start(250);
    const start=performance.now();
    const sceneSpan=totalSeconds/scenes.length;

    await new Promise(resolve=>{
      function frame(now){
        const elapsed=(now-start)/1000;
        const global=Math.min(elapsed,totalSeconds);
        const idx=Math.min(scenes.length-1,Math.floor(global/sceneSpan));
        const local=(global-idx*sceneSpan)/sceneSpan;
        drawVideoFrame(idx,Math.min(1,Math.max(0,local)),scenes);
        if(elapsed<totalSeconds) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });

    recorder.stop();
    await done;
    toast("Video ad rendered locally.");
  }

  function downloadVideo(){
    if(!state.videoBlob) return;
    const a=document.createElement("a");
    a.href=URL.createObjectURL(state.videoBlob);
    a.download=(($("videoBrand").value||"izakhono").replace(/[^a-z0-9]+/gi,"-").toLowerCase())+"-ad.webm";
    a.click();
  }

  function calculateBudget(){
    const daily=Math.max(0,Number($("dailyBudget").value));
    const days=Math.max(1,Number($("campaignDays").value));
    const cpl=Math.max(1,Number($("targetCpl").value));
    const total=daily*days;
    $("totalSpend").textContent=money(total);
    $("estimatedLeads").textContent=Math.floor(total/cpl).toLocaleString("en-ZA");
  }

  function renderLeads(){
    const wrap=$("leadTable");
    if(!state.leads.length){
      wrap.innerHTML='<div class="output-card">No leads captured yet.</div>';
    }else{
      wrap.innerHTML=state.leads.map((l,i)=>`
        <div class="lead-row">
          <strong>${escapeHtml(l.name)}</strong>
          <span>${escapeHtml(l.contact)}</span>
          <small>${escapeHtml(l.source)}</small>
          <button class="ghost delete-lead" data-i="${i}">Remove</button>
        </div>`).join("");
      $$(".delete-lead").forEach(b=>b.addEventListener("click",()=>{
        state.leads.splice(Number(b.dataset.i),1);
        save(STORAGE.leads,state.leads);renderLeads();
      }));
    }
    $("metricLeads").textContent=state.leads.length;
    $("analyticsLeads").textContent=state.leads.length;
  }

  function addLead(e){
    e.preventDefault();
    state.leads.unshift({
      name:$("leadName").value.trim(),
      contact:$("leadContact").value.trim(),
      source:$("leadSource").value.trim() || "IZAKHONO ADS",
      createdAt:new Date().toISOString()
    });
    save(STORAGE.leads,state.leads);
    e.target.reset();
    $("leadSource").value="FAISReady Campaign";
    renderLeads();
    toast("Lead added to owner storage.");
  }

  function exportLeads(){
    const rows=[["Name","Contact","Source","Created"],...state.leads.map(l=>[l.name,l.contact,l.source,l.createdAt])];
    const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);a.download="izakhono-ads-leads.csv";a.click();
  }

  function copyCreative(){
    const text=$("creativeOutput").innerText.trim();
    if(!text){toast("Generate an ad pack first.");return;}
    navigator.clipboard?.writeText(text).then(()=>toast("Creative copied."));
  }

  function escapeHtml(s){
    return String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  }

  function bind(){
    bindNavigation();
    $("newCampaignBtn").addEventListener("click",newCampaign);
    $("duplicateCampaign").addEventListener("click",duplicateCampaign);
    $("copilotRun").addEventListener("click",runCopilot);
    $("generateCreative").addEventListener("click",generateCreative);
    $("copyCreative").addEventListener("click",copyCreative);
    $("renderImage").addEventListener("click",drawImageAd);
    $("downloadImage").addEventListener("click",()=>downloadCanvas($("imageCanvas"),"izakhono-ad-square.png"));
    $("buildStoryboard").addEventListener("click",buildStoryboard);
    $("renderVideo").addEventListener("click",renderVideo);
    $("downloadVideo").addEventListener("click",downloadVideo);
    $("videoFormat").addEventListener("change",()=>drawVideoFrame(0,0,state.storyboard.length?state.storyboard:buildStoryboard()));
    $("calcBudget").addEventListener("click",calculateBudget);
    $("leadForm").addEventListener("submit",addLead);
    $("exportLeads").addEventListener("click",exportLeads);
  }

  function init(){
    initState();
    bind();
    renderCampaigns();
    renderLeads();
    $("metricCreatives").textContent=state.creativeCount;
    $("metricVideos").textContent=state.videoCount;
    generateCreative();
    buildStoryboard();
    calculateBudget();
  }

  document.addEventListener("DOMContentLoaded",init);
})();