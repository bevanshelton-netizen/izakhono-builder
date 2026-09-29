const questions=[
  {key:"revenue_band",title:"Where is your business right now?",options:[
    ["starting_under_50k","🌱","Starting / under R50k per month"],
    ["50k_250k","📈","R50k–R250k per month"],
    ["250k_1m","🏆","R250k–R1m per month"],
    ["1m_plus","💎","R1m+ per month"],
    ["prefer_not","○","Prefer not to say"]
  ]},
  {key:"goal",title:"What would create the biggest difference right now?",options:[
    ["customers","🎯","More customers / stronger sales"],
    ["website_commerce","🛒","Website or e-commerce that converts"],
    ["marketing","📣","Marketing and campaigns"],
    ["automation_ai","⚙️","Automation and AI"],
    ["staffing","👥","Staffing and operating workflow"],
    ["finance_admin","📊","Finance and administration"],
    ["hosting_email","🌐","Hosting, email and digital foundation"],
    ["security_trust","🛡️","Security, fraud prevention and trust"]
  ]},
  {key:"urgency",title:"How soon do you want movement?",options:[
    ["now_30_days","⚡","Within 30 days"],
    ["1_3_months","🗓️","Within 1–3 months"],
    ["exploring","🔎","I am exploring first"]
  ]},
  {key:"sales_process",title:"How does your sales process work today?",options:[
    ["none","○","No consistent process yet"],
    ["manual","✋","Mostly manual follow-up"],
    ["repeatable","🔁","Repeatable but not automated"],
    ["automated","⚙️","CRM / automation already in place"]
  ]},
  {key:"digital_foundation",title:"What does your digital foundation look like?",options:[
    ["no_site","○","No proper website yet"],
    ["basic_site","🧱","Basic website / email"],
    ["active_site","🚀","Active site generating enquiries"],
    ["integrated_stack","🔗","Integrated site, CRM and systems"]
  ]},
  {key:"buying_mode",title:"How would you prefer to move forward?",options:[
    ["self_serve","🧰","Start with a focused product"],
    ["guided","🤝","Guided setup and implementation"],
    ["enterprise","🏢","Structured enterprise pilot / proposal"]
  ]}
];
const answers={};let step=0,profile=null,intent="get_proposal";
const $=id=>document.getElementById(id);
function esc(v){return String(v??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[s]))}
function render(){
  const q=questions[step];
  $("stepText").textContent="Question "+(step+1)+" of "+questions.length;
  $("bar").style.width=((step/questions.length)*100)+"%";
  $("question").innerHTML="<h2>"+esc(q.title)+"</h2><div class='choices'>"+q.options.map(([value,icon,label])=>"<button type='button' data-value='"+esc(value)+"'><span>"+icon+"</span><b>"+esc(label)+"</b></button>").join("")+"</div>";
  $("question").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{answers[q.key]=btn.dataset.value;step++;if(step<questions.length)render();else finish()}));
}
async function finish(){
  $("quizError").textContent="";
  $("question").innerHTML="<div class='loading'>Building your growth prescription…</div>";
  $("bar").style.width="100%";
  try{
    const r=await fetch("/api/public/growth-diagnostic",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(answers)});
    const j=await r.json();if(!r.ok)throw new Error(j.error||"Unable to prepare diagnostic.");
    profile=j;
    $("quiz").classList.add("hidden");
    $("lane").textContent=j.lane+" PATH";
    $("score").textContent="Priority score "+j.lead_score+"/100";
    $("summary").textContent=j.summary;
    $("actions").innerHTML=j.actions.map(x=>"<li>"+esc(x)+"</li>").join("");
    $("products").innerHTML=j.recommended_products.map(x=>"<span>"+esc(x.replace(/^izakhono-/,"IZAKHONO ").replace(/-/g," ").toUpperCase())+"</span>").join("");
    $("result").classList.remove("hidden");
    $("result").scrollIntoView({behavior:"smooth"});
  }catch(e){$("quizError").textContent=e.message;step=0;render()}
}
document.querySelectorAll("[data-intent]").forEach(btn=>btn.addEventListener("click",()=>{
  intent=btn.dataset.intent;
  const labels={start_now:"Start my recommended setup",request_whatsapp:"Request WhatsApp contact",book_strategy:"Book a strategy session",get_proposal:"Request a proposal"};
  $("contactTitle").textContent=labels[intent]||"Take the next step";
  $("contact").classList.remove("hidden");
  $("contact").scrollIntoView({behavior:"smooth"});
}));
$("leadForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!profile)return;
  const fd=new FormData(e.currentTarget),payload=Object.fromEntries(fd.entries());
  payload.consent=fd.get("consent")==="on";payload.intent=intent;payload.answers=answers;
  $("leadStatus").textContent="Sending…";
  try{
    const r=await fetch("/api/public/growth-diagnostic/lead",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    const j=await r.json();if(!r.ok)throw new Error(j.error||"Unable to submit.");
    $("leadStatus").textContent="Received. Your request is now in the IZAKHONO Growth Engine"+(j.crm_status==="pushed"?" and CRM.":".");
    e.currentTarget.querySelector("button[type=submit]").disabled=true;
  }catch(e){$("leadStatus").textContent=e.message}
});
render();